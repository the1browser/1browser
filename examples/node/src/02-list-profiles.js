'use strict';

const {loadConfig} = require('./config');
const {OneBrowserClient} = require('./one-browser-client');

async function main() {
  const client = await OneBrowserClient.launch(loadConfig());
  try {
    await client.ensureAuthenticated();
    const profiles = await client.getProfiles();
    console.table(
      profiles.map(({id, name, omitted, ephemeral}) => ({
        id,
        name,
        omitted,
        ephemeral,
      })),
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
