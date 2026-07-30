'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  authenticatedFixture,
  enabled,
} = require('../../../scripts/integration-test-support');

test(
  'real browser reads one and all fingerprint settings',
  {skip: !enabled()},
  async (t) => {
    const fixture = await authenticatedFixture(t);
    const profile = await fixture.selectOrCreateProfile(
      'SDK Fingerprint Read',
    );
    const name =
      process.env.ONE_FINGERPRINT_SETTING?.trim() || 'screen_resolution';

    const setting = await fixture.client.getFingerprintSetting({
      profileId: profile.id,
      name,
    });
    const settings = await fixture.client.getFingerprintSettings({
      profileId: profile.id,
    });

    assert.equal(typeof setting, 'object');
    assert.notEqual(setting, null);
    assert.equal(Array.isArray(setting), false);
    assert.equal(typeof settings, 'object');
    assert.notEqual(settings, null);
    assert.equal(Array.isArray(settings), false);
    assert.ok(Object.keys(settings).length > 0);
  },
);
