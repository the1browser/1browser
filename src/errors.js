'use strict';

class OneBrowserError extends Error {
  constructor(message, {code = 'ERR_ONE_BROWSER', cause} = {}) {
    super(message, cause === undefined ? undefined : {cause});
    this.name = new.target.name;
    this.code = code;
  }
}

class ConfigurationError extends OneBrowserError {
  constructor(message, options = {}) {
    super(message, {code: 'ERR_ONE_BROWSER_CONFIG', ...options});
  }
}

class BrowserLaunchError extends OneBrowserError {
  constructor(message, options = {}) {
    super(message, {code: 'ERR_ONE_BROWSER_LAUNCH', ...options});
  }
}

class AuthenticationError extends OneBrowserError {
  constructor(message, options = {}) {
    super(message, {code: 'ERR_ONE_BROWSER_AUTH_FAILED', ...options});
  }
}

class AuthenticationTimeoutError extends AuthenticationError {
  constructor(message, options = {}) {
    super(message, {code: 'ERR_ONE_BROWSER_AUTH_TIMEOUT', ...options});
  }
}

class ProfileError extends OneBrowserError {
  constructor(message, options = {}) {
    super(message, {code: 'ERR_ONE_BROWSER_PROFILE', ...options});
  }
}

class ProfileLimitError extends ProfileError {
  constructor(message, options = {}) {
    super(message, {code: 'ERR_ONE_BROWSER_PROFILE_LIMIT', ...options});
  }
}

class ProfileTargetError extends ProfileError {
  constructor(message, options = {}) {
    super(message, {code: 'ERR_ONE_BROWSER_PROFILE_TARGET', ...options});
  }
}

class ProfileTaskError extends OneBrowserError {
  constructor(message, options = {}) {
    super(message, {code: 'ERR_ONE_BROWSER_TASK', ...options});
  }
}

class ClientClosedError extends OneBrowserError {
  constructor(message = 'The 1Browser client is closed.', options = {}) {
    super(message, {code: 'ERR_ONE_BROWSER_CLOSED', ...options});
  }
}

module.exports = {
  OneBrowserError,
  ConfigurationError,
  BrowserLaunchError,
  AuthenticationError,
  AuthenticationTimeoutError,
  ProfileError,
  ProfileLimitError,
  ProfileTargetError,
  ProfileTaskError,
  ClientClosedError,
};
