'use strict';

const {OneBrowser} = require('./client');
const {findInstalledBrowser} = require('./browser-discovery');
const {
  getDefaultUserDataDir,
  loadEnvironmentConfig,
  resolveConfiguration,
  sanitizeApplicationId,
} = require('./config');
const errors = require('./errors');

module.exports = {
  OneBrowser,
  findInstalledBrowser,
  getDefaultUserDataDir,
  loadEnvironmentConfig,
  resolveConfiguration,
  sanitizeApplicationId,
  ...errors,
};
