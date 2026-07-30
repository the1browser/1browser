'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {findInstalledBrowser} = require('./browser-discovery');
const {
  ConfigurationError,
} = require('./errors');
const {
  WINDOWS_RESERVED_NAMES,
  getPlatformDataRoot,
  platformPath,
} = require('./platform-paths');

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

function sanitizeApplicationId(applicationId) {
  const value = requireNonEmptyString(applicationId, 'applicationId')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  if (!value) {
    throw new ConfigurationError(
      'applicationId must contain at least one ASCII letter or number.',
    );
  }
  return WINDOWS_RESERVED_NAMES.has(value) ? `${value}-app` : value;
}

function getDefaultUserDataDir({
  applicationId,
  platform = process.platform,
  env = process.env,
  homeDir = os.homedir(),
  fsApi = fs,
} = {}) {
  const sanitized = sanitizeApplicationId(applicationId);
  let root;
  try {
    root = getPlatformDataRoot({platform, env, homeDir});
  } catch (error) {
    throw new ConfigurationError(error.message, {
      code: 'ERR_ONE_BROWSER_UNSUPPORTED_PLATFORM',
      cause: error,
    });
  }
  const paths = platformPath(platform);
  const userDataDir = paths.join(root, sanitized);

  if (
    platform === process.platform &&
    isInsidePath(path.resolve(os.tmpdir()), path.resolve(userDataDir))
  ) {
    throw new ConfigurationError(
      'The platform data directory resolves inside the OS temporary directory.',
    );
  }
  try {
    fsApi.mkdirSync(userDataDir, {recursive: true, mode: 0o700});
    if (!fsApi.statSync(userDataDir).isDirectory()) {
      throw new Error('The created path is not a directory.');
    }
  } catch (error) {
    throw new ConfigurationError(
      `Unable to create the default 1Browser user-data directory: ${userDataDir}`,
      {cause: error},
    );
  }
  return userDataDir;
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

async function readJsonIfPresent(filePath, label, fsApi = fs) {
  try {
    const contents = await fsApi.promises.readFile(filePath, 'utf8');
    const parsed = JSON.parse(contents);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('the root value must be an object');
    }
    return parsed;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {};
    }
    throw new ConfigurationError(
      `Unable to read ${label} at ${filePath}: ${error.message}`,
      {cause: error},
    );
  }
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined);
}

function trimmedOrUndefined(value) {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;
}

async function resolveConfiguration({
  applicationId,
  options = {},
  env = process.env,
  cwd = process.cwd(),
  configPath = path.join(cwd, '.onebrowser', 'config.json'),
  secretsPath = path.join(cwd, '.onebrowser', 'secrets.json'),
  platform = process.platform,
  homeDir = os.homedir(),
  fsApi = fs,
  discoveryOptions = {},
} = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new ConfigurationError('options must be an object.');
  }
  const id = sanitizeApplicationId(applicationId);
  const local = await readJsonIfPresent(
    configPath,
    'ignored local application configuration',
    fsApi,
  );
  const secrets = await readJsonIfPresent(
    secretsPath,
    'ignored local secrets configuration',
    fsApi,
  );
  const localLaunch =
    local.launch && typeof local.launch === 'object' && !Array.isArray(local.launch)
      ? local.launch
      : local;

  const explicitExecutable = trimmedOrUndefined(options.executablePath);
  const environmentExecutable = trimmedOrUndefined(env.ONE_BROWSER_PATH);
  const localExecutable = trimmedOrUndefined(localLaunch.executablePath);
  const executablePath = findInstalledBrowser({
    ...discoveryOptions,
    executablePath:
      explicitExecutable ?? environmentExecutable ?? localExecutable,
    env: {},
    platform,
    homeDir,
    fsApi,
  });

  const explicitUserData = trimmedOrUndefined(options.userDataDir);
  const environmentUserData = trimmedOrUndefined(env.ONE_USER_DATA_DIR);
  const localUserData = trimmedOrUndefined(localLaunch.userDataDir);
  const userDataDir =
    explicitUserData ??
    environmentUserData ??
    localUserData ??
    getDefaultUserDataDir({
      applicationId: id,
      platform,
      env,
      homeDir,
      fsApi,
    });

  const localCredentials =
    local.credentials &&
    typeof local.credentials === 'object' &&
    !Array.isArray(local.credentials)
      ? local.credentials
      : {};
  const secretCredentials =
    secrets.credentials &&
    typeof secrets.credentials === 'object' &&
    !Array.isArray(secrets.credentials)
      ? secrets.credentials
      : secrets;
  const email = firstDefined(
    trimmedOrUndefined(options.credentials?.email),
    trimmedOrUndefined(env.ONE_EMAIL),
    trimmedOrUndefined(secretCredentials.email),
    trimmedOrUndefined(localCredentials.email),
  );
  const password = firstDefined(
    options.credentials?.password,
    env.ONE_PASSWORD,
    secretCredentials.password,
    localCredentials.password,
  );

  return validateLaunchOptions({
    executablePath,
    userDataDir,
    credentials:
      email !== undefined || password !== undefined
        ? {email, password}
        : undefined,
    auth: firstDefined(options.auth, localLaunch.auth),
    launchArgs: firstDefined(options.launchArgs, localLaunch.launchArgs),
    headless: options.headless,
    puppeteer: options.puppeteer,
  });
}

module.exports = {
  getDefaultUserDataDir,
  loadEnvironmentConfig,
  normalizeLaunchArgs,
  resolveConfiguration,
  sanitizeApplicationId,
  validateLaunchOptions,
  validateUserDataDir,
};
