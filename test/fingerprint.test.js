'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {OneBrowser} = require('../src/client');
const {FingerprintError, ProfileError} = require('../src/errors');

function authenticatedClient(handler) {
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
  client.authenticated = true;
  return {calls, client};
}

test('fingerprint wrappers map all four CDP methods and normalize responses', async () => {
  const {calls, client} = authenticatedClient((method, params) => {
    if (method === 'Browser.getFingerprintSetting') {
      return {setting: {value: '800x600'}};
    }
    if (method === 'Browser.getFingerprintSettings') {
      return {settings: {screen_resolution: {value: '800x600'}}};
    }
    if (method === 'Browser.setFingerprintSetting') {
      return {setting: {value: params.value}};
    }
    return {started: true};
  });

  assert.deepEqual(
    await client.getFingerprintSetting({
      profileId: 'Profile 1',
      name: 'screen_resolution',
    }),
    {value: '800x600'},
  );
  assert.deepEqual(await client.getFingerprintSettings(), {
    screen_resolution: {value: '800x600'},
  });
  assert.deepEqual(
    await client.setFingerprintSetting({
      profileId: 'Profile 1',
      name: 'screen_resolution',
      value: '1024x768',
    }),
    {value: '1024x768'},
  );
  assert.equal(
    await client.generateFingerprint({profileId: 'Profile 1'}),
    true,
  );

  assert.deepEqual(calls, [
    {
      method: 'Browser.getFingerprintSetting',
      params: {profileId: 'Profile 1', name: 'screen_resolution'},
    },
    {
      method: 'Browser.getFingerprintSettings',
      params: {},
    },
    {
      method: 'Browser.setFingerprintSetting',
      params: {
        profileId: 'Profile 1',
        name: 'screen_resolution',
        value: '1024x768',
      },
    },
    {
      method: 'Browser.generateFingerprint',
      params: {profileId: 'Profile 1'},
    },
  ]);
});

test('fingerprint wrappers validate names, values, profile IDs, and responses', async () => {
  const {client} = authenticatedClient(() => ({}));
  await assert.rejects(
    client.getFingerprintSetting({name: ''}),
    FingerprintError,
  );
  await assert.rejects(
    client.setFingerprintSetting({name: 'setting'}),
    FingerprintError,
  );
  await assert.rejects(
    client.generateFingerprint({profileId: ''}),
    ProfileError,
  );
  await assert.rejects(client.getFingerprintSettings(), FingerprintError);
});
