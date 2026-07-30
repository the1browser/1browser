'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {ensureAuthenticated} = require('../src/auth');
const {
  AuthenticationError,
  AuthenticationTimeoutError,
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

test('reuses a signed-in session without credentials', async () => {
  const {calls, cdp} = session(() => ({
    signedIn: true,
    state: 'signed_in',
  }));
  const state = await ensureAuthenticated(cdp, {});
  assert.equal(state.signedIn, true);
  assert.deepEqual(calls, [
    {
      method: 'Browser.getAuthState',
      params: {validateOnline: true},
    },
  ]);
});

test('signs in and confirms online authentication', async () => {
  const states = [
    {signedIn: false, state: 'signed_out'},
    {signedIn: false, state: 'unknown'},
    {signedIn: true, state: 'signed_in'},
  ];
  const {calls, cdp} = session((method) => {
    if (method === 'Browser.getAuthState') {
      return states.shift();
    }
    return {success: true, responseCode: 200};
  });

  const state = await ensureAuthenticated(
    cdp,
    {credentials: {email: 'person@example.com', password: 'secret'}},
    {timeoutMs: 100, pollIntervalMs: 1},
  );

  assert.equal(state.signedIn, true);
  assert.deepEqual(
    calls.map(({method}) => method),
    [
      'Browser.getAuthState',
      'Browser.signin',
      'Browser.getAuthState',
      'Browser.getAuthState',
    ],
  );
});

test('method credentials override launch credentials', async () => {
  const states = [
    {signedIn: false, state: 'signed_out'},
    {signedIn: true, state: 'signed_in'},
  ];
  const {calls, cdp} = session((method) =>
    method === 'Browser.getAuthState'
      ? states.shift()
      : {success: true, responseCode: 200},
  );
  await ensureAuthenticated(
    cdp,
    {credentials: {email: 'old@example.com', password: 'old-secret'}},
    {
      email: 'new@example.com',
      password: 'new-secret',
      timeoutMs: 20,
      pollIntervalMs: 1,
    },
  );
  assert.deepEqual(calls[1], {
    method: 'Browser.signin',
    params: {email: 'new@example.com', password: 'new-secret'},
  });
});

test('throws when credentials are required but unavailable', async () => {
  const {cdp} = session(() => ({signedIn: false, state: 'expired'}));
  await assert.rejects(
    ensureAuthenticated(cdp, {}),
    (error) =>
      error instanceof AuthenticationError &&
      error.code === 'ERR_ONE_BROWSER_AUTH_REQUIRED',
  );
});

test('rejects an unsuccessful sign-in response without exposing credentials', async () => {
  const secret = 'hidden-secret';
  const {cdp} = session((method) =>
    method === 'Browser.getAuthState'
      ? {signedIn: false, state: 'signed_out'}
      : {success: false, responseCode: 401},
  );
  await assert.rejects(
    ensureAuthenticated(cdp, {
      credentials: {email: 'person@example.com', password: secret},
    }),
    (error) =>
      error instanceof AuthenticationError &&
      error.message.includes('401') &&
      !error.message.includes(secret),
  );
});

test('times out while polling an unconfirmed sign-in', async () => {
  const {cdp} = session((method) =>
    method === 'Browser.getAuthState'
      ? {signedIn: false, state: 'unknown'}
      : {success: true, responseCode: 200},
  );
  await assert.rejects(
    ensureAuthenticated(
      cdp,
      {credentials: {email: 'person@example.com', password: 'secret'}},
      {timeoutMs: 5, pollIntervalMs: 1},
    ),
    AuthenticationTimeoutError,
  );
});
