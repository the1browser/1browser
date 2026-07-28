'use strict';

const puppeteer = require('puppeteer-core');

const {ensureAuthenticated, getAuthState} = require('./auth');
const {validateLaunchOptions} = require('./config');
const {runForProfiles} = require('./concurrency');
const {
  AuthenticationError,
  BrowserLaunchError,
  ClientClosedError,
  OneBrowserError,
  ProfileError,
} = require('./errors');
const {
  createProfile,
  ensureProfiles,
  persistentProfiles,
  validateProfileId,
} = require('./profiles');
const {openProfilePage} = require('./targets');

class OneBrowser {
  static async launch(options) {
    const validated = validateLaunchOptions(options);
    const puppeteerApi = validated.puppeteer ?? puppeteer;
    let browser;
    try {
      browser = await puppeteerApi.launch({
        executablePath: validated.executablePath,
        headless: false,
        defaultViewport: null,
        args: [
          '--remote-debugging-port=0',
          `--user-data-dir=${validated.userDataDir}`,
          '--no-first-run',
          ...validated.launchArgs,
        ],
      });
      const bootstrapPage = await browser.newPage();
      const cdp = await bootstrapPage.target().createCDPSession();
      return new OneBrowser(browser, cdp, validated);
    } catch (error) {
      if (browser) {
        await browser.close().catch(() => {});
      }
      if (error instanceof OneBrowserError) {
        throw error;
      }
      throw new BrowserLaunchError('Unable to launch and initialize 1Browser.', {
        cause: error,
      });
    }
  }

  constructor(browser, cdp, options = {}) {
    this.browser = browser;
    this.cdp = cdp;
    this.options = options;
    this.closed = false;
    this.closePromise = undefined;
    this.authenticated = false;
  }

  assertOpen() {
    if (this.closed) {
      throw new ClientClosedError();
    }
  }

  async getAuthState(options) {
    this.assertOpen();
    const state = await getAuthState(this.cdp, options);
    this.authenticated =
      state?.signedIn === true && options?.validateOnline !== false;
    return state;
  }

  async ensureAuthenticated(options) {
    this.assertOpen();
    const state = await ensureAuthenticated(this.cdp, this.options, options);
    this.authenticated = true;
    return state;
  }

  async ensureAccountReady() {
    this.assertOpen();
    if (!this.authenticated) {
      await this.ensureAuthenticated();
    }
  }

  async logout() {
    this.assertOpen();
    const response = await this.cdp.send('Browser.logout');
    if (response?.success !== true) {
      const suffix =
        response?.responseCode === undefined
          ? ''
          : ` (response code ${response.responseCode})`;
      throw new AuthenticationError(`1Browser logout failed${suffix}.`);
    }
    this.authenticated = false;
  }

  async getProfiles() {
    await this.ensureAccountReady();
    const response = await this.cdp.send('Browser.getProfiles');
    if (!Array.isArray(response?.profiles)) {
      throw new ProfileError(
        'Browser.getProfiles returned an invalid response.',
      );
    }
    return response.profiles;
  }

  async getPersistentProfiles(options) {
    return persistentProfiles(await this.getProfiles(), options);
  }

  async createProfile(name) {
    await this.ensureAccountReady();
    return createProfile(this.cdp, name);
  }

  async ensureProfiles(options) {
    await this.ensureAccountReady();
    const response = await this.cdp.send('Browser.getProfiles');
    return ensureProfiles(this.cdp, response?.profiles, options);
  }

  async openProfilePage(profileId, {timeoutMs} = {}) {
    await this.ensureAccountReady();
    const id = validateProfileId(profileId);
    return openProfilePage({
      browser: this.browser,
      cdp: this.cdp,
      profileId: id,
      timeoutMs,
    });
  }

  async runForProfiles(options) {
    await this.ensureAccountReady();
    return runForProfiles(this, options);
  }

  async send(method, params) {
    await this.ensureAccountReady();
    if (typeof method !== 'string' || method.trim() === '') {
      throw new OneBrowserError('A non-empty CDP method is required.', {
        code: 'ERR_ONE_BROWSER_CONFIG',
      });
    }
    return this.cdp.send(method, params);
  }

  async close() {
    if (this.closePromise) {
      return this.closePromise;
    }
    this.closed = true;
    this.authenticated = false;
    this.closePromise = (async () => {
      try {
        await this.browser.close();
      } catch (error) {
        throw new OneBrowserError('Unable to close 1Browser cleanly.', {
          code: 'ERR_ONE_BROWSER_CLOSE',
          cause: error,
        });
      }
    })();
    return this.closePromise;
  }
}

module.exports = {OneBrowser};
