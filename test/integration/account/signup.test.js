'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  OneBrowser,
  enabled,
  loadEnvironmentConfig,
  requireEnvironment,
} = require('../../../scripts/integration-test-support');

test(
  'real browser signs up a unique test account and confirms its session',
  {skip: !enabled('ONE_BROWSER_SIGNUP')},
  async (t) => {
    const baseConfig = loadEnvironmentConfig();
    const userDataDir = requireEnvironment('ONE_SIGNUP_USER_DATA_DIR');
    assert.notEqual(
      path.resolve(userDataDir),
      baseConfig.userDataDir,
      'ONE_SIGNUP_USER_DATA_DIR must differ from ONE_USER_DATA_DIR.',
    );

    const credentials = {
      email: requireEnvironment('ONE_SIGNUP_EMAIL'),
      password: requireEnvironment('ONE_SIGNUP_PASSWORD'),
    };
    const client = await OneBrowser.launch({
      executablePath: baseConfig.executablePath,
      userDataDir,
    });
    t.after(() => client.close());

    const response = await client.signup(credentials);
    assert.equal(
      response.success,
      true,
      `Signup failed with response code ${response.responseCode}.`,
    );
    const state = await client.ensureAuthenticated(credentials);
    assert.equal(state.signedIn, true);
  },
);
