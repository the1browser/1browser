'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  authenticatedFixture,
  enabled,
} = require('../../../scripts/integration-test-support');

test(
  'real browser reads proxy settings for a persistent profile',
  {skip: !enabled()},
  async (t) => {
    const fixture = await authenticatedFixture(t);
    const profile = await fixture.selectOrCreateProfile('SDK Proxy Read');

    const settings = await fixture.client.getProxySettings({
      profileId: profile.id,
    });
    assert.equal(typeof settings, 'object');
    assert.notEqual(settings, null);
    assert.equal(Array.isArray(settings), false);
    assert.equal(typeof settings.currentProxy, 'string');
  },
);
