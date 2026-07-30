'use strict';

const {loadConfig} = require('./config');
const {OneBrowser} = require('@1browser/sdk');

async function main() {
  if (process.env.ONE_ALLOW_VERIFY !== '1') {
    throw new Error(
      'Set ONE_ALLOW_VERIFY=1 to confirm sending the verification email.',
    );
  }

  const client = await OneBrowser.launch(await loadConfig());
  try {
    await client.ensureAuthenticated();
    const response = await client.verify();
    console.log(
      `Verification request accepted: ${response.success} ` +
        `(response code ${response.responseCode})`,
    );
    if (!response.success) {
      process.exitCode = 1;
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
