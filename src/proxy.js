'use strict';

const {ProxyError} = require('./errors');
const {validateProfileId} = require('./profiles');

function optionsObject(options, required = false) {
  if (options === undefined && !required) {
    return {};
  }
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new ProxyError('Proxy options must be an object.');
  }
  return options;
}

function optionalProfileParams(options) {
  return options.profileId === undefined
    ? {}
    : {profileId: validateProfileId(options.profileId)};
}

function proxyType(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ProxyError('type must be a non-empty string.');
  }
  return value.trim();
}

function responseObject(response, method) {
  const settings = response?.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new ProxyError(`${method} returned invalid settings.`);
  }
  return settings;
}

function started(response, method) {
  if (typeof response?.started !== 'boolean') {
    throw new ProxyError(`${method} returned an invalid response.`);
  }
  return response.started;
}

async function getProxySettings(cdp, options) {
  const resolved = optionsObject(options);
  return responseObject(
    await cdp.send(
      'Browser.getProxySettings',
      optionalProfileParams(resolved),
    ),
    'Browser.getProxySettings',
  );
}

async function setProxySettings(cdp, options) {
  const resolved = optionsObject(options, true);
  if (
    !resolved.settings ||
    typeof resolved.settings !== 'object' ||
    Array.isArray(resolved.settings)
  ) {
    throw new ProxyError('settings must be an object.');
  }
  return responseObject(
    await cdp.send('Browser.setProxySettings', {
      ...optionalProfileParams(resolved),
      type: proxyType(resolved.type),
      settings: resolved.settings,
    }),
    'Browser.setProxySettings',
  );
}

async function setProxyType(cdp, options) {
  const resolved = optionsObject(options, true);
  return responseObject(
    await cdp.send('Browser.setProxyType', {
      ...optionalProfileParams(resolved),
      type: proxyType(resolved.type),
    }),
    'Browser.setProxyType',
  );
}

async function checkProxyConnection(cdp, options) {
  const resolved = optionsObject(options);
  return started(
    await cdp.send(
      'Browser.checkProxyConnection',
      optionalProfileParams(resolved),
    ),
    'Browser.checkProxyConnection',
  );
}

async function requestNewProxy(cdp, options) {
  const resolved = optionsObject(options);
  return started(
    await cdp.send(
      'Browser.requestNewProxy',
      optionalProfileParams(resolved),
    ),
    'Browser.requestNewProxy',
  );
}

module.exports = {
  checkProxyConnection,
  getProxySettings,
  requestNewProxy,
  setProxySettings,
  setProxyType,
};
