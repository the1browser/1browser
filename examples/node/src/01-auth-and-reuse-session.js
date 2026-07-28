'use strict';

const {loadConfig} = require('./config');
const {OneBrowserClient} = require('./one-browser-client');

async function main() {
  const client = await OneBrowserClient.launch(loadConfig());
  try {
    const authState = await client.ensureAuthenticated();
    console.log(`Authenticated: ${authState.state}`);
  } finally {
    // Normal cleanup preserves the session for the next run.
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
