'use strict';

const puppeteer = require('puppeteer-core');

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

class OneBrowserClient {
  static async launch(config) {
    const browser = await puppeteer.launch({
      executablePath: config.browserPath,
      headless: false,
      defaultViewport: null,
      args: [
        '--remote-debugging-port=0',
        `--user-data-dir=${config.userDataDir}`,
        '--no-first-run',
      ],
    });

    try {
      const page = await browser.newPage();
      const cdp = await page.target().createCDPSession();
      return new OneBrowserClient(browser, cdp, config);
    } catch (error) {
      await browser.close();
      throw error;
    }
  }

  constructor(browser, cdp, config) {
    this.browser = browser;
    this.cdp = cdp;
    this.config = config;
  }

  async getAuthState() {
    return this.cdp.send('Browser.getAuthState', {validateOnline: true});
  }

  async ensureAuthenticated({timeoutMs = 15000} = {}) {
    let authState = await this.getAuthState();
    if (authState.signedIn) {
      return authState;
    }

    const {email, password} = this.config;
    if (!email || !password) {
      throw new Error(
        'The persisted session is unavailable. Set ONE_EMAIL and ONE_PASSWORD.',
      );
    }

    const signin = await this.cdp.send('Browser.signin', {email, password});
    if (!signin.success) {
      throw new Error(`Signin failed with response code ${signin.responseCode}.`);
    }

    const deadline = Date.now() + timeoutMs;
    do {
      authState = await this.getAuthState();
      if (authState.signedIn) {
        return authState;
      }
      await wait(250);
    } while (Date.now() < deadline);

    throw new Error(
      `Signin was accepted but authentication was not confirmed (state: ${authState.state}).`,
    );
  }

  async getProfiles() {
    const {profiles} = await this.cdp.send('Browser.getProfiles');
    return profiles;
  }

  async getActivePersistentProfile() {
    const profiles = await this.getProfiles();
    return profiles.find((profile) => !profile.omitted && !profile.ephemeral);
  }

  async createProfile(name) {
    if (!name) {
      throw new Error('Set ONE_PROFILE_NAME before creating a profile.');
    }

    const {count} = await this.cdp.send(
      'Browser.getAvailableProfileCreationCount',
    );
    if (count <= 0) {
      throw new Error('No profiles can be created for the current account.');
    }

    const {profile} = await this.cdp.send('Browser.createProfile', {name});
    return profile;
  }

  async openProfileWindow(profileId) {
    if (!profileId) {
      throw new Error('A ProfileInfo.id is required.');
    }

    return this.cdp.send('Browser.createWindowForProfile', {profileId});
  }

  async configureUserProxy(profileId, proxyUrl) {
    if (!profileId) {
      throw new Error('A ProfileInfo.id is required.');
    }
    if (!proxyUrl) {
      throw new Error('Set ONE_PROXY_URL before configuring a user proxy.');
    }

    const {settings: current} = await this.cdp.send(
      'Browser.getProxySettings',
      {profileId},
    );

    const {settings} = await this.cdp.send('Browser.setProxySettings', {
      profileId,
      type: 'User proxy',
      settings: {
        user: proxyUrl,
        free: current.free ?? '',
        tor: current.tor ?? '',
        datacenter: current.datacenter ?? '',
        mobile: current.mobile ?? '',
        resident: current.resident ?? '',
      },
    });
    return settings;
  }

  async logout() {
    const response = await this.cdp.send('Browser.logout');
    if (!response.success) {
      throw new Error(`Logout failed with response code ${response.responseCode}.`);
    }
    return response;
  }

  async close() {
    await this.browser.close();
  }
}

module.exports = {OneBrowserClient};
