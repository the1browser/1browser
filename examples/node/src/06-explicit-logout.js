'use strict';

const {loadConfig} = require('./config');
const {OneBrowserClient} = require('./one-browser-client');

async function main() {
  const client = await OneBrowserClient.launch(loadConfig());
  try {
    const authState = await client.getAuthState();
    if (authState.signedIn) {
      await client.logout();
      console.log('Signed out explicitly.');
    } else {
      console.log(`No logout was needed (state: ${authState.state}).`);
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
