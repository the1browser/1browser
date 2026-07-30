'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {runForProfiles} = require('../src/concurrency');
const {ProfileTaskError} = require('../src/errors');

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function profiles(count) {
  return Array.from({length: count}, (_, index) => ({
    id: `profile-${index}`,
    name: `Profile ${index}`,
  }));
}

function fakeClient(onOpen = () => {}) {
  const pages = [];
  const openCalls = [];
  return {
    openCalls,
    pages,
    async openProfilePage(profileId, options) {
      openCalls.push({profileId, options});
      await onOpen(profileId, options);
      const page = {
        profileId,
        closed: false,
        isClosed() {
          return this.closed;
        },
        async close() {
          this.closed = true;
        },
      };
      pages.push(page);
      return {page};
    },
  };
}

test('defaults to concurrency two and preserves result order', async () => {
  let active = 0;
  let maximum = 0;
  const client = fakeClient();
  const result = await runForProfiles(client, {
    profiles: profiles(5),
    task: async ({profile}) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await wait(profile.id === 'profile-0' ? 8 : 2);
      active -= 1;
      return profile.id;
    },
  });
  assert.equal(maximum, 2);
  assert.deepEqual(
    result.map(({profileId}) => profileId),
    profiles(5).map(({id}) => id),
  );
  assert.equal(result.every(({success}) => success), true);
  assert.equal(client.pages.every(({closed}) => closed), true);
  assert.deepEqual(
    client.openCalls.map(({options}) => options),
    Array.from({length: 5}, () => ({timeoutMs: 30_000})),
  );
});

test('limits simultaneous profile opening independently from task concurrency', async () => {
  let activeOpenings = 0;
  let maximumOpenings = 0;
  const client = fakeClient(async () => {
    activeOpenings += 1;
    maximumOpenings = Math.max(maximumOpenings, activeOpenings);
    await wait(5);
    activeOpenings -= 1;
  });

  const result = await runForProfiles(client, {
    profiles: profiles(8),
    concurrency: 8,
    openingConcurrency: 2,
    task: async ({profile}) => profile.id,
  });

  assert.equal(maximumOpenings, 2);
  assert.equal(client.openCalls.length, 8);
  assert.equal(result.every(({success}) => success), true);
});

test('defaults profile opening concurrency to two', async () => {
  let activeOpenings = 0;
  let maximumOpenings = 0;
  const client = fakeClient(async () => {
    activeOpenings += 1;
    maximumOpenings = Math.max(maximumOpenings, activeOpenings);
    await wait(5);
    activeOpenings -= 1;
  });

  await runForProfiles(client, {
    profiles: profiles(6),
    concurrency: 6,
    task: async ({profile}) => profile.id,
  });

  assert.equal(maximumOpenings, 2);
});

test('forwards a user-configured profile opening timeout', async () => {
  const client = fakeClient();
  await runForProfiles(client, {
    profiles: profiles(3),
    concurrency: 3,
    openingConcurrency: 1,
    openTimeoutMs: 120_000,
    task: async ({profile}) => profile.id,
  });
  assert.deepEqual(
    client.openCalls.map(({options}) => options),
    [
      {timeoutMs: 120_000},
      {timeoutMs: 120_000},
      {timeoutMs: 120_000},
    ],
  );
});

test('continues after failures and returns one result per profile', async () => {
  const client = fakeClient();
  const result = await runForProfiles(client, {
    profiles: profiles(4),
    concurrency: 2,
    task: async ({profile}) => {
      if (profile.id === 'profile-1') {
        throw new TypeError('Expected failure');
      }
      return profile.id;
    },
  });
  assert.equal(result.length, 4);
  assert.equal(result[1].success, false);
  assert.deepEqual(result[1].error, {
    name: 'TypeError',
    message: 'Expected failure',
  });
  assert.equal(result.filter(({success}) => success).length, 3);
  assert.equal(client.pages.every(({closed}) => closed), true);
});

test('stopOnError stops scheduling and marks every unstarted profile', async () => {
  const opened = [];
  const client = fakeClient((id) => opened.push(id));
  const result = await runForProfiles(client, {
    profiles: profiles(5),
    concurrency: 1,
    stopOnError: true,
    task: async ({profile}) => {
      if (profile.id === 'profile-1') {
        throw new Error('stop');
      }
      return profile.id;
    },
  });
  assert.deepEqual(opened, ['profile-0', 'profile-1']);
  assert.equal(result.length, 5);
  assert.equal(result.slice(1).every(({success}) => !success), true);
});

test('validates concurrency and profile IDs', async () => {
  await assert.rejects(
    runForProfiles(fakeClient(), {
      profiles: [{name: 'No id'}],
      concurrency: 0,
      task: async () => {},
    }),
    ProfileTaskError,
  );

  for (const invalid of [0, -1, 1.5, Number.NaN]) {
    await assert.rejects(
      runForProfiles(fakeClient(), {
        profiles: profiles(1),
        openingConcurrency: invalid,
        task: async () => {},
      }),
      /openingConcurrency must be a positive integer/,
    );
  }

  for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    await assert.rejects(
      runForProfiles(fakeClient(), {
        profiles: profiles(1),
        openTimeoutMs: invalid,
        task: async () => {},
      }),
      /openTimeoutMs must be a positive number/,
    );
  }
});
