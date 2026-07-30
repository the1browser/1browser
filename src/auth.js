'use strict';

const {login} = require('./auth-operations');
const {
  AuthenticationError,
  AuthenticationTimeoutError,
} = require('./errors');

const AUTHENTICATION_MODES = new Set([
  'auto',
  'credentials-only',
  'interactive-only',
  'error',
]);

const DEFAULT_AUTHENTICATION_OPTIONS = Object.freeze({
  mode: 'auto',
  timeoutMs: 15_000,
  interactiveTimeoutMs: 300_000,
  pollIntervalMs: 500,
});

const defaultTimer = {
  now: Date.now,
  wait(milliseconds, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }

      const timeout = setTimeout(finish, milliseconds);
      function finish() {
        signal?.removeEventListener('abort', abort);
        resolve();
      }
      function abort() {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
        reject(signal.reason);
      }
      signal?.addEventListener('abort', abort, {once: true});
    });
  },
};

function positiveNumber(value, fallback, name) {
  const resolved = value === undefined ? fallback : value;
  if (!Number.isFinite(resolved) || resolved <= 0) {
    throw new AuthenticationError(`${name} must be a positive finite number.`);
  }
  return resolved;
}

function authenticationMode(value) {
  const resolved = value ?? DEFAULT_AUTHENTICATION_OPTIONS.mode;
  if (!AUTHENTICATION_MODES.has(resolved)) {
    throw new AuthenticationError(
      `mode must be one of: ${[...AUTHENTICATION_MODES].join(', ')}.`,
    );
  }
  return resolved;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new AuthenticationError('Authentication was cancelled.', {
          code: 'ERR_ONE_BROWSER_AUTH_CANCELLED',
        });
  }
}

function resolveAuthenticationOptions(launchOptions = {}, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new AuthenticationError(
      'Authentication options must be an object.',
    );
  }
  if (
    options.onInteractiveLogin !== undefined &&
    typeof options.onInteractiveLogin !== 'function'
  ) {
    throw new AuthenticationError(
      'onInteractiveLogin must be a function.',
    );
  }

  return {
    mode: authenticationMode(options.mode ?? launchOptions.auth?.mode),
    timeoutMs: positiveNumber(
      options.timeoutMs ?? launchOptions.auth?.timeoutMs,
      DEFAULT_AUTHENTICATION_OPTIONS.timeoutMs,
      'timeoutMs',
    ),
    interactiveTimeoutMs: positiveNumber(
      options.interactiveTimeoutMs ??
        launchOptions.auth?.interactiveTimeoutMs,
      DEFAULT_AUTHENTICATION_OPTIONS.interactiveTimeoutMs,
      'interactiveTimeoutMs',
    ),
    pollIntervalMs: positiveNumber(
      options.pollIntervalMs ?? launchOptions.auth?.pollIntervalMs,
      DEFAULT_AUTHENTICATION_OPTIONS.pollIntervalMs,
      'pollIntervalMs',
    ),
    onInteractiveLogin: options.onInteractiveLogin,
    signal: options.signal,
    timer: options.timer ?? defaultTimer,
  };
}

async function getAuthState(cdp, {validateOnline = true} = {}) {
  if (typeof validateOnline !== 'boolean') {
    throw new AuthenticationError('validateOnline must be a boolean.');
  }
  return cdp.send('Browser.getAuthState', {validateOnline});
}

async function waitForAuthenticatedState(
  cdp,
  {
    timeoutMs,
    pollIntervalMs,
    operation,
    timeoutCode = 'ERR_ONE_BROWSER_AUTH_TIMEOUT',
    signal,
    timer = defaultTimer,
  },
) {
  const deadline = timer.now() + timeoutMs;
  let state;

  while (true) {
    throwIfAborted(signal);
    state = await getAuthState(cdp, {validateOnline: true});
    throwIfAborted(signal);
    if (state?.signedIn === true) {
      return state;
    }

    const remaining = deadline - timer.now();
    if (remaining <= 0) {
      break;
    }
    await timer.wait(Math.min(pollIntervalMs, remaining), signal);
  }

  throw new AuthenticationTimeoutError(
    `${operation} within ${timeoutMs} ms (last state: ${state?.state ?? 'unknown'}).`,
    {code: timeoutCode},
  );
}

