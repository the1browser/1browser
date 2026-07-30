'use strict';

require('dotenv').config();

const {resolveConfiguration} = require('@1browser/sdk');

async function loadConfig() {
  return {
    ...(await resolveConfiguration({
      applicationId: '1browser-node-examples',
      options: {},
      env: process.env,
    })),
    profileName: process.env.ONE_PROFILE_NAME?.trim(),
    proxyUrl: process.env.ONE_PROXY_URL?.trim(),
  };
}

module.exports = {loadConfig};
