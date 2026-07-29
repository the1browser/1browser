'use strict';

const {AuthenticationError} = require('./errors');

function nonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AuthenticationError(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function credentials(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new AuthenticationError('Signup options are required.');
  }
  if (typeof options.password !== 'string' || options.password === '') {
    throw new AuthenticationError('password must be a non-empty string.');
  }
  return {
    email: nonEmptyString(options.email, 'email'),
    password: options.password,
  };
}

function validateAuthResponse(response, method) {
  if (
    typeof response?.success !== 'boolean' ||
    !Number.isInteger(response.responseCode)
  ) {
    throw new AuthenticationError(`${method} returned an invalid response.`);
  }
  if (response.body !== undefined && typeof response.body !== 'string') {
    throw new AuthenticationError(`${method} returned an invalid body.`);
  }
  return response;
}

async function signup(cdp, options) {
  return validateAuthResponse(
    await cdp.send('Browser.signup', credentials(options)),
    'Browser.signup',
  );
}

async function login(cdp) {
  const response = await cdp.send('Browser.login');
  if (
    !Number.isInteger(response?.windowId) ||
    typeof response.targetId !== 'string' ||
    response.targetId === ''
  ) {
    throw new AuthenticationError('Browser.login returned an invalid target.');
  }
  return response;
}

async function verify(cdp) {
  return validateAuthResponse(
    await cdp.send('Browser.verify'),
    'Browser.verify',
  );
}

module.exports = {
  login,
  signup,
  validateAuthResponse,
  verify,
};