async function ensureCredentialAuthentication(
  cdp,
  {
    email,
    password,
    timeoutMs,
    pollIntervalMs,
    signal,
    timer,
  },
) {
  throwIfAborted(signal);
  const response = await cdp.send('Browser.signin', {
    email: email.trim(),
    password,
  });
  throwIfAborted(signal);
  if (response?.success !== true) {
    const suffix =
      response?.responseCode === undefined
        ? ''
        : ` (response code ${response.responseCode})`;
    throw new AuthenticationError(`1Browser sign-in failed${suffix}.`);
  }

  return waitForAuthenticatedState(cdp, {
    timeoutMs,
    pollIntervalMs,
    operation:
      'Sign-in was accepted, but online authentication was not confirmed',
    signal,
    timer,
  });
}

async function ensureInteractiveAuthentication(
  cdp,
  {
    timeoutMs,
    pollIntervalMs,
    onInteractiveLogin,
    signal,
    timer,
  },
) {
  throwIfAborted(signal);
  const target = await login(cdp);
  throwIfAborted(signal);
  onInteractiveLogin?.(target);

  return waitForAuthenticatedState(cdp, {
    timeoutMs,
    pollIntervalMs,
    operation:
      'Interactive login was not completed',
    timeoutCode: 'ERR_ONE_BROWSER_AUTH_INTERACTIVE_TIMEOUT',
    signal,
    timer,
  });
}

function resolveCredentials(launchOptions, options) {
  const email =
    options.email !== undefined
      ? options.email
      : launchOptions.credentials?.email;
  const password =
    options.password !== undefined
      ? options.password
      : launchOptions.credentials?.password;
  const emailValid = typeof email === 'string' && email.trim() !== '';
  const passwordValid =
    typeof password === 'string' && password !== '';
  const configured = email !== undefined || password !== undefined;

  if (configured && (!emailValid || !passwordValid)) {
    throw new AuthenticationError(
      'Authentication credentials are incomplete. Provide both email and password, remove the partial credential configuration to use interactive login, or select interactive-only mode.',
      {code: 'ERR_ONE_BROWSER_AUTH_CREDENTIALS_INCOMPLETE'},
    );
  }

  return emailValid && passwordValid
    ? {email: email.trim(), password}
    : undefined;
}

async function ensureAuthenticated(cdp, launchOptions = {}, options = {}) {
  const resolved = resolveAuthenticationOptions(launchOptions, options);
  throwIfAborted(resolved.signal);

  const state = await getAuthState(cdp, {validateOnline: true});
  throwIfAborted(resolved.signal);
  if (state?.signedIn === true) {
    return state;
  }

  if (resolved.mode === 'error') {
    throw new AuthenticationError(
      'Authentication is required and automatic authentication is disabled by auth mode "error".',
      {code: 'ERR_ONE_BROWSER_AUTH_INTERACTIVE_DISABLED'},
    );
  }

  if (resolved.mode === 'interactive-only') {
    return ensureInteractiveAuthentication(cdp, {
      timeoutMs: resolved.interactiveTimeoutMs,
      pollIntervalMs: resolved.pollIntervalMs,
      onInteractiveLogin: resolved.onInteractiveLogin,
      signal: resolved.signal,
      timer: resolved.timer,
    });
  }

  const credentials = resolveCredentials(launchOptions, options);
  if (credentials) {
    return ensureCredentialAuthentication(cdp, {
      ...credentials,
      timeoutMs: resolved.timeoutMs,
      pollIntervalMs: resolved.pollIntervalMs,
      signal: resolved.signal,
      timer: resolved.timer,
    });
  }

  if (resolved.mode === 'credentials-only') {
    throw new AuthenticationError(
      'Authentication is required. Provide both email and password when using auth mode "credentials-only".',
      {code: 'ERR_ONE_BROWSER_AUTH_REQUIRED'},
    );
  }

  return ensureInteractiveAuthentication(cdp, {
    timeoutMs: resolved.interactiveTimeoutMs,
    pollIntervalMs: resolved.pollIntervalMs,
    onInteractiveLogin: resolved.onInteractiveLogin,
    signal: resolved.signal,
    timer: resolved.timer,
  });
}

module.exports = {
  AUTHENTICATION_MODES,
  DEFAULT_AUTHENTICATION_OPTIONS,
  ensureAuthenticated,
  ensureInteractiveAuthentication,
  getAuthState,
  resolveAuthenticationOptions,
  waitForAuthenticatedState,
};
