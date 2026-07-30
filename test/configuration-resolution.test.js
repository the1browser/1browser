'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  getDefaultUserDataDir,
  resolveConfiguration,
  sanitizeApplicationId,
} = require('../src/config');

const fixtureRoot = path.join(
  __dirname,
  `.configuration-resolution-${process.pid}`,
);

test.afterEach(() => {
  fs.rmSync(fixtureRoot, {recursive: true, force: true});
});

test('sanitizes application IDs into safe stable directory names', () => {
  assert.equal(sanitizeApplicationId(' Amazon Search / iPhone '), 'amazon-search-iphone');
  assert.equal(sanitizeApplicationId('Crème brûlée'), 'creme-brulee');
  assert.equal(sanitizeApplicationId('CON'), 'con-app');
  assert.throws(() => sanitizeApplicationId('---'), /ASCII letter or number/);
});

test('default user-data paths are stable and platform-specific', () => {
  const created = [];
  const fsApi = {
    mkdirSync(candidate) {
      created.push(candidate);
    },
    statSync() {
      return {isDirectory: () => true};
    },
  };
  const fixtures = [
    {
      platform: 'darwin',
      homeDir: '/Users/example',
      env: {},
      expected:
        '/Users/example/Library/Application Support/1Browser/Automation/amazon-search',
    },
    {
      platform: 'win32',
      homeDir: 'C:\\Users\\example',
      env: {LOCALAPPDATA: 'D:\\ApplicationData'},
      expected: 'D:\\ApplicationData\\1Browser\\Automation\\amazon-search',
    },
    {
      platform: 'linux',
      homeDir: '/home/example',
      env: {XDG_DATA_HOME: '/data/example'},
      expected: '/data/example/1browser/automation/amazon-search',
    },
  ];

  for (const fixture of fixtures) {
    const first = getDefaultUserDataDir({
      applicationId: 'Amazon Search',
      fsApi,
      ...fixture,
    });
    const second = getDefaultUserDataDir({
      applicationId: 'Amazon Search',
      fsApi,
      ...fixture,
    });
    assert.equal(first, fixture.expected);
    assert.equal(second, fixture.expected);
  }
  assert.equal(created.length, fixtures.length * 2);
});

test('configuration resolves explicit options before environment and local config', async () => {
  const explicitBrowser = path.join(fixtureRoot, 'explicit', '1browser');
  const environmentBrowser = path.join(fixtureRoot, 'environment', '1browser');
  const localBrowser = path.join(fixtureRoot, 'local', '1browser');
  for (const browser of [explicitBrowser, environmentBrowser, localBrowser]) {
    fs.mkdirSync(path.dirname(browser), {recursive: true});
    fs.writeFileSync(browser, '');
  }
  const localDirectory = path.join(fixtureRoot, 'application');
  fs.mkdirSync(path.join(localDirectory, '.onebrowser'), {recursive: true});
  fs.writeFileSync(
    path.join(localDirectory, '.onebrowser', 'config.json'),
    JSON.stringify({
      executablePath: localBrowser,
      userDataDir: path.join(fixtureRoot, 'local-data'),
      credentials: {email: 'local@example.com', password: 'local-secret'},
    }),
  );

  const resolved = await resolveConfiguration({
    applicationId: 'precedence-test',
    cwd: localDirectory,
    options: {
      executablePath: explicitBrowser,
      userDataDir: path.join(fixtureRoot, 'explicit-data'),
      credentials: {
        email: 'explicit@example.com',
        password: 'explicit-secret',
      },
    },
    env: {
      ONE_BROWSER_PATH: environmentBrowser,
      ONE_USER_DATA_DIR: path.join(fixtureRoot, 'environment-data'),
      ONE_EMAIL: 'environment@example.com',
      ONE_PASSWORD: 'environment-secret',
    },
  });

  assert.equal(resolved.executablePath, explicitBrowser);
  assert.equal(
    resolved.userDataDir,
    path.join(fixtureRoot, 'explicit-data'),
  );
  assert.deepEqual(resolved.credentials, {
    email: 'explicit@example.com',
    password: 'explicit-secret',
  });
});

test('environment configuration takes precedence over ignored local config', async () => {
  const environmentBrowser = path.join(fixtureRoot, 'environment', '1browser');
  const localBrowser = path.join(fixtureRoot, 'local', '1browser');
  for (const browser of [environmentBrowser, localBrowser]) {
    fs.mkdirSync(path.dirname(browser), {recursive: true});
    fs.writeFileSync(browser, '');
  }
  const application = path.join(fixtureRoot, 'application');
  fs.mkdirSync(path.join(application, '.onebrowser'), {recursive: true});
  fs.writeFileSync(
    path.join(application, '.onebrowser', 'config.json'),
    JSON.stringify({
      executablePath: localBrowser,
      userDataDir: path.join(fixtureRoot, 'local-data'),
    }),
  );
  const resolved = await resolveConfiguration({
    applicationId: 'environment-precedence',
    cwd: application,
    env: {
      ONE_BROWSER_PATH: environmentBrowser,
      ONE_USER_DATA_DIR: path.join(fixtureRoot, 'environment-data'),
    },
  });
  assert.equal(resolved.executablePath, environmentBrowser);
  assert.equal(
    resolved.userDataDir,
    path.join(fixtureRoot, 'environment-data'),
  );
});

test('ignored local config is used before native discovery and defaults', async () => {
  const browser = path.join(fixtureRoot, 'local', '1browser');
  const application = path.join(fixtureRoot, 'application');
  const userDataDir = path.join(fixtureRoot, 'local-data');
  fs.mkdirSync(path.dirname(browser), {recursive: true});
  fs.writeFileSync(browser, '');
  fs.mkdirSync(path.join(application, '.onebrowser'), {recursive: true});
  fs.writeFileSync(
    path.join(application, '.onebrowser', 'config.json'),
    JSON.stringify({executablePath: browser, userDataDir}),
  );
  const resolved = await resolveConfiguration({
    applicationId: 'local-resolution',
    cwd: application,
    env: {},
  });
  assert.equal(resolved.executablePath, browser);
  assert.equal(resolved.userDataDir, userDataDir);
});
