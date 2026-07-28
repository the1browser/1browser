'use strict';

const {loadConfig} = require('./config');
const {OneBrowserClient} = require('./one-browser-client');

async function main() {
  const config = loadConfig();
  const client = await OneBrowserClient.launch(config);
  try {
    await client.ensureAuthenticated();
    const profile = await client.getActivePersistentProfile();
    if (!profile) {
      throw new Error('No active persistent profile is available.');
    }

    const settings = await client.configureUserProxy(
      profile.id,
      config.proxyUrl,
    );
    console.log(`Proxy type for ${profile.id}: ${settings.currentProxy}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
