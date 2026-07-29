'use strict';

const assert = require('node:assert/strict');

const {
  OneBrowser,
  loadEnvironmentConfig,
} = require('../src');

function enabled(...flags) {
  return (
    process.env.ONE_BROWSER_INTEGRATION === '1' &&
    flags.every((flag) => process.env[flag] === '1')
  );
}

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be set for this integration test.`);
  }
  return value;
}

function parseEnvironmentValue(name) {
  const raw = requireEnvironment(name);
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

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

function cleanupConfig() {
  return {
    timeoutMs: positiveInteger(
      'ONE_PROFILE_CRUD_DELETE_TIMEOUT_MS',
      30_000,
    ),
    pollIntervalMs: 250,
  };
}

async function waitForProfilesAbsent(
  client,
  profileIds,
  {timeoutMs, pollIntervalMs} = cleanupConfig(),
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

async function cleanupProfiles(client, profileIds) {
  if (profileIds.length === 0) {
    return;
  }

  const expected = new Set(profileIds);
  const remaining = (await client.getProfiles())
    .map(({id}) => id)
    .filter((id) => expected.has(id));
  if (remaining.length === 0) {
    return;
  }

  const results = await client.deleteProfiles(remaining);
  const failed = results.filter(({success}) => !success);
  assert.deepEqual(
    failed.map(({profileId, error}) => ({profileId, error})),
    [],
    'Integration fixture cleanup could not schedule every profile deletion.',
  );
  await waitForProfilesAbsent(client, remaining);
}

async function authenticatedFixture(t, options = loadEnvironmentConfig()) {
  const client = await OneBrowser.launch(options);
  const ownedProfileIds = [];

  t.after(async () => {
    try {
      await cleanupProfiles(client, ownedProfileIds);
    } finally {
      await client.close();
    }
  });

  await client.ensureAuthenticated();
  return {
    client,
    trackProfiles(profiles) {
      for (const profile of profiles) {
        if (!ownedProfileIds.includes(profile.id)) {
          ownedProfileIds.push(profile.id);
        }
      }
    },
    async createProfile(prefix) {
      const profile = await client.createProfile(
        `${prefix} ${Date.now()}-${process.pid}`,
      );
      ownedProfileIds.push(profile.id);
      return profile;
    },
    async selectOrCreateProfile(prefix) {
      const requestedId = process.env.ONE_INTEGRATION_PROFILE_ID?.trim();
      const profiles = await client.getPersistentProfiles();
      if (requestedId) {
        const requested = profiles.find(({id}) => id === requestedId);
        assert.ok(
          requested,
          `ONE_INTEGRATION_PROFILE_ID ${requestedId} is not an active persistent profile.`,
        );
        return requested;
      }
      if (profiles.length > 0) {
        return profiles[0];
      }
      return this.createProfile(prefix);
    },
  };
}

module.exports = {
  OneBrowser,
  authenticatedFixture,
  cleanupProfiles,
  enabled,
  loadEnvironmentConfig,
  parseEnvironmentValue,
  positiveInteger,
  requireEnvironment,
  waitForProfilesAbsent,
};
