'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {OneBrowser} = require('../../../src');

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return {promise, resolve};
}

test('controlled interactive auth gates profile calls until signed in', async () => {
  const stateTransition = deferred();
  const loginOpened = deferred();
  const calls = [];
  let authReads = 0;
  const client = new OneBrowser(
    {close: async () => {}},
    {
      async send(method, params) {
        calls.push({method, params});
        if (method === 'Browser.getAuthState') {
          authReads += 1;
          return authReads === 1
            ? {signedIn: false, state: 'signed_out'}
            : stateTransition.promise;
        }
        if (method === 'Browser.login') {
          loginOpened.resolve();
          return {windowId: 41, targetId: 'interactive-login'};
        }
        if (method === 'Browser.getProfiles') {
          return {profiles: [{id: 'profile-1', name: 'Profile 1'}]};
        }
        throw new Error(`Unexpected CDP method: ${method}`);
      },
    },
    {auth: {mode: 'auto'}},
  );

  const profilesPromise = client.getProfiles();
  await loginOpened.promise;
  assert.equal(
    calls.some(({method}) => method === 'Browser.getProfiles'),
    false,
  );

  stateTransition.resolve({signedIn: true, state: 'signed_in'});
  assert.deepEqual(await profilesPromise, [
    {id: 'profile-1', name: 'Profile 1'},
  ]);
  assert.deepEqual(
    calls.map(({method}) => method),
    [
      'Browser.getAuthState',
      'Browser.login',
      'Browser.getAuthState',
      'Browser.getProfiles',
    ],
  );
  await client.close();
});

test('controlled concurrent profile calls open one login target', async () => {
  const stateTransition = deferred();
  const loginOpened = deferred();
  let authReads = 0;
  let loginCalls = 0;
  let profileCalls = 0;
  const client = new OneBrowser(
    {close: async () => {}},
    {
      async send(method) {
        if (method === 'Browser.getAuthState') {
          authReads += 1;
          return authReads === 1
            ? {signedIn: false, state: 'signed_out'}
            : stateTransition.promise;
        }
        if (method === 'Browser.login') {
          loginCalls += 1;
          loginOpened.resolve();
          return {windowId: 42, targetId: 'interactive-login'};
        }
        if (method === 'Browser.getProfiles') {
          profileCalls += 1;
          return {profiles: []};
        }
        throw new Error(`Unexpected CDP method: ${method}`);
      },
    },
    {},
  );

  const pending = [
    client.getProfiles(),
    client.getProfiles(),
    client.getProfiles(),
  ];
  await loginOpened.promise;
  assert.equal(loginCalls, 1);
  assert.equal(profileCalls, 0);
  stateTransition.resolve({signedIn: true, state: 'signed_in'});
  await Promise.all(pending);
  assert.equal(loginCalls, 1);
  assert.equal(profileCalls, 3);
  await client.close();
});
