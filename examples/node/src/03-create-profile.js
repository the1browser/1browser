'use strict';

const {loadConfig} = require('./config');
const {OneBrowser} = require('@1browser/sdk');

async function main() {
  const config = loadConfig();
  const client = await OneBrowser.launch(config);
  try {
    await client.ensureAuthenticated();
    const profile = await client.createProfile(config.profileName);
    console.log(`Created profile ${profile.id} (${profile.name}).`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
