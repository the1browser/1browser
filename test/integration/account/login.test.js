'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  OneBrowser,
  enabled,
  loadEnvironmentConfig,
} = require('../../../scripts/integration-test-support');

test(
  'real browser opens the web login target before SDK authentication',
  {skip: !enabled()},
  async (t) => {
    const client = await OneBrowser.launch(loadEnvironmentConfig());
    t.after(() => client.close());

    const target = await client.login();
    assert.equal(Number.isInteger(target.windowId), true);
    assert.equal(typeof target.targetId, 'string');
    assert.notEqual(target.targetId, '');
  },
);
