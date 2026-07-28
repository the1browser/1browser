'use strict';

const {
  ProfileError,
  ProfileLimitError,
} = require('./errors');

function validateProfileId(profileId) {
  if (typeof profileId !== 'string' || profileId.trim() === '') {
    throw new ProfileError('A non-empty ProfileInfo.id is required.');
  }
  return profileId.trim();
}

function validateProfileName(name, field = 'name') {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new ProfileError(`${field} must be a non-empty string.`);
  }
  return name.trim();
}

function persistentProfiles(profiles, {includeOmitted = false} = {}) {
  if (!Array.isArray(profiles)) {
    throw new ProfileError('Browser.getProfiles returned an invalid profile list.');
  }
  return profiles.filter(
    (profile) =>
      profile &&
      typeof profile.id === 'string' &&
      profile.ephemeral !== true &&
      (includeOmitted || profile.omitted !== true),
  );
}

function validateEnsureOptions(options) {
  if (!options || typeof options !== 'object') {
    throw new ProfileError('ensureProfiles options are required.');
  }
  if (!Number.isInteger(options.count) || options.count <= 0) {
    throw new ProfileError('count must be a positive integer.');
  }
  const namePrefix = validateProfileName(options.namePrefix, 'namePrefix');
  const mode = options.mode ?? 'ensure-count';
  if (!['ensure-count', 'create-new', 'use-existing'].includes(mode)) {
    throw new ProfileError(
      'mode must be ensure-count, create-new, or use-existing.',
    );
  }
  return {count: options.count, namePrefix, mode};
}

function indexedNames(namePrefix, count, start = 1) {
  return Array.from({length: count}, (_, offset) => {
    const index = start + offset;
    return `${namePrefix} ${String(index).padStart(2, '0')}`;
  });
}

function matchingIndex(profile, namePrefix) {
  const escaped = namePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = profile.name?.match(new RegExp(`^${escaped} (\\d+)$`));
  return match ? Number(match[1]) : undefined;
}

async function availableCount(cdp) {
  const response = await cdp.send('Browser.getAvailableProfileCreationCount');
  if (!Number.isInteger(response?.count) || response.count < 0) {
    throw new ProfileError(
      'Browser.getAvailableProfileCreationCount returned an invalid count.',
    );
  }
  return response.count;
}

async function createNamedProfile(cdp, name) {
  const response = await cdp.send('Browser.createProfile', {name});
  if (
    !response?.profile ||
    typeof response.profile.id !== 'string' ||
    response.profile.id.trim() === ''
  ) {
    throw new ProfileError(
      `Browser.createProfile did not return a valid profile for "${name}".`,
    );
  }
  return response.profile;
}

async function createProfile(cdp, name) {
  const validatedName = validateProfileName(name);
  const available = await availableCount(cdp);
  if (available < 1) {
    throw new ProfileLimitError(
      'No persistent profiles can be created for the current account.',
    );
  }
  return createNamedProfile(cdp, validatedName);
}

async function ensureProfiles(cdp, profiles, options) {
  const {count, namePrefix, mode} = validateEnsureOptions(options);
  const current = persistentProfiles(profiles);

  if (mode === 'create-new') {
    const usedIndices = current
      .map((profile) => matchingIndex(profile, namePrefix))
      .filter(Number.isInteger);
    const start = usedIndices.length === 0 ? 1 : Math.max(...usedIndices) + 1;
    const names = indexedNames(namePrefix, count, start);
    const available = await availableCount(cdp);
    if (available < count) {
      throw new ProfileLimitError(
        `Cannot create ${count} profiles: 0 reused, ${count} missing, and ${available} creation slots available.`,
      );
    }
    const created = [];
    for (const name of names) {
      created.push(await createNamedProfile(cdp, name));
    }
    return {profiles: created, reused: [], created};
  }

  const names = indexedNames(namePrefix, count);
  const firstByName = new Map();
  for (const profile of current) {
    if (names.includes(profile.name) && !firstByName.has(profile.name)) {
      firstByName.set(profile.name, profile);
    }
  }
  const reused = names
    .map((name) => firstByName.get(name))
    .filter(Boolean);
  const missingNames = names.filter((name) => !firstByName.has(name));

  if (mode === 'use-existing') {
    if (missingNames.length > 0) {
      throw new ProfileError(
        `Only ${reused.length} of ${count} requested "${namePrefix}" profiles exist; use-existing does not create profiles.`,
      );
    }
    return {profiles: reused, reused, created: []};
  }

  if (missingNames.length > 0) {
    const available = await availableCount(cdp);
    if (available < missingNames.length) {
      throw new ProfileLimitError(
        `Cannot ensure ${count} profiles: ${reused.length} existing, ${missingNames.length} missing, and ${available} creation slots available.`,
      );
    }
  }

  const created = [];
  for (const name of missingNames) {
    const profile = await createNamedProfile(cdp, name);
    firstByName.set(name, profile);
    created.push(profile);
  }
  return {
    profiles: names.map((name) => firstByName.get(name)),
    reused,
    created,
  };
}

module.exports = {
  createProfile,
  ensureProfiles,
  persistentProfiles,
  validateProfileId,
};
