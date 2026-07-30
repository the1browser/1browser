'use strict';

const fs = require('node:fs');
const path = require('node:path');

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

  const installed = [];
  for (const candidate of knownPaths) {
    if (isSystemBrowserPath(candidate, platform)) {
      continue;
    }
    try {
      if (fsApi.existsSync(candidate) && fsApi.statSync(candidate).isFile()) {
        installed.push(
          platform === 'win32'
            ? path.win32.resolve(candidate)
            : path.resolve(candidate),
        );
      }
    } catch {
      // An inaccessible known location is not an installed candidate.
    }
  }

  const unique = deduplicate(installed, platform, fsApi);
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
  findInstalledBrowser,
  isSystemBrowserPath,
};
