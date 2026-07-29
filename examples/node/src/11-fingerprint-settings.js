'use strict';

const {loadConfig} = require('./config');
const {OneBrowser} = require('@1browser/sdk');

function settingValue(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function main() {
  const client = await OneBrowser.launch(loadConfig());
  try {
    await client.ensureAuthenticated();
    const [profile] = await client.getPersistentProfiles();
    if (!profile) {
      throw new Error('No active persistent profile is available.');
    }

    const name =
      process.env.ONE_FINGERPRINT_SETTING?.trim() || 'screen_resolution';
    const setting = await client.getFingerprintSetting({
      profileId: profile.id,
      name,
    });
    const settings = await client.getFingerprintSettings({
      profileId: profile.id,
    });
    console.log(
      `${name} for ${profile.id}: ${JSON.stringify(setting.value)}`,
    );
    console.log(`Available fingerprint settings: ${Object.keys(settings).length}`);

    const configuredValue = process.env.ONE_FINGERPRINT_VALUE;
    if (configuredValue !== undefined && configuredValue !== '') {
      const updated = await client.setFingerprintSetting({
        profileId: profile.id,
        name,
        value: settingValue(configuredValue),
      });
      console.log(`${name} updated to: ${JSON.stringify(updated.value)}`);
    } else {
      console.log(
        'Set ONE_FINGERPRINT_VALUE to update the selected setting.',
      );
    }

    if (process.env.ONE_GENERATE_FINGERPRINT === '1') {
      const started = await client.generateFingerprint({
        profileId: profile.id,
      });
      console.log(`Fingerprint generation started: ${started}`);
    } else {
      console.log(
        'Set ONE_GENERATE_FINGERPRINT=1 to generate a new fingerprint.',
      );
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
