'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

require('dotenv').config();

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Set ${name} in the environment or .env.`);
  }
  return value;
}

function assertPersistentUserDataDir(userDataDir) {
  const resolved = path.resolve(userDataDir);
  const temporaryRoot = path.resolve(os.tmpdir());
  const relativeToTemporaryRoot = path.relative(temporaryRoot, resolved);
  const isTemporary =
    relativeToTemporaryRoot === '' ||
    (!relativeToTemporaryRoot.startsWith('..') &&
      !path.isAbsolute(relativeToTemporaryRoot));

  if (isTemporary) {
    throw new Error('ONE_USER_DATA_DIR must not be inside the temporary directory.');
  }

  fs.mkdirSync(resolved, {recursive: true, mode: 0o700});
  return resolved;
}

function loadConfig() {
  const browserPath = path.resolve(required('ONE_BROWSER_PATH'));
  if (!fs.existsSync(browserPath)) {
    throw new Error('ONE_BROWSER_PATH does not exist.');
  }

  return {
    browserPath,
    userDataDir: assertPersistentUserDataDir(required('ONE_USER_DATA_DIR')),
    email: process.env.ONE_EMAIL?.trim(),
    password: process.env.ONE_PASSWORD,
    profileName: process.env.ONE_PROFILE_NAME?.trim(),
    proxyUrl: process.env.ONE_PROXY_URL?.trim(),
  };
}

module.exports = {loadConfig};
