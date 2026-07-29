'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  authenticatedFixture,
  enabled,
  requireEnvironment,
} = require('../../../scripts/integration-test-support');

test(
  'real browser requests a new paid catalog proxy for an explicit profile',
  {skip: !enabled('ONE_BROWSER_PROXY_PAID_REQUEST')},
  async (t) => {
    const fixture = await authenticatedFixture(t);
    const profileId = requireEnvironment('ONE_PROXY_PAID_PROFILE_ID');
    const profiles = await fixture.client.getProfiles();
    assert.ok(
      profiles.some(({id}) => id === profileId),
      'ONE_PROXY_PAID_PROFILE_ID must identify an existing test profile.',
    );

    const started = await fixture.client.requestNewProxy({profileId});
    assert.equal(started, true);
  },
);
