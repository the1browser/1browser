'use strict';

const {loadConfig} = require('./config');
const {OneBrowserClient} = require('./one-browser-client');

async function main() {
  const client = await OneBrowserClient.launch(loadConfig());
  try {
    await client.ensureAuthenticated();
    const profile = await client.getActivePersistentProfile();
    if (!profile) {
      throw new Error('No active persistent profile is available.');
    }

    const {windowId, targetId} = await client.openProfileWindow(profile.id);
    console.log(`Opened profile ${profile.id}: window ${windowId}, target ${targetId}.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
