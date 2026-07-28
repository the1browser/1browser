'use strict';

const {OneBrowser} = require('@1browser/sdk');
const {loadConfig} = require('./config');
const {searchAmazon} = require('./sites/amazon-search');

function positiveInteger(name, fallback) {
  const raw = process.env[name]?.trim();
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function applicationConfig() {
  const targetUrl = process.env.ONE_TARGET_URL?.trim() ?? 'https://www.amazon.com';
  const parsedUrl = new URL(targetUrl);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('ONE_TARGET_URL must use HTTP or HTTPS.');
  }
  return {
    launch: loadConfig(),
    count: positiveInteger('ONE_PROFILE_COUNT', 5),
    namePrefix:
      process.env.ONE_PROFILE_PREFIX?.trim() || 'Amazon Search',
    targetUrl: parsedUrl.href,
    query: process.env.ONE_SEARCH_QUERY?.trim() || 'iphone',
    concurrency: positiveInteger('ONE_CONCURRENCY', 2),
  };
}

async function main() {
  const config = applicationConfig();
  const client = await OneBrowser.launch(config.launch);
  try {
    await client.ensureAuthenticated();
    const ensured = await client.ensureProfiles({
      count: config.count,
      namePrefix: config.namePrefix,
    });
    console.log(
      `Profiles ready: ${ensured.profiles.length} (${ensured.reused.length} reused, ${ensured.created.length} created).`,
    );

    const results = await client.runForProfiles({
      profiles: ensured.profiles,
      concurrency: config.concurrency,
      task: async ({page}) =>
        searchAmazon(page, {
          targetUrl: config.targetUrl,
          query: config.query,
        }),
    });

    console.table(
      results.map((result) => ({
        profileId: result.profileId,
        profileName: result.profileName,
        success: result.success,
        title: result.value?.title,
        resultCount: result.value?.resultCount,
        error: result.error?.message,
      })),
    );
    if (results.some(({success}) => !success)) {
      process.exitCode = 1;
    }
  } finally {
    // Closing preserves authentication and deterministic profiles for later runs.
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
