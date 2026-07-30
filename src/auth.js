'use strict';

const {
  AuthenticationError,
  AuthenticationTimeoutError,
} = require('./errors');

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function positiveNumber(value, fallback, name) {
  const resolved = value === undefined ? fallback : value;
  if (!Number.isFinite(resolved) || resolved <= 0) {
    throw new AuthenticationError(`${name} must be a positive number.`);
  }
  return resolved;
}

async function getAuthState(cdp, {validateOnline = true} = {}) {
  if (typeof validateOnline !== 'boolean') {
    throw new AuthenticationError('validateOnline must be a boolean.');
  }
  return cdp.send('Browser.getAuthState', {validateOnline});
}

async function ensureAuthenticated(cdp, launchOptions, options = {}) {
  const validateOnline = true;
  let state = await getAuthState(cdp, {validateOnline});
  if (state.signedIn === true) {
    return state;
  }

  const email =
    options.email !== undefined
      ? options.email
      : launchOptions.credentials?.email;
  const password =
    options.password !== undefined
      ? options.password
      : launchOptions.credentials?.password;
  if (
    typeof email !== 'string' ||
    email.trim() === '' ||
    typeof password !== 'string' ||
    password === ''
  ) {
    throw new AuthenticationError(
      'Authentication is required. Provide email and password or reuse an authenticated userDataDir.',
      {code: 'ERR_ONE_BROWSER_AUTH_REQUIRED'},
    );
  }

  const response = await cdp.send('Browser.signin', {
    email: email.trim(),
    password,
  });
  if (response?.success !== true) {
    const suffix =
      response?.responseCode === undefined
        ? ''
        : ` (response code ${response.responseCode})`;
    throw new AuthenticationError(`1Browser sign-in failed${suffix}.`);
  }

  const timeoutMs = positiveNumber(
    options.timeoutMs ?? launchOptions.auth?.timeoutMs,
    15_000,
    'timeoutMs',
  );
  const pollIntervalMs = positiveNumber(
    options.pollIntervalMs ?? launchOptions.auth?.pollIntervalMs,
    250,
    'pollIntervalMs',
  );
  const deadline = Date.now() + timeoutMs;

  do {
    state = await getAuthState(cdp, {validateOnline});
    if (state.signedIn === true) {
      return state;
    }
    if (Date.now() < deadline) {
      await wait(Math.min(pollIntervalMs, Math.max(1, deadline - Date.now())));
    }
  } while (Date.now() < deadline);

  throw new AuthenticationTimeoutError(
    `Sign-in was accepted, but online authentication was not confirmed within ${timeoutMs} ms (last state: ${state?.state ?? 'unknown'}).`,
  );
}

module.exports = {
  ensureAuthenticated,
  getAuthState,
};
