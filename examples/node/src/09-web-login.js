'use strict';

const readline = require('node:readline/promises');
const {stdin, stdout} = require('node:process');
const {loadConfig} = require('./config');
const {OneBrowser} = require('@1browser/sdk');

async function main() {
  if (!stdin.isTTY) {
    throw new Error('Run this interactive example from a terminal.');
  }

  const client = await OneBrowser.launch(await loadConfig());
  const terminal = readline.createInterface({input: stdin, output: stdout});
  try {
    const {windowId, targetId} = await client.login();
    console.log(`Login page opened (window ${windowId}, target ${targetId}).`);
    await terminal.question(
      'Complete login in 1Browser, then press Enter here...',
    );

    const authState = await client.getAuthState({validateOnline: true});
    console.log(`Authenticated: ${authState.signedIn} (${authState.state})`);
  } finally {
    terminal.close();
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
