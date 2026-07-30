'use strict';

const {FingerprintError} = require('./errors');
const {validateProfileId} = require('./profiles');

function optionsObject(options, required = false) {
  if (options === undefined && !required) {
    return {};
  }
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new FingerprintError('Fingerprint options must be an object.');
  }
  return options;
}

function optionalProfileParams(options) {
  return options.profileId === undefined
    ? {}
    : {profileId: validateProfileId(options.profileId)};
}

function settingName(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new FingerprintError('name must be a non-empty string.');
  }
  return value.trim();
}

function responseObject(response, field, method) {
  const value = response?.[field];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new FingerprintError(`${method} returned an invalid ${field}.`);
  }
  return value;
}

async function getFingerprintSetting(cdp, options) {
  const resolved = optionsObject(options, true);
  const response = await cdp.send('Browser.getFingerprintSetting', {
    ...optionalProfileParams(resolved),
    name: settingName(resolved.name),
  });
  return responseObject(
    response,
    'setting',
    'Browser.getFingerprintSetting',
  );
}

async function getFingerprintSettings(cdp, options) {
  const resolved = optionsObject(options);
  const response = await cdp.send(
    'Browser.getFingerprintSettings',
    optionalProfileParams(resolved),
  );
  return responseObject(
    response,
    'settings',
    'Browser.getFingerprintSettings',
  );
}

async function setFingerprintSetting(cdp, options) {
  const resolved = optionsObject(options, true);
  if (
    !Object.prototype.hasOwnProperty.call(resolved, 'value') ||
    resolved.value === undefined
  ) {
    throw new FingerprintError('value is required.');
  }
  const response = await cdp.send('Browser.setFingerprintSetting', {
    ...optionalProfileParams(resolved),
    name: settingName(resolved.name),
    value: resolved.value,
  });
  return responseObject(
    response,
    'setting',
    'Browser.setFingerprintSetting',
  );
}

async function generateFingerprint(cdp, options) {
  const resolved = optionsObject(options);
  const response = await cdp.send(
    'Browser.generateFingerprint',
    optionalProfileParams(resolved),
  );
  if (typeof response?.started !== 'boolean') {
    throw new FingerprintError(
      'Browser.generateFingerprint returned an invalid response.',
    );
  }
  return response.started;
}

module.exports = {
  generateFingerprint,
  getFingerprintSetting,
  getFingerprintSettings,
  setFingerprintSetting,
};
