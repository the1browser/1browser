'use strict';

function serializeError(error) {
  return {
    name:
      typeof error?.name === 'string' && error.name
        ? error.name
        : 'Error',
    message:
      typeof error?.message === 'string'
        ? error.message
        : String(error),
  };
}

function baseResult(profile) {
  return {
    profileId: profile.id,
    ...(profile.name ? {profileName: profile.name} : {}),
  };
}

module.exports = {
  baseResult,
  serializeError,
};
