'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {OneBrowser} = require('../src/client');
const {AuthenticationError} = require('../src/errors');

function clientWith(handler) {
  const calls = [];
  const client = new OneBrowser(
    {close: async () => {}},
    {
      async send(method, params) {
        calls.push({method, params});
        return handler(method, params);
      },
    },
    {},
  );
  return {calls, client};
}

test('signup is available before authentication and preserves business responses', async () => {
  const {calls, client} = clientWith((method) => {
    assert.equal(method, 'Browser.signup');
    return {success: false, responseCode: 409, body: 'already registered'};
  });

  const response = await client.signup({
    email: ' person@example.com ',
    password: 'secret',
  });

  assert.deepEqual(response, {
    success: false,
    responseCode: 409,
    body: 'already registered',
  });
  assert.deepEqual(calls, [{
    method: 'Browser.signup',
    params: {email: 'person@example.com', password: 'secret'},
  }]);
});

test('successful signup leaves later account operations to confirm auth online', async () => {
  const responses = [
    {success: true, responseCode: 201},
    {signedIn: true, state: 'signed_in'},
    {profiles: []},
  ];
  const {calls, client} = clientWith(() => responses.shift());

  await client.signup({email: 'person@example.com', password: 'secret'});
  await client.getProfiles();

  assert.deepEqual(calls.map(({method}) => method), [
    'Browser.signup',
    'Browser.getAuthState',
    'Browser.getProfiles',
  ]);
});

test('login opens the web login target without requiring authentication', async () => {
  const {calls, client} = clientWith(() => ({
    windowId: 7,
    targetId: 'login-target',
  }));

  assert.deepEqual(await client.login(), {
    windowId: 7,
    targetId: 'login-target',
  });
  assert.deepEqual(calls, [{method: 'Browser.login', params: undefined}]);
});

test('verify requires online authentication and returns the backend response', async () => {
  const {calls, client} = clientWith((method) => {
    if (method === 'Browser.getAuthState') {
      return {signedIn: true, state: 'signed_in'};
    }
    return {success: true, responseCode: 201, body: 'sent'};
  });

  assert.deepEqual(await client.verify(), {
    success: true,
    responseCode: 201,
    body: 'sent',
  });
  assert.deepEqual(calls.map(({method}) => method), [
    'Browser.getAuthState',
    'Browser.verify',
  ]);
});

test('auth operation wrappers validate credentials and response shapes', async () => {
  const {client} = clientWith(() => ({}));
  await assert.rejects(
    client.signup({email: '', password: 'secret'}),
    AuthenticationError,
  );
  await assert.rejects(client.login(), AuthenticationError);
});
