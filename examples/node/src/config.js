'use strict';

require('dotenv').config();

const {loadEnvironmentConfig} = require('@1browser/sdk');

function loadConfig() {
  return {
    ...loadEnvironmentConfig(),
    profileName: process.env.ONE_PROFILE_NAME?.trim(),
    proxyUrl: process.env.ONE_PROXY_URL?.trim(),
  };
}

module.exports = {loadConfig};
