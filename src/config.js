'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  ConfigurationError,
} = require('./errors');

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ConfigurationError(`${field} must be a non-empty string.`);
  }
  return value.trim();
}

function isInsidePath(parent, child) {
  const relative = path.relative(parent, child);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

function validateUserDataDir(userDataDir) {
  const resolved = path.resolve(
    requireNonEmptyString(userDataDir, 'userDataDir'),
  );
  if (isInsidePath(path.resolve(os.tmpdir()), resolved)) {
    throw new ConfigurationError(
      'userDataDir must be a persistent directory outside the OS temporary directory.',
    );
  }

  try {
    if (fs.existsSync(resolved) && !fs.statSync(resolved).isDirectory()) {
      throw new ConfigurationError('userDataDir must identify a directory.');
    }
    fs.mkdirSync(resolved, {recursive: true, mode: 0o700});
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }
    throw new ConfigurationError('Unable to create or access userDataDir.', {
      cause: error,
    });
  }
  return resolved;
}

function validateExecutablePath(executablePath) {
  const resolved = path.resolve(
    requireNonEmptyString(executablePath, 'executablePath'),
  );
  if (!fs.existsSync(resolved)) {
    throw new ConfigurationError('executablePath does not exist.', {
      code: 'ERR_ONE_BROWSER_EXECUTABLE_NOT_FOUND',
    });
  }
  try {
    if (!fs.statSync(resolved).isFile()) {
      throw new ConfigurationError('executablePath must identify a file.');
    }
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }
    throw new ConfigurationError('Unable to access executablePath.', {
      cause: error,
    });
  }
  return resolved;
}

function userDataArgValue(argument) {
  if (argument === '--user-data-dir') {
    return '';
  }
  if (argument.startsWith('--user-data-dir=')) {
    return argument.slice('--user-data-dir='.length);
  }
  return undefined;
}

function normalizeLaunchArgs(launchArgs, userDataDir) {
  if (launchArgs === undefined) {
    return [];
  }
  if (
    !Array.isArray(launchArgs) ||
    launchArgs.some((argument) => typeof argument !== 'string')
  ) {
    throw new ConfigurationError('launchArgs must be an array of strings.');
  }

  const additional = [];
  for (const argument of launchArgs) {
    const value = userDataArgValue(argument);
    if (value !== undefined) {
      if (!value || path.resolve(value) !== userDataDir) {
        throw new ConfigurationError(
          'launchArgs must not override userDataDir.',
        );
      }
      continue;
    }
    if (
      argument === '--remote-debugging-port' ||
      (argument.startsWith('--remote-debugging-port=') &&
        argument !== '--remote-debugging-port=0')
    ) {
      throw new ConfigurationError(
        'launchArgs must not override --remote-debugging-port=0.',
      );
    }
    if (argument === '--headless' || argument.startsWith('--headless=')) {
      throw new ConfigurationError(
        'launchArgs must not enable headless mode.',
      );
    }
    if (
      argument !== '--remote-debugging-port=0' &&
      argument !== '--no-first-run'
    ) {
      additional.push(argument);
    }
  }
  return additional;
}

function validateLaunchOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new ConfigurationError('Launch options are required.');
  }
  if (options.headless !== undefined && options.headless !== false) {
    throw new ConfigurationError('1Browser must be launched with headless: false.');
  }

  const executablePath = validateExecutablePath(options.executablePath);
  const userDataDir = validateUserDataDir(options.userDataDir);
  const launchArgs = normalizeLaunchArgs(options.launchArgs, userDataDir);
  const credentials = options.credentials;
  if (
    credentials !== undefined &&
    (!credentials ||
      typeof credentials !== 'object' ||
      Array.isArray(credentials))
  ) {
    throw new ConfigurationError('credentials must be an object.');
  }
  if (
    options.auth !== undefined &&
    (!options.auth ||
      typeof options.auth !== 'object' ||
      Array.isArray(options.auth))
  ) {
    throw new ConfigurationError('auth must be an object.');
  }

  return {
    executablePath,
    userDataDir,
    credentials: credentials
      ? {
          email:
            typeof credentials.email === 'string'
              ? credentials.email.trim()
              : credentials.email,
          password: credentials.password,
        }
      : undefined,
    auth: options.auth,
    // Internal dependency injection used by unit tests.
    puppeteer: options.puppeteer,
    launchArgs,
  };
}

function loadEnvironmentConfig(env = process.env) {
  const executablePath = env.ONE_BROWSER_PATH?.trim();
  const userDataDir = env.ONE_USER_DATA_DIR?.trim();
  if (!executablePath) {
    throw new ConfigurationError(
      'Set ONE_BROWSER_PATH in the environment or local configuration.',
    );
  }
  if (!userDataDir) {
    throw new ConfigurationError(
      'Set ONE_USER_DATA_DIR in the environment or local configuration.',
    );
  }

  const email = env.ONE_EMAIL?.trim();
  const password = env.ONE_PASSWORD;
  return validateLaunchOptions({
    executablePath,
    userDataDir,
    credentials:
      email !== undefined || password !== undefined
        ? {email, password}
        : undefined,
  });
}

module.exports = {
  loadEnvironmentConfig,
  normalizeLaunchArgs,
  validateLaunchOptions,
  validateUserDataDir,
};
