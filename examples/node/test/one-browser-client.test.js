'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {OneBrowserClient} = require('../src/one-browser-client');

function createClient(handler, config = {}) {
  const calls = [];
  const cdp = {
    async send(method, params) {
      calls.push({method, params});
      return handler(method, params);
    },
  };

  return {
    calls,
    client: new OneBrowserClient(
      {close: async () => {}},
      cdp,
      config,
    ),
  };
}

test('reuses a valid persisted session without reading credentials', async () => {
  const {calls, client} = createClient((method) => {
    assert.equal(method, 'Browser.getAuthState');
    return {signedIn: true, state: 'signed_in'};
  });

  const state = await client.ensureAuthenticated();

  assert.equal(state.signedIn, true);
  assert.deepEqual(calls, [
    {
      method: 'Browser.getAuthState',
      params: {validateOnline: true},
    },
  ]);
});

test('signs in and confirms auth when the persisted session is unavailable', async () => {
  const authStates = [
    {signedIn: false, state: 'signed_out'},
    {signedIn: true, state: 'signed_in'},
  ];
  const {calls, client} = createClient(
    (method) => {
      if (method === 'Browser.getAuthState') {
        return authStates.shift();
      }
      if (method === 'Browser.signin') {
        return {success: true, responseCode: 200};
      }
      throw new Error(`Unexpected method: ${method}`);
    },
    {email: 'person@example.com', password: 'not-logged'},
  );

  const state = await client.ensureAuthenticated({timeoutMs: 100});

  assert.equal(state.signedIn, true);
  assert.deepEqual(
    calls.map(({method}) => method),
    [
      'Browser.getAuthState',
      'Browser.signin',
      'Browser.getAuthState',
    ],
  );
});

test('does not continue after a failed signin response', async () => {
  const {client} = createClient(
    (method) => {
      if (method === 'Browser.getAuthState') {
        return {signedIn: false, state: 'expired'};
      }
      return {success: false, responseCode: 401};
    },
    {email: 'person@example.com', password: 'not-logged'},
  );

  await assert.rejects(
    client.ensureAuthenticated(),
    /Signin failed with response code 401/,
  );
});

test('creates only one profile after checking the available count', async () => {
  const {calls, client} = createClient((method, params) => {
    if (method === 'Browser.getAvailableProfileCreationCount') {
      return {count: 2};
    }
    if (method === 'Browser.createProfile') {
      return {
        profile: {
          id: 'profile-id',
          name: params.name,
          omitted: false,
          ephemeral: false,
        },
      };
    }
    throw new Error(`Unexpected method: ${method}`);
  });

  const profile = await client.createProfile('One profile');

  assert.equal(profile.id, 'profile-id');
  assert.deepEqual(
    calls.map(({method}) => method),
    [
      'Browser.getAvailableProfileCreationCount',
      'Browser.createProfile',
    ],
  );
});

test('selects only an active persistent profile', async () => {
  const profiles = [
    {id: 'omitted', omitted: true, ephemeral: false},
    {id: 'ephemeral', omitted: false, ephemeral: true},
    {id: 'persistent', omitted: false, ephemeral: false},
  ];
  const {client} = createClient(() => ({profiles}));

  const profile = await client.getActivePersistentProfile();

  assert.equal(profile.id, 'persistent');
});
