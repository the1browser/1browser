'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createProfile,
  deleteProfile,
  deleteProfiles,
  ensureProfiles,
  persistentProfiles,
} = require('../src/profiles');
const {
  ProfileDeletionError,
  ProfileError,
  ProfileLimitError,
} = require('../src/errors');

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

test('deleteProfile passes ProfileInfo.id and requires confirmed deletion', async () => {
  const {calls, cdp} = session((method, params) => {
    assert.equal(method, 'Browser.deleteProfileById');
    assert.deepEqual(params, {profileId: 'profile-id'});
    return {success: true};
  });
  const result = await deleteProfile(cdp, 'profile-id');
  assert.deepEqual(result, {profileId: 'profile-id', success: true});
  assert.equal(calls.length, 1);
});

test('deleteProfile rejects an unconfirmed deletion', async () => {
  const {cdp} = session(() => ({success: false}));
  await assert.rejects(
    deleteProfile(cdp, 'profile-id'),
    (error) =>
      error instanceof ProfileDeletionError &&
      error.code === 'ERR_ONE_BROWSER_PROFILE_DELETE',
  );
});

test('deleteProfile wraps CDP failures', async () => {
  const cause = new Error('transport failed');
  const {cdp} = session(() => {
    throw cause;
  });
  await assert.rejects(
    deleteProfile(cdp, 'profile-id'),
    (error) =>
      error instanceof ProfileDeletionError &&
      error.cause === cause,
  );
});

test('deleteProfiles validates every ID before deleting anything', async () => {
  const {calls, cdp} = session(() => ({success: true}));
  await assert.rejects(
    deleteProfiles(cdp, ['valid-id', '']),
    ProfileError,
  );
  assert.equal(calls.length, 0);
});

test('deleteProfiles rejects duplicate IDs before deleting anything', async () => {
  const {calls, cdp} = session(() => ({success: true}));
  await assert.rejects(
    deleteProfiles(cdp, ['same-id', 'same-id']),
    ProfileDeletionError,
  );
  assert.equal(calls.length, 0);
});

test('deleteProfiles returns one ordered result per explicit ID', async () => {
  const {calls, cdp} = session((_method, {profileId}) => {
    if (profileId === 'profile-2') {
      return {success: false};
    }
    return {success: true};
  });
  const results = await deleteProfiles(cdp, [
    'profile-1',
    'profile-2',
    'profile-3',
  ]);
  assert.deepEqual(
    results.map(({profileId, success}) => ({profileId, success})),
    [
      {profileId: 'profile-1', success: true},
      {profileId: 'profile-2', success: false},
      {profileId: 'profile-3', success: true},
    ],
  );
  assert.match(results[1].error.message, /did not confirm deletion/);
  assert.deepEqual(
    calls.map(({params}) => params.profileId),
    ['profile-1', 'profile-2', 'profile-3'],
  );
});
