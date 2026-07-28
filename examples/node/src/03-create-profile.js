'use strict';

const {loadConfig} = require('./config');
const {OneBrowserClient} = require('./one-browser-client');

async function main() {
  const config = loadConfig();
  const client = await OneBrowserClient.launch(config);
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
