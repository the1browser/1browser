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

    const {windowId, targetId, page} = await client.openProfilePage(profile.id);
    console.log(`Opened profile ${profile.id}: window ${windowId}, target ${targetId}.`);
    await page.close();
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
