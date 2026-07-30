'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  authenticatedFixture,
  enabled,
} = require('../../../scripts/integration-test-support');

test(
  'real browser requests email verification for the current test account',
  {skip: !enabled('ONE_BROWSER_VERIFY')},
  async (t) => {
    const {client} = await authenticatedFixture(t);
    const response = await client.verify();

    assert.equal(typeof response.success, 'boolean');
    assert.equal(Number.isInteger(response.responseCode), true);
    assert.equal(
      response.success,
      true,
      `Verification failed with response code ${response.responseCode}.`,
    );
  },
);
