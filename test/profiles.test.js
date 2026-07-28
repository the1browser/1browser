'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createProfile,
  ensureProfiles,
  persistentProfiles,
} = require('../src/profiles');
const {ProfileError, ProfileLimitError} = require('../src/errors');

function session(handler) {
  const calls = [];
  return {
    calls,
    cdp: {
      async send(method, params) {
        calls.push({method, params});
        return handler(method, params);
      },
    },
  };
}

test('filters omitted and ephemeral profiles by default', () => {
  const result = persistentProfiles([
    {id: 'active', omitted: false, ephemeral: false},
    {id: 'omitted', omitted: true, ephemeral: false},
    {id: 'ephemeral', omitted: false, ephemeral: true},
  ]);
  assert.deepEqual(result.map(({id}) => id), ['active']);
});

test('can include omitted persistent profiles explicitly', () => {
  const result = persistentProfiles(
    [
      {id: 'active', omitted: false, ephemeral: false},
      {id: 'omitted', omitted: true, ephemeral: false},
      {id: 'ephemeral', omitted: false, ephemeral: true},
    ],
    {includeOmitted: true},
  );
  assert.deepEqual(result.map(({id}) => id), ['active', 'omitted']);
});

test('ensure-count reuses deterministic names in index order', async () => {
  const profiles = [
    {id: 'two', name: 'Search 02'},
    {id: 'unrelated', name: 'Other 01'},
    {id: 'one', name: 'Search 01'},
  ];
  const {calls, cdp} = session(() => {
    throw new Error('Creation APIs should not be called.');
  });
  const result = await ensureProfiles(cdp, profiles, {
    count: 2,
    namePrefix: 'Search',
  });
  assert.deepEqual(result.profiles.map(({id}) => id), ['one', 'two']);
  assert.deepEqual(result.reused, result.profiles);
  assert.deepEqual(result.created, []);
  assert.equal(calls.length, 0);
});

test('ensure-count creates only missing deterministic profiles', async () => {
  const {calls, cdp} = session((method, params) => {
    if (method === 'Browser.getAvailableProfileCreationCount') {
      return {count: 4};
    }
    return {profile: {id: `id-${params.name}`, name: params.name}};
  });
  const result = await ensureProfiles(
    cdp,
    [{id: 'one', name: 'Search 01'}],
    {count: 3, namePrefix: 'Search'},
  );
  assert.deepEqual(result.profiles.map(({name}) => name), [
    'Search 01',
    'Search 02',
    'Search 03',
  ]);
  assert.deepEqual(result.created.map(({name}) => name), [
    'Search 02',
    'Search 03',
  ]);
  assert.equal(
    calls.filter(({method}) => method === 'Browser.createProfile').length,
    2,
  );
});

test('deterministic names remain stable when the count grows beyond two digits', async () => {
  const existing = Array.from({length: 99}, (_, index) => ({
    id: `id-${index + 1}`,
    name: `Search ${String(index + 1).padStart(2, '0')}`,
  }));
  const {cdp} = session((method, params) => {
    if (method === 'Browser.getAvailableProfileCreationCount') {
      return {count: 1};
    }
    return {profile: {id: 'id-100', name: params.name}};
  });
  const result = await ensureProfiles(cdp, existing, {
    count: 100,
    namePrefix: 'Search',
  });
  assert.equal(result.reused.length, 99);
  assert.equal(result.created[0].name, 'Search 100');
  assert.equal(result.profiles[0].name, 'Search 01');
});

test('insufficient limit fails before creating anything', async () => {
  const {calls, cdp} = session(() => ({count: 1}));
  await assert.rejects(
    ensureProfiles(cdp, [], {count: 2, namePrefix: 'Search'}),
    ProfileLimitError,
  );
  assert.deepEqual(calls.map(({method}) => method), [
    'Browser.getAvailableProfileCreationCount',
  ]);
});

test('create-new creates exactly the requested number after one preflight', async () => {
  const {calls, cdp} = session((method, params) => {
    if (method === 'Browser.getAvailableProfileCreationCount') {
      return {count: 3};
    }
    return {profile: {id: params.name, name: params.name}};
  });
  const result = await ensureProfiles(
    cdp,
    [{id: 'old', name: 'Search 02'}],
    {count: 2, namePrefix: 'Search', mode: 'create-new'},
  );
  assert.deepEqual(result.profiles.map(({name}) => name), [
    'Search 03',
    'Search 04',
  ]);
  assert.equal(calls[0].method, 'Browser.getAvailableProfileCreationCount');
});

test('use-existing never creates and fails when matches are missing', async () => {
  const {calls, cdp} = session(() => {
    throw new Error('No CDP call expected.');
  });
  await assert.rejects(
    ensureProfiles(
      cdp,
      [{id: 'one', name: 'Search 01'}],
      {count: 2, namePrefix: 'Search', mode: 'use-existing'},
    ),
    ProfileError,
  );
  assert.equal(calls.length, 0);
});

test('createProfile checks the limit and passes only a display name', async () => {
  const {calls, cdp} = session((method, params) => {
    if (method === 'Browser.getAvailableProfileCreationCount') {
      return {count: 1};
    }
    return {profile: {id: 'profile-id', name: params.name}};
  });
  const profile = await createProfile(cdp, 'Display Name');
  assert.equal(profile.id, 'profile-id');
  assert.deepEqual(calls[1], {
    method: 'Browser.createProfile',
    params: {name: 'Display Name'},
  });
});
