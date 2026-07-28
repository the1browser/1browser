'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  loadEnvironmentConfig,
  validateLaunchOptions,
} = require('../src/config');
const {ConfigurationError} = require('../src/errors');

const fixtureRoot = path.join(__dirname, '.config-fixtures');

test.afterEach(() => {
  fs.rmSync(fixtureRoot, {recursive: true, force: true});
});

test('requires an executable path', () => {
  assert.throws(
    () =>
      validateLaunchOptions({
        userDataDir: path.join(fixtureRoot, 'data'),
      }),
    ConfigurationError,
  );
});

test('rejects a nonexistent executable', () => {
  assert.throws(
    () =>
      validateLaunchOptions({
        executablePath: path.join(fixtureRoot, 'missing-browser'),
        userDataDir: path.join(fixtureRoot, 'data'),
      }),
    (error) =>
      error instanceof ConfigurationError &&
      error.code === 'ERR_ONE_BROWSER_EXECUTABLE_NOT_FOUND',
  );
});

test('requires a persistent user-data directory', () => {
  assert.throws(
    () => validateLaunchOptions({executablePath: process.execPath}),
    ConfigurationError,
  );
});

test('rejects a user-data directory inside the OS temporary directory', () => {
  assert.throws(
    () =>
      validateLaunchOptions({
        executablePath: process.execPath,
        userDataDir: path.join(os.tmpdir(), 'onebrowser-temporary-data'),
      }),
    /persistent directory outside the OS temporary directory/,
  );
});

test('creates and resolves the requested user-data directory', () => {
  const requested = path.join(fixtureRoot, 'nested', 'data');
  const result = validateLaunchOptions({
    executablePath: process.execPath,
    userDataDir: requested,
  });

  assert.equal(result.userDataDir, path.resolve(requested));
  assert.equal(fs.statSync(requested).isDirectory(), true);
});

test('rejects a conflicting user-data launch argument', () => {
  assert.throws(
    () =>
      validateLaunchOptions({
        executablePath: process.execPath,
        userDataDir: path.join(fixtureRoot, 'data'),
        launchArgs: ['--user-data-dir=/some/other/path'],
      }),
    /must not override userDataDir/,
  );
});

test('deduplicates an identical user-data launch argument', () => {
  const userDataDir = path.join(fixtureRoot, 'data');
  const result = validateLaunchOptions({
    executablePath: process.execPath,
    userDataDir,
    launchArgs: [`--user-data-dir=${userDataDir}`, '--disable-sync'],
  });
  assert.deepEqual(result.launchArgs, ['--disable-sync']);
});

test('rejects launch arguments that enable headless mode', () => {
  assert.throws(
    () =>
      validateLaunchOptions({
        executablePath: process.execPath,
        userDataDir: path.join(fixtureRoot, 'data'),
        launchArgs: ['--headless=new'],
      }),
    /must not enable headless/,
  );
});

test('environment helper does not include credential values in errors', () => {
  const secret = 'do-not-print-this';
  assert.throws(
    () =>
      loadEnvironmentConfig({
        ONE_BROWSER_PATH: path.join(fixtureRoot, 'missing'),
        ONE_USER_DATA_DIR: path.join(fixtureRoot, 'data'),
        ONE_EMAIL: 'person@example.com',
        ONE_PASSWORD: secret,
      }),
    (error) => !error.message.includes(secret),
  );
});
