'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  findInstalledBrowser,
} = require('../src/browser-discovery');
const {
  getKnownBrowserInstallPaths,
} = require('../src/platform-paths');

function fakeFileSystem(files) {
  const existing = new Set(files);
  return {
    existsSync(candidate) {
      return existing.has(candidate);
    },
    statSync(candidate) {
      if (!existing.has(candidate)) {
        const error = new Error('not found');
        error.code = 'ENOENT';
        throw error;
      }
      return {isFile: () => true};
    },
    realpathSync(candidate) {
      return candidate;
    },
  };
}

function expected(candidate, platform) {
  return platform === 'win32'
    ? path.win32.resolve(candidate)
    : path.resolve(candidate);
}

for (const fixture of [
  {
    name: 'macOS',
    platform: 'darwin',
    env: {},
    homeDir: '/Users/example',
  },
  {
    name: 'Windows',
    platform: 'win32',
    env: {LOCALAPPDATA: 'C:\\Users\\example\\AppData\\Local'},
    homeDir: 'C:\\Users\\example',
  },
  {
    name: 'Linux',
    platform: 'linux',
    env: {},
    homeDir: '/home/example',
  },
]) {
  test(`discovers a known ${fixture.name} 1Browser installation`, () => {
    const [candidate] = getKnownBrowserInstallPaths(fixture);
    const result = findInstalledBrowser({
      ...fixture,
      knownPaths: [candidate],
      fsApi: fakeFileSystem([candidate]),
    });
    assert.equal(result, expected(candidate, fixture.platform));
    assert.match(result.toLowerCase(), /1browser/);
  });
}

test('never falls back to Chrome or Chromium', () => {
  const chrome = '/usr/bin/google-chrome';
  assert.throws(
    () =>
      findInstalledBrowser({
        platform: 'linux',
        env: {},
        knownPaths: [chrome],
        fsApi: fakeFileSystem([chrome]),
      }),
    (error) =>
      error.code === 'ERR_ONE_BROWSER_EXECUTABLE_NOT_FOUND' &&
      !error.message.includes('returned Chrome'),
  );
});

test('rejects an explicit Chrome executable', () => {
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  assert.throws(
    () =>
      findInstalledBrowser({
        executablePath: chrome,
        platform: 'darwin',
        fsApi: fakeFileSystem([chrome]),
      }),
    (error) => error.code === 'ERR_ONE_BROWSER_NOT_NATIVE',
  );
});

test('reports a missing native browser with an actionable error', () => {
  assert.throws(
    () =>
      findInstalledBrowser({
        platform: 'linux',
        env: {},
        knownPaths: ['/opt/1browser/1browser'],
        fsApi: fakeFileSystem([]),
      }),
    (error) =>
      error.code === 'ERR_ONE_BROWSER_EXECUTABLE_NOT_FOUND' &&
      /Install 1Browser or set/.test(error.message),
  );
});

test('reports ambiguity instead of choosing between installations', () => {
  const candidates = [
    '/opt/1browser/1browser',
    '/usr/local/bin/1browser',
  ];
  assert.throws(
    () =>
      findInstalledBrowser({
        platform: 'linux',
        env: {},
        knownPaths: candidates,
        fsApi: fakeFileSystem(candidates),
      }),
    (error) =>
      error.code === 'ERR_ONE_BROWSER_EXECUTABLE_AMBIGUOUS' &&
      candidates.every((candidate) => error.message.includes(candidate)),
  );
});

test('explicit executablePath takes precedence over the environment', () => {
  const explicit = '/opt/1browser/1browser';
  const environment = '/usr/local/bin/1browser';
  const result = findInstalledBrowser({
    executablePath: explicit,
    env: {ONE_BROWSER_PATH: environment},
    platform: 'linux',
    fsApi: fakeFileSystem([explicit, environment]),
  });
  assert.equal(result, explicit);
});

test('ONE_BROWSER_PATH takes precedence over known locations', () => {
  const environment = '/custom/1browser';
  const known = '/opt/1browser/1browser';
  const result = findInstalledBrowser({
    env: {ONE_BROWSER_PATH: environment},
    platform: 'linux',
    knownPaths: [known],
    fsApi: fakeFileSystem([environment, known]),
  });
  assert.equal(result, environment);
});
