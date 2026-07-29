'use strict';

const {loadConfig} = require('./config');
const {OneBrowser} = require('@1browser/sdk');

async function main() {
  const client = await OneBrowser.launch(loadConfig());
  try {
    await client.ensureAuthenticated();
    const [profile] = await client.getPersistentProfiles();
    if (!profile) {
      throw new Error('No active persistent profile is available.');
    }

    let settings = await client.getProxySettings({profileId: profile.id});
    console.log(
      `Proxy for ${profile.id}: ${settings.currentProxy ?? 'unknown'} ` +
        `(${settings.proxyStatus ?? 'status unknown'})`,
    );

    const type = process.env.ONE_PROXY_TYPE?.trim();
    if (type) {
      settings = await client.setProxyType({profileId: profile.id, type});
      console.log(`Proxy type changed to: ${settings.currentProxy ?? type}`);
    } else {
      console.log('Set ONE_PROXY_TYPE to change the active proxy type.');
    }

    const checkStarted = await client.checkProxyConnection({
      profileId: profile.id,
    });
    console.log(`Proxy connection check started: ${checkStarted}`);

    if (process.env.ONE_REQUEST_NEW_PROXY === '1') {
      const requestStarted = await client.requestNewProxy({
        profileId: profile.id,
      });
      console.log(`New proxy request started: ${requestStarted}`);
    } else {
      console.log(
        'Set ONE_REQUEST_NEW_PROXY=1 to request a new catalog proxy.',
      );
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
