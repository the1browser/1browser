'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  OneBrowser,
  loadEnvironmentConfig,
} = require('../../../src');

const enabled = process.env.ONE_BROWSER_INTEGRATION === '1';

test(
  'real browser authentication lifecycle and session reuse',
  {skip: !enabled},
  async () => {
    const config = loadEnvironmentConfig();
    let client = await OneBrowser.launch(config);
    try {
      const state = await client.ensureAuthenticated();
      assert.equal(state.signedIn, true);
    } finally {
      await client.close();
    }

    client = await OneBrowser.launch({
      executablePath: config.executablePath,
      userDataDir: config.userDataDir,
    });
    try {
      const state = await client.ensureAuthenticated();
      assert.equal(state.signedIn, true);
    } finally {
      await client.close();
    }
  },
);
