'use strict';

const {loadConfig} = require('./config');
const {OneBrowser} = require('@1browser/sdk');

async function main() {
  const config = loadConfig();
  const client = await OneBrowser.launch(config);
  try {
    await client.ensureAuthenticated();
    const [profile] = await client.getPersistentProfiles();
    if (!profile) {
      throw new Error('No active persistent profile is available.');
    }
    if (!config.proxyUrl) {
      throw new Error('Set ONE_PROXY_URL before configuring a user proxy.');
    }
    const current = await client.getProxySettings({
      profileId: profile.id,
    });
    const settings = await client.setProxySettings({
      profileId: profile.id,
      type: 'User proxy',
      settings: {
        user: config.proxyUrl,
        free: current.free ?? '',
        tor: current.tor ?? '',
        datacenter: current.datacenter ?? '',
        mobile: current.mobile ?? '',
        resident: current.resident ?? '',
      },
    });
    console.log(`Proxy type for ${profile.id}: ${settings.currentProxy}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
