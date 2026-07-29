'use strict';

const {loadConfig} = require('./config');
const {OneBrowser} = require('@1browser/sdk');

function loadSignupCredentials() {
  if (process.env.ONE_ALLOW_SIGNUP !== '1') {
    throw new Error(
      'Set ONE_ALLOW_SIGNUP=1 to confirm creation of a new account.',
    );
  }

  const email = process.env.ONE_SIGNUP_EMAIL?.trim();
  const password = process.env.ONE_SIGNUP_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Set ONE_SIGNUP_EMAIL and ONE_SIGNUP_PASSWORD before signing up.',
    );
  }
  return {email, password};
}

async function main() {
  const credentials = loadSignupCredentials();
  const client = await OneBrowser.launch(loadConfig());
  try {
    const response = await client.signup(credentials);
    console.log(
      `Signup success: ${response.success} (response code ${response.responseCode})`,
    );
    if (!response.success) {
      process.exitCode = 1;
      return;
    }

    const authState = await client.ensureAuthenticated(credentials);
    console.log(`Authenticated after signup: ${authState.state}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
