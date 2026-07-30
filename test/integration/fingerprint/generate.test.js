'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  authenticatedFixture,
  enabled,
} = require('../../../scripts/integration-test-support');

test(
  'real browser starts fingerprint generation on a test-owned profile',
  {skip: !enabled('ONE_BROWSER_FINGERPRINT_GENERATE')},
  async (t) => {
    const fixture = await authenticatedFixture(t);
    const profile = await fixture.createProfile('SDK Fingerprint Generate');

    const started = await fixture.client.generateFingerprint({
      profileId: profile.id,
    });
    assert.equal(started, true);
  },
);
