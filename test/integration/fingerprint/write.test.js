'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  authenticatedFixture,
  enabled,
  parseEnvironmentValue,
} = require('../../../scripts/integration-test-support');

test(
  'real browser changes a fingerprint setting on a test-owned profile',
  {skip: !enabled('ONE_BROWSER_FINGERPRINT_WRITE')},
  async (t) => {
    const fixture = await authenticatedFixture(t);
    const profile = await fixture.createProfile('SDK Fingerprint Write');
    const name =
      process.env.ONE_FINGERPRINT_SETTING?.trim() || 'screen_resolution';
    const value = parseEnvironmentValue('ONE_FINGERPRINT_TEST_VALUE');

    const updated = await fixture.client.setFingerprintSetting({
      profileId: profile.id,
      name,
      value,
    });
    const confirmed = await fixture.client.getFingerprintSetting({
      profileId: profile.id,
      name,
    });

    assert.equal(typeof updated, 'object');
    assert.notEqual(updated, null);
    assert.deepEqual(confirmed.value, updated.value);
  },
);
