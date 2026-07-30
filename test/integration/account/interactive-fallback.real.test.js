'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  OneBrowser,
  enabled,
  loadEnvironmentConfig,
  positiveInteger,
  requireEnvironment,
} = require('../../../scripts/integration-test-support');

test(
  'real browser completes interactive first run and reuses its session',
  {
    skip: !enabled('ONE_BROWSER_INTERACTIVE_AUTH'),
    timeout: positiveInteger(
      'ONE_INTERACTIVE_AUTH_TEST_TIMEOUT_MS',
      360_000,
    ),
  },
  async () => {
    const userDataDir = requireEnvironment(
      'ONE_INTERACTIVE_USER_DATA_DIR',
    );
    const base = loadEnvironmentConfig({
      ...process.env,
      ONE_USER_DATA_DIR: userDataDir,
      ONE_EMAIL: undefined,
      ONE_PASSWORD: undefined,
    });
    const config = {
      ...base,
      credentials: undefined,
      auth: {
        mode: 'interactive-only',
        interactiveTimeoutMs: positiveInteger(
          'ONE_INTERACTIVE_AUTH_TIMEOUT_MS',
          300_000,
        ),
        pollIntervalMs: 500,
      },
    };

    let interactiveNotifications = 0;
    let client = await OneBrowser.launch(config);
    try {
      const state = await client.ensureAuthenticated({
        onInteractiveLogin(target) {
          interactiveNotifications += 1;
          assert.equal(Number.isInteger(target.windowId), true);
          assert.notEqual(target.targetId, '');
          console.log(
            'Complete sign-in in the opened 1Browser window. ' +
              'The test will continue automatically.',
          );
        },
      });
      assert.equal(state.signedIn, true);
      assert.equal(interactiveNotifications, 1);
      assert.equal(Array.isArray(await client.getProfiles()), true);
    } finally {
      await client.close();
    }

    interactiveNotifications = 0;
    client = await OneBrowser.launch(config);
    try {
      const state = await client.ensureAuthenticated({
        onInteractiveLogin() {
          interactiveNotifications += 1;
        },
      });
      assert.equal(state.signedIn, true);
      assert.equal(interactiveNotifications, 0);
      assert.equal(Array.isArray(await client.getProfiles()), true);
    } finally {
      await client.close();
    }
  },
);
