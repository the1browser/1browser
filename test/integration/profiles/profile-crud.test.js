'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  OneBrowser,
  loadEnvironmentConfig,
} = require('../../../src');

const enabled =
  process.env.ONE_BROWSER_INTEGRATION === '1' &&
  process.env.ONE_BROWSER_PROFILE_CRUD === '1';

function positiveInteger(name, fallback, maximum) {
  const raw = process.env[name]?.trim();
  const value = raw ? Number(raw) : fallback;
  if (
    !Number.isInteger(value) ||
    value <= 0 ||
    (maximum !== undefined && value > maximum)
  ) {
    const suffix = maximum === undefined ? '' : ` and no greater than ${maximum}`;
    throw new Error(`${name} must be a positive integer${suffix}.`);
  }
  return value;
}

function crudConfig() {
  const prefix =
    process.env.ONE_PROFILE_CRUD_PREFIX?.trim() || 'SDK CRUD Test';
  return {
    count: positiveInteger('ONE_PROFILE_CRUD_COUNT', 2, 5),
    quotaTimeoutMs: positiveInteger(
      'ONE_PROFILE_CRUD_QUOTA_TIMEOUT_MS',
      30_000,
    ),
    deleteTimeoutMs: positiveInteger(
      'ONE_PROFILE_CRUD_DELETE_TIMEOUT_MS',
      30_000,
    ),
    prefix,
    pollIntervalMs: 250,
  };
}

async function waitForProfilesAbsent(
  client,
  profileIds,
  {timeoutMs, pollIntervalMs},
) {
  const expectedAbsent = new Set(profileIds);
  const deadline = Date.now() + timeoutMs;
  let remaining = [];

  do {
    const profiles = await client.getProfiles();
    remaining = profiles
      .map(({id}) => id)
      .filter((id) => expectedAbsent.has(id));
    if (remaining.length === 0) {
      return;
    }
    if (Date.now() < deadline) {
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Math.min(pollIntervalMs, Math.max(1, deadline - Date.now())),
        ),
      );
    }
  } while (Date.now() < deadline);

  throw new Error(
    `Created test profiles were still listed after ${timeoutMs} ms: ${remaining.join(', ')}`,
  );
}

async function cleanupCreatedProfiles(client, profileIds, config) {
  if (profileIds.length === 0) {
    return;
  }

  const existingIds = new Set(
    (await client.getProfiles()).map(({id}) => id),
  );
  const remaining = profileIds.filter((id) => existingIds.has(id));
  if (remaining.length === 0) {
    return;
  }

  const results = await client.deleteProfiles(remaining);
  const failed = results.filter(({success}) => !success);
  if (failed.length > 0) {
    throw new Error(
      `Cleanup could not schedule deletion for: ${failed
        .map(({profileId}) => profileId)
        .join(', ')}`,
    );
  }
  await waitForProfilesAbsent(client, remaining, config);
}

test(
  'real browser creates, lists, and deletes only profiles owned by this run',
  {skip: !enabled},
  async (t) => {
    const config = crudConfig();
    const client = await OneBrowser.launch(loadEnvironmentConfig());
    const createdIds = [];

    t.after(async () => {
      try {
        await cleanupCreatedProfiles(client, createdIds, config);
      } finally {
        await client.close();
      }
    });

    await client.ensureAuthenticated();

    const available = await client.getAvailableProfileCreationCount({
      timeoutMs: config.quotaTimeoutMs,
      pollIntervalMs: config.pollIntervalMs,
    });
    assert.ok(
      Number.isInteger(available) && available >= config.count,
      `The account has ${available} creation slots, but the test needs ${config.count}.`,
    );

    const runPrefix = `${config.prefix} ${Date.now()}-${process.pid}`;
    const created = [];
    for (let index = 1; index <= config.count; index += 1) {
      const name = `${runPrefix} ${String(index).padStart(2, '0')}`;
      const profile = await client.createProfile(name);
      created.push(profile);
      createdIds.push(profile.id);
    }

    assert.equal(new Set(createdIds).size, config.count);
    const listedById = new Map(
      (await client.getProfiles()).map((profile) => [profile.id, profile]),
    );
    for (const profile of created) {
      assert.equal(listedById.get(profile.id)?.name, profile.name);
    }

    const deletionResults = await client.deleteProfiles(createdIds);
    assert.equal(deletionResults.length, createdIds.length);
    assert.deepEqual(
      deletionResults
        .filter(({success}) => !success)
        .map(({profileId, error}) => ({profileId, error})),
      [],
    );

    await waitForProfilesAbsent(client, createdIds, config);
  },
);
