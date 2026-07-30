'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const {ConfigurationError} = require('./errors');
const {
  getKnownBrowserInstallPaths,
  platformPath,
} = require('./platform-paths');

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;
}

function isSystemBrowserPath(candidate, platform = process.platform) {
  const basename = platformPath(platform).basename(candidate).toLowerCase();
  return [
    'chrome',
    'chrome.exe',
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium.exe',
    'chromium-browser',
    'google chrome',
    'google chrome.exe',
    'msedge',
    'msedge.exe',
  ].includes(basename);
}

const MAC_BUNDLE_ID = 'com.browser.1browser';
const LINUX_EXECUTABLE_NAMES = [
  'onebrowser-browser-stable',
  'onebrowser-browser-beta',
  'onebrowser-browser-dev',
  'onebrowser-browser',
  '1browser',
];
const WINDOWS_APP_PATH_KEYS = [
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\1browser.exe',
  'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\1browser.exe',
  'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\1browser.exe',
  'HKCU\\Software\\Clients\\StartMenuInternet\\1browser\\shell\\open\\command',
  'HKLM\\Software\\Clients\\StartMenuInternet\\1browser\\shell\\open\\command',
];

function runSystemCommand(commandRunner, command, args) {
  try {
    const result = commandRunner(command, args, {
      encoding: 'utf8',
      windowsHide: true,
    });
    return result?.status === 0 && typeof result.stdout === 'string'
      ? result.stdout
      : '';
  } catch {
    return '';
  }
}

function expandWindowsEnvironment(value, env) {
  return value.replace(/%([^%]+)%/g, (match, name) => {
    const key = Object.keys(env).find(
      (candidate) => candidate.toLowerCase() === name.toLowerCase(),
    );
    return key ? env[key] : match;
  });
}

function registryExecutablePath(output, env) {
  const match = output.match(/REG_(?:EXPAND_)?SZ\s+(.+?)\s*$/im);
  if (!match) {
    return undefined;
  }
  const value = expandWindowsEnvironment(match[1].trim(), env);
  const quoted = value.match(/^"([^"]+\.exe)"/i);
  if (quoted) {
    return quoted[1];
  }
  return value.match(/^(.+?\.exe)(?:\s|$)/i)?.[1];
}

function discoverMacBundlePaths({commandRunner}) {
  const output = runSystemCommand(commandRunner, 'mdfind', [
    `kMDItemCFBundleIdentifier == '${MAC_BUNDLE_ID}'`,
  ]);
  return output
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.endsWith('.app'))
    .map((bundle) =>
      path.posix.join(bundle, 'Contents', 'MacOS', '1browser'),
    );
}

function discoverWindowsRegistryPaths({commandRunner, env}) {
  const results = [];
  for (const key of WINDOWS_APP_PATH_KEYS) {
    const output = runSystemCommand(commandRunner, 'reg.exe', [
      'query',
      key,
      '/ve',
    ]);
    const executablePath = registryExecutablePath(output, env);
    if (executablePath) {
      results.push(executablePath);
    }
  }
  return results;
}

function discoverLinuxPathExecutables({env, cwd = process.cwd()}) {
  const searchPath = nonEmpty(env.PATH);
  if (!searchPath) {
    return [];
  }
  const results = [];
  for (const directory of searchPath.split(path.posix.delimiter)) {
    const base = path.posix.resolve(cwd, directory || '.');
    for (const name of LINUX_EXECUTABLE_NAMES) {
      results.push(path.posix.join(base, name));
    }
  }
  return results;
}

function discoverSystemBrowserPaths({
  platform = process.platform,
  env = process.env,
  cwd = process.cwd(),
  commandRunner = spawnSync,
  systemPaths,
} = {}) {
  if (systemPaths !== undefined) {
    if (
      !Array.isArray(systemPaths) ||
      systemPaths.some((candidate) => typeof candidate !== 'string')
    ) {
      throw new ConfigurationError('systemPaths must be an array of strings.');
    }
    return systemPaths;
  }
  if (platform === 'darwin') {
    return discoverMacBundlePaths({commandRunner});
  }
  if (platform === 'win32') {
    return discoverWindowsRegistryPaths({commandRunner, env});
  }
  if (platform === 'linux') {
    return discoverLinuxPathExecutables({env, cwd});
  }
  return [];
}

function assertExecutable(candidate, {fsApi, platform, source}) {
  if (
    platform !== 'win32' &&
    typeof fsApi.accessSync === 'function'
  ) {
    try {
      fsApi.accessSync(candidate, fs.constants.X_OK);
    } catch (error) {
      throw new ConfigurationError(
        `${source} is not executable: ${candidate}`,
        {
          code: 'ERR_ONE_BROWSER_EXECUTABLE_NOT_EXECUTABLE',
          cause: error,
        },
      );
    }
  }
}

