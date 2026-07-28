'use strict';

const {loadConfig} = require('./config');
const {OneBrowser} = require('@1browser/sdk');

async function main() {
  const client = await OneBrowser.launch(loadConfig());
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
