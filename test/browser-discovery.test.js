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

function fakeFileSystem(files, {nonExecutable = [], realpaths = {}} = {}) {
  const existing = new Set(files);
  const blocked = new Set(nonExecutable);
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
    accessSync(candidate) {
      if (blocked.has(candidate)) {
        const error = new Error('permission denied');
        error.code = 'EACCES';
        throw error;
      }
    },
    realpathSync(candidate) {
      return realpaths[candidate] ?? candidate;
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

test('uses the documented native installation paths first', () => {
  assert.deepEqual(
    getKnownBrowserInstallPaths({
      platform: 'darwin',
      env: {},
      homeDir: '/Users/example',
    }).slice(0, 2),
    [
      '/Applications/1browser.app/Contents/MacOS/1browser',
      '/Users/example/Applications/1browser.app/Contents/MacOS/1browser',
    ],
  );
  assert.deepEqual(
    getKnownBrowserInstallPaths({
      platform: 'win32',
      env: {
        LOCALAPPDATA: 'C:\\Users\\example\\AppData\\Local',
        ProgramFiles: 'C:\\Program Files',
        'ProgramFiles(x86)': 'C:\\Program Files (x86)',
      },
      homeDir: 'C:\\Users\\example',
    }).slice(0, 3),
    [
      'C:\\Users\\example\\AppData\\Local\\1browser\\Application\\1browser.exe',
      'C:\\Program Files\\1browser\\Application\\1browser.exe',
      'C:\\Program Files (x86)\\1browser\\Application\\1browser.exe',
    ],
  );
  assert.deepEqual(
    getKnownBrowserInstallPaths({
      platform: 'linux',
      env: {},
      homeDir: '/home/example',
    }).slice(0, 7),
    [
      '/opt/1browser.com/1browser/1browser',
      '/opt/1browser.com/1browser-beta/1browser',
      '/opt/1browser.com/1browser-dev/1browser',
      '/usr/bin/onebrowser-browser-stable',
      '/usr/bin/onebrowser-browser-beta',
      '/usr/bin/onebrowser-browser-dev',
      '/usr/bin/onebrowser-browser',
    ],
  );
});

test('prefers a macOS bundle-ID result over fixed fallback paths', () => {
  const bundle =
    '/Volumes/Applications/1browser.app/Contents/MacOS/1browser';
  const fallback = '/Applications/1browser.app/Contents/MacOS/1browser';
  const result = findInstalledBrowser({
    platform: 'darwin',
    env: {},
    knownPaths: [fallback],
    fsApi: fakeFileSystem([bundle, fallback]),
    commandRunner(command, args) {
      assert.equal(command, 'mdfind');
      assert.match(args[0], /com\.browser\.1browser/);
      return {
        status: 0,
        stdout: '/Volumes/Applications/1browser.app\n',
      };
    },
  });
  assert.equal(result, bundle);
});

test('prefers a Windows registered installation over fixed paths', () => {
  const registered =
    'D:\\Apps\\1browser\\Application\\1browser.exe';
  const fallback =
    'C:\\Program Files\\1browser\\Application\\1browser.exe';
  const result = findInstalledBrowser({
    platform: 'win32',
    env: {},
    knownPaths: [fallback],
    fsApi: fakeFileSystem([registered, fallback]),
    commandRunner(command, args) {
      assert.equal(command, 'reg.exe');
      return args[1].startsWith('HKCU')
        ? {
            status: 0,
            stdout:
              `HKEY_CURRENT_USER\\Software\\...` +
              `\n    (Default)    REG_SZ    "${registered}" -- "%1"\n`,
          }
        : {status: 1, stdout: ''};
    },
  });
  assert.equal(result, registered);
});

test('prefers a Linux executable from PATH over fixed paths', () => {
  const fromPath = '/custom/bin/onebrowser-browser-stable';
  const fallback = '/opt/1browser.com/1browser/1browser';
  const result = findInstalledBrowser({
    platform: 'linux',
    env: {PATH: '/custom/bin:/usr/bin'},
    knownPaths: [fallback],
    fsApi: fakeFileSystem([fromPath, fallback]),
  });
  assert.equal(result, fromPath);
});

test('requires executable permission on macOS and Linux', () => {
  const candidate = '/opt/1browser.com/1browser/1browser';
  assert.throws(
    () =>
      findInstalledBrowser({
        executablePath: candidate,
        platform: 'linux',
        fsApi: fakeFileSystem([candidate], {
          nonExecutable: [candidate],
        }),
      }),
    (error) =>
      error.code === 'ERR_ONE_BROWSER_EXECUTABLE_NOT_EXECUTABLE' &&
      /not executable/.test(error.message),
  );
});

test('deduplicates PATH wrappers that resolve to the same installation', () => {
  const stable = '/usr/bin/onebrowser-browser-stable';
  const generic = '/usr/bin/onebrowser-browser';
  const executable = '/opt/1browser.com/1browser/1browser';
  const result = findInstalledBrowser({
    platform: 'linux',
    env: {PATH: '/usr/bin'},
    knownPaths: [],
    fsApi: fakeFileSystem([stable, generic], {
      realpaths: {
        [stable]: executable,
        [generic]: executable,
      },
    }),
  });
  assert.equal(result, stable);
});

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
        knownPaths: ['/opt/1browser.com/1browser/1browser'],
        fsApi: fakeFileSystem([]),
      }),
    (error) =>
      error.code === 'ERR_ONE_BROWSER_EXECUTABLE_NOT_FOUND' &&
      /Install 1Browser or set/.test(error.message),
  );
});

test('reports ambiguity instead of choosing between installations', () => {
  const candidates = [
    '/opt/1browser.com/1browser/1browser',
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
  const explicit = '/opt/1browser.com/1browser/1browser';
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
  const known = '/opt/1browser.com/1browser/1browser';
  const result = findInstalledBrowser({
    env: {ONE_BROWSER_PATH: environment},
    platform: 'linux',
    knownPaths: [known],
    fsApi: fakeFileSystem([environment, known]),
  });
  assert.equal(result, environment);
});