function existingFile(candidate, {fsApi, platform, source}) {
  const resolved =
    platform === 'win32'
      ? path.win32.resolve(candidate)
      : path.resolve(candidate);
  if (isSystemBrowserPath(resolved, platform)) {
    throw new ConfigurationError(
      `${source} points to Chrome or Chromium. Select the native 1Browser executable.`,
      {code: 'ERR_ONE_BROWSER_NOT_NATIVE'},
    );
  }
  try {
    if (!fsApi.existsSync(resolved) || !fsApi.statSync(resolved).isFile()) {
      throw new ConfigurationError(
        `${source} does not identify an installed 1Browser executable: ${resolved}`,
        {code: 'ERR_ONE_BROWSER_EXECUTABLE_NOT_FOUND'},
      );
    }
    assertExecutable(resolved, {fsApi, platform, source});
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }
    throw new ConfigurationError(
      `Unable to inspect the 1Browser executable at ${resolved}.`,
      {code: 'ERR_ONE_BROWSER_EXECUTABLE_NOT_FOUND', cause: error},
    );
  }
  return resolved;
}

function installedCandidates(
  candidates,
  {fsApi, platform, source},
) {
  const installed = [];
  for (const candidate of candidates) {
    if (
      typeof candidate !== 'string' ||
      candidate.trim() === '' ||
      isSystemBrowserPath(candidate, platform)
    ) {
      continue;
    }
    try {
      installed.push(
        existingFile(candidate, {fsApi, platform, source}),
      );
    } catch {
      // Discovery candidates are optional. Explicit paths are validated
      // separately and retain their actionable error.
    }
  }
  return deduplicate(installed, platform, fsApi);
}

function deduplicate(paths, platform, fsApi) {
  const seen = new Set();
  const results = [];
  for (const candidate of paths) {
    let identity = candidate;
    try {
      identity = fsApi.realpathSync(candidate);
    } catch {
      // Existence has already been checked; test doubles and unusual
      // filesystems do not always implement realpath.
    }
    const key =
      platform === 'win32' ? identity.toLowerCase() : identity;
    if (!seen.has(key)) {
      seen.add(key);
      results.push(candidate);
    }
  }
  return results;
}

function findInstalledBrowser(options = {}) {
  const {
    executablePath,
    env = process.env,
    platform = process.platform,
    fsApi = fs,
  } = options;
  const explicit = nonEmpty(executablePath);
  if (explicit) {
    return existingFile(explicit, {
      fsApi,
      platform,
      source: 'executablePath',
    });
  }

  const environmentPath = nonEmpty(env.ONE_BROWSER_PATH);
  if (environmentPath) {
    return existingFile(environmentPath, {
      fsApi,
      platform,
      source: 'ONE_BROWSER_PATH',
    });
  }

  let systemPaths;
  try {
    systemPaths = discoverSystemBrowserPaths({
      platform,
      env,
      cwd: options.cwd,
      commandRunner: options.commandRunner,
      systemPaths: options.systemPaths,
    });
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }
    systemPaths = [];
  }
  const systemInstalled = installedCandidates(systemPaths, {
    fsApi,
    platform,
    source: 'System 1Browser discovery',
  });
  if (systemInstalled.length === 1) {
    return systemInstalled[0];
  }
  if (systemInstalled.length > 1) {
    throw new ConfigurationError(
      'Multiple system-registered 1Browser installations were found. Set executablePath or ONE_BROWSER_PATH to choose one: ' +
        systemInstalled.join(', '),
      {code: 'ERR_ONE_BROWSER_EXECUTABLE_AMBIGUOUS'},
    );
  }

  let knownPaths;
  try {
    knownPaths =
      options.knownPaths ??
      getKnownBrowserInstallPaths({
        platform,
        env,
        homeDir: options.homeDir,
      });
  } catch (error) {
    throw new ConfigurationError(error.message, {
      code: 'ERR_ONE_BROWSER_UNSUPPORTED_PLATFORM',
      cause: error,
    });
  }

  const unique = installedCandidates(knownPaths, {
    fsApi,
    platform,
    source: 'Known 1Browser installation',
  });
  if (unique.length === 1) {
    return unique[0];
  }
  if (unique.length > 1) {
    throw new ConfigurationError(
      'Multiple 1Browser installations were found. Set executablePath or ONE_BROWSER_PATH to choose one: ' +
        unique.join(', '),
      {code: 'ERR_ONE_BROWSER_EXECUTABLE_AMBIGUOUS'},
    );
  }
  throw new ConfigurationError(
    'No native 1Browser installation was found. Install 1Browser or set executablePath/ONE_BROWSER_PATH to its executable.',
    {code: 'ERR_ONE_BROWSER_EXECUTABLE_NOT_FOUND'},
  );
}

module.exports = {
  discoverSystemBrowserPaths,
  findInstalledBrowser,
  isSystemBrowserPath,
  registryExecutablePath,
};
