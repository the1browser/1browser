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
  return {
    pages,
    async openProfilePage(profileId) {
      onOpen(profileId);
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
});
