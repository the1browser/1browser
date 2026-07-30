'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {OneBrowser} = require('../src/client');
const {
  ClientClosedError,
  OneBrowserError,
} = require('../src/errors');

function clientWith(handler = async () => ({}), close = async () => {}) {
  const calls = [];
  const client = new OneBrowser(
    {close},
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

test('logout is explicit and close never sends Browser.logout', async () => {
  const {calls, client} = clientWith(async (method) => {
    assert.equal(method, 'Browser.logout');
    return {success: true, responseCode: 200};
  });
  await client.logout();
  await client.close();
  assert.deepEqual(calls.map(({method}) => method), ['Browser.logout']);
});

test('close is idempotent', async () => {
  let closes = 0;
  const {client} = clientWith(undefined, async () => {
    closes += 1;
  });
  await Promise.all([client.close(), client.close()]);
  assert.equal(closes, 1);
});

test('operations after close reject with ClientClosedError', async () => {
  const {client} = clientWith();
  await client.close();
  await assert.rejects(client.getAuthState(), ClientClosedError);
});

test('an offline auth-state read does not authorize profile operations', async () => {
  const {calls, client} = clientWith(async (method, params) => {
    if (method === 'Browser.getAuthState') {
      return {signedIn: true, state: 'signed_in'};
    }
    if (method === 'Browser.getProfiles') {
      return {profiles: []};
    }
    throw new Error(`Unexpected call: ${method} ${JSON.stringify(params)}`);
  });
  await client.getAuthState({validateOnline: false});
  await client.getProfiles();
  assert.deepEqual(
    calls.map(({method, params}) => ({method, params})),
    [
      {
        method: 'Browser.getAuthState',
        params: {validateOnline: false},
      },
      {
        method: 'Browser.getAuthState',
        params: {validateOnline: true},
      },
      {method: 'Browser.getProfiles', params: undefined},
    ],
  );
});

test('close errors are wrapped consistently and are not retried', async () => {
  let closes = 0;
  const {client} = clientWith(undefined, async () => {
    closes += 1;
    throw new Error('close failed');
  });
  await assert.rejects(
    client.close(),
    (error) =>
      error instanceof OneBrowserError &&
      error.code === 'ERR_ONE_BROWSER_CLOSE',
  );
  await assert.rejects(client.close(), /Unable to close/);
  assert.equal(closes, 1);
});

test('launch closes the browser when bootstrap initialization fails', async () => {
  let closed = false;
  const browser = {
    async newPage() {
      throw new Error('bootstrap failed');
    },
    async close() {
      closed = true;
    },
  };
  const userDataDir = `${__dirname}/.launch-fixture`;
  await assert.rejects(
    OneBrowser.launch({
      executablePath: process.execPath,
      userDataDir,
      puppeteer: {launch: async () => browser},
    }),
    /Unable to launch and initialize/,
  );
  assert.equal(closed, true);
  require('node:fs').rmSync(userDataDir, {recursive: true, force: true});
});

test('launch passes the required persistent headed configuration', async () => {
  let launchOptions;
  let closed = false;
  const cdp = {send: async () => ({})};
  const browser = {
    async newPage() {
      return {
        target() {
          return {createCDPSession: async () => cdp};
        },
      };
    },
    async close() {
      closed = true;
    },
  };
  const userDataDir = `${__dirname}/.launch-success-fixture`;
  const client = await OneBrowser.launch({
    executablePath: process.execPath,
    userDataDir,
    launchArgs: ['--disable-sync'],
    puppeteer: {
      async launch(options) {
        launchOptions = options;
        return browser;
      },
    },
  });

  assert.equal(launchOptions.executablePath, process.execPath);
  assert.equal(launchOptions.headless, false);
  assert.equal(launchOptions.defaultViewport, null);
  assert.deepEqual(launchOptions.args, [
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--disable-sync',
  ]);
  await client.close();
  assert.equal(closed, true);
  require('node:fs').rmSync(userDataDir, {recursive: true, force: true});
});
