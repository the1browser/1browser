'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {OneBrowser} = require('../src/client');
const {ProfileError, ProxyError} = require('../src/errors');

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

test('proxy wrappers map all five CDP methods and normalize responses', async () => {
  const settings = {
    currentProxy: 'No proxy',
    user: '',
    free: '',
    tor: '',
    datacenter: '',
    mobile: '',
    resident: '',
  };
  const {calls, client} = authenticatedClient((method) =>
    method === 'Browser.checkProxyConnection' ||
    method === 'Browser.requestNewProxy'
      ? {started: true}
      : {settings},
  );

  assert.equal((await client.getProxySettings()).currentProxy, 'No proxy');
  assert.equal(
    (
      await client.setProxySettings({
        profileId: 'Profile 1',
        type: 'User proxy',
        settings: {...settings, user: 'http://host:8080'},
      })
    ).currentProxy,
    'No proxy',
  );
  assert.equal(
    (
      await client.setProxyType({
        profileId: 'Profile 1',
        type: 'No proxy',
      })
    ).currentProxy,
    'No proxy',
  );
  assert.equal(
    await client.checkProxyConnection({profileId: 'Profile 1'}),
    true,
  );
  assert.equal(await client.requestNewProxy(), true);

  assert.deepEqual(calls, [
    {method: 'Browser.getProxySettings', params: {}},
    {
      method: 'Browser.setProxySettings',
      params: {
        profileId: 'Profile 1',
        type: 'User proxy',
        settings: {...settings, user: 'http://host:8080'},
      },
    },
    {
      method: 'Browser.setProxyType',
      params: {profileId: 'Profile 1', type: 'No proxy'},
    },
    {
      method: 'Browser.checkProxyConnection',
      params: {profileId: 'Profile 1'},
    },
    {method: 'Browser.requestNewProxy', params: {}},
  ]);
});

test('proxy wrappers validate types, settings, profile IDs, and responses', async () => {
  const {client} = authenticatedClient(() => ({}));
  await assert.rejects(
    client.setProxyType({type: ''}),
    ProxyError,
  );
  await assert.rejects(
    client.setProxySettings({type: 'User proxy', settings: []}),
    ProxyError,
  );
  await assert.rejects(
    client.getProxySettings({profileId: ''}),
    ProfileError,
  );
  await assert.rejects(client.checkProxyConnection(), ProxyError);
});
