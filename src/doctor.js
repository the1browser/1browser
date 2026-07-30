'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  getDefaultUserDataDir,
  resolveConfiguration,
  sanitizeApplicationId,
  validateUserDataDir,
} = require('./config');

const MINIMUM_NODE_VERSION = [22, 12, 0];
const LOCK_FILES = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];

function parseNodeVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version);
  return match ? match.slice(1).map(Number) : undefined;
}

function nodeVersionSupported(version = process.version) {
  const parsed = parseNodeVersion(version);
  if (!parsed) {
    return false;
  }
  for (let index = 0; index < MINIMUM_NODE_VERSION.length; index += 1) {
    if (parsed[index] > MINIMUM_NODE_VERSION[index]) {
      return true;
    }
    if (parsed[index] < MINIMUM_NODE_VERSION[index]) {
      return false;
    }
  }
  return true;
}

function findUserDataLocks(userDataDir, fsApi = fs) {
  return LOCK_FILES
    .map((name) => path.join(userDataDir, name))
    .filter((candidate) => fsApi.existsSync(candidate));
}

function checkWritableDirectory(userDataDir, fsApi = fs) {
  const validated = validateUserDataDir(userDataDir);
  try {
    fsApi.accessSync(validated, fs.constants.W_OK);
  } catch (error) {
    throw new Error(`The user-data directory is not writable: ${validated}`, {
      cause: error,
    });
  }
  return validated;
}

function sdkEntryFor(cwd) {
  try {
    return require.resolve('@1browser/sdk', {paths: [cwd]});
  } catch {
    const packagePath = path.join(cwd, 'package.json');
    const sourcePath = path.join(cwd, 'src', 'index.js');
    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      if (packageJson.name === '@1browser/sdk' && fs.existsSync(sourcePath)) {
        return sourcePath;
      }
    } catch {
      // The caller is neither a generated app nor the SDK checkout.
    }
    return undefined;
  }
}

function passed(name, detail) {
  return {name, ok: true, detail};
}

function failed(name, error) {
  return {
    name,
    ok: false,
    detail: error instanceof Error ? error.message : String(error),
  };
}

async function runDoctor({
  applicationId,
  cwd = process.cwd(),
  env = process.env,
  checkAuth = false,
  configurationOptions = {},
} = {}) {
  const id = sanitizeApplicationId(
    applicationId || path.basename(path.resolve(cwd)),
  );
  const checks = [];
  checks.push(
    nodeVersionSupported()
      ? passed('Node.js', `${process.version} is supported`)
      : failed(
          'Node.js',
          new Error(
            `${process.version} is unsupported; Node.js 22.12.0 or later is required.`,
          ),
        ),
  );

  const sdkEntry = sdkEntryFor(cwd);
  checks.push(
    sdkEntry
      ? passed('SDK installation', sdkEntry)
      : failed(
          'SDK installation',
          new Error('@1browser/sdk is not installed for this application.'),
        ),
  );

  let configuration;
  try {
    configuration = await resolveConfiguration({
      applicationId: id,
      options: configurationOptions,
      env,
      cwd,
    });
    checks.push(
      passed('1Browser executable', configuration.executablePath),
    );
  } catch (error) {
    checks.push(failed('1Browser executable', error));
  }

  let userDataDir = configuration?.userDataDir;
  try {
    userDataDir =
      userDataDir ||
      env.ONE_USER_DATA_DIR?.trim() ||
      getDefaultUserDataDir({applicationId: id, env});
    userDataDir = checkWritableDirectory(userDataDir);
    checks.push(passed('User-data directory', userDataDir));
    const locks = findUserDataLocks(userDataDir);
    checks.push(
      locks.length === 0
        ? passed('User-data lock', 'no active lock files detected')
        : failed(
            'User-data lock',
            new Error(
              `The directory appears to be in use by another browser process: ${locks.join(', ')}`,
            ),
          ),
    );
  } catch (error) {
    checks.push(failed('User-data directory', error));
  }

  if (checkAuth) {
    if (!configuration) {
      checks.push(
        failed(
          'Authentication readiness',
          new Error('Configuration must pass before authentication can be checked.'),
        ),
      );
    } else if (findUserDataLocks(configuration.userDataDir).length > 0) {
      checks.push(
        failed(
          'Authentication readiness',
          new Error('Close the process using this user-data directory first.'),
        ),
      );
    } else {
      const {OneBrowser} = require('./client');
      let client;
      try {
        client = await OneBrowser.launch(configuration);
        const state = await client.getAuthState({validateOnline: true});
        checks.push(
          state.signedIn
            ? passed('Authentication readiness', 'persisted session is signed in')
            : failed(
                'Authentication readiness',
                new Error(
                  'The persisted session is not signed in; credentials or interactive login are required.',
                ),
              ),
        );
      } catch (error) {
        checks.push(failed('Authentication readiness', error));
      } finally {
        await client?.close().catch(() => {});
      }
    }
  }

  return {
    applicationId: id,
    checks,
    ok: checks.every(({ok}) => ok),
  };
}

module.exports = {
  LOCK_FILES,
  checkWritableDirectory,
  findUserDataLocks,
  nodeVersionSupported,
  parseNodeVersion,
  runDoctor,
  sdkEntryFor,
};
