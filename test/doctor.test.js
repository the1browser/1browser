'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  findUserDataLocks,
  nodeVersionSupported,
  parseNodeVersion,
  runDoctor,
} = require('../src/doctor');

const fixtureRoot = path.join(__dirname, `.doctor-${process.pid}`);

test.afterEach(() => {
  fs.rmSync(fixtureRoot, {recursive: true, force: true});
});

test('checks the supported Node.js version boundary', () => {
  assert.deepEqual(parseNodeVersion('v22.12.0'), [22, 12, 0]);
  assert.equal(nodeVersionSupported('22.11.9'), false);
  assert.equal(nodeVersionSupported('22.12.0'), true);
  assert.equal(nodeVersionSupported('23.0.0'), true);
  assert.equal(nodeVersionSupported('not-a-version'), false);
});

test('detects Chromium user-data lock files', () => {
  fs.mkdirSync(fixtureRoot, {recursive: true});
  fs.writeFileSync(path.join(fixtureRoot, 'SingletonLock'), '');
  fs.writeFileSync(path.join(fixtureRoot, 'unrelated'), '');
  assert.deepEqual(findUserDataLocks(fixtureRoot), [
    path.join(fixtureRoot, 'SingletonLock'),
  ]);
});

test('doctor reports SDK, configuration, write access, and locks without auth', async () => {
  const browser = path.join(fixtureRoot, '1browser');
  const userDataDir = path.join(fixtureRoot, 'browser-data');
  fs.mkdirSync(fixtureRoot, {recursive: true});
  fs.writeFileSync(browser, '');
  fs.mkdirSync(userDataDir);
  fs.writeFileSync(path.join(userDataDir, 'SingletonCookie'), '');

  const result = await runDoctor({
    applicationId: 'doctor-test',
    cwd: path.resolve(__dirname, '..'),
    env: {},
    configurationOptions: {
      executablePath: browser,
      userDataDir,
    },
  });

  assert.equal(
    result.checks.find(({name}) => name === 'SDK installation').ok,
    true,
  );
  assert.equal(
    result.checks.find(({name}) => name === '1Browser executable').ok,
    true,
  );
  assert.equal(
    result.checks.find(({name}) => name === 'User-data directory').ok,
    true,
  );
  const lock = result.checks.find(({name}) => name === 'User-data lock');
  assert.equal(lock.ok, false);
  assert.match(lock.detail, /appears to be in use/);
  assert.equal(
    result.checks.some(({name}) => name === 'Authentication readiness'),
    false,
  );
});
