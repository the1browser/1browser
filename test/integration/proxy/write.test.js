'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  authenticatedFixture,
  enabled,
  requireEnvironment,
} = require('../../../scripts/integration-test-support');

function writableSettings(settings, user) {
  return {
    user,
    free: settings.free ?? '',
    tor: settings.tor ?? '',
    datacenter: settings.datacenter ?? '',
    mobile: settings.mobile ?? '',
    resident: settings.resident ?? '',
  };
}

test(
  'real browser changes proxy settings and type on a test-owned profile',
  {skip: !enabled('ONE_BROWSER_PROXY_WRITE')},
  async (t) => {
    const fixture = await authenticatedFixture(t);
    const profile = await fixture.createProfile('SDK Proxy Write');
    const current = await fixture.client.getProxySettings({
      profileId: profile.id,
    });

    const configured = await fixture.client.setProxySettings({
      profileId: profile.id,
      type: 'User proxy',
      settings: writableSettings(
        current,
        requireEnvironment('ONE_PROXY_TEST_URL'),
      ),
    });
    assert.equal(configured.currentProxy, 'User proxy');

    const disabled = await fixture.client.setProxyType({
      profileId: profile.id,
      type: 'No proxy',
    });
    assert.equal(disabled.currentProxy, 'No proxy');
  },
);
