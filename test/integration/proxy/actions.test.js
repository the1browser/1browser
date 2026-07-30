'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  authenticatedFixture,
  enabled,
} = require('../../../scripts/integration-test-support');

test(
  'real browser starts proxy actions and preserves boolean outcomes',
  {skip: !enabled('ONE_BROWSER_PROXY_ACTIONS')},
  async (t) => {
    const fixture = await authenticatedFixture(t);
    const profile = await fixture.createProfile('SDK Proxy Actions');

    const checkStarted = await fixture.client.checkProxyConnection({
      profileId: profile.id,
    });
    const requestStarted = await fixture.client.requestNewProxy({
      profileId: profile.id,
    });

    assert.equal(typeof checkStarted, 'boolean');
    assert.equal(typeof requestStarted, 'boolean');
  },
);
