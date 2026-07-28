'use strict';

const {ProfileTaskError} = require('./errors');
const {baseResult, serializeError} = require('./results');

function validateRunOptions(options) {
  if (!options || typeof options !== 'object') {
    throw new ProfileTaskError('runForProfiles options are required.');
  }
  if (!Array.isArray(options.profiles)) {
    throw new ProfileTaskError('profiles must be an array.');
  }
  for (const profile of options.profiles) {
    if (!profile || typeof profile.id !== 'string' || profile.id.trim() === '') {
      throw new ProfileTaskError(
        'Every profile must contain a non-empty ProfileInfo.id.',
      );
    }
  }
  if (typeof options.task !== 'function') {
    throw new ProfileTaskError('task must be a function.');
  }
  const concurrency = options.concurrency ?? 2;
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new ProfileTaskError('concurrency must be a positive integer.');
  }
  if (
    options.stopOnError !== undefined &&
    typeof options.stopOnError !== 'boolean'
  ) {
    throw new ProfileTaskError('stopOnError must be a boolean.');
  }
  return {
    profiles: options.profiles,
    task: options.task,
    concurrency,
    stopOnError: options.stopOnError === true,
  };
}

async function closeOwnedPage(page) {
  if (!page || typeof page.close !== 'function') {
    return;
  }
  if (typeof page.isClosed === 'function' && page.isClosed()) {
    return;
  }
  await page.close();
}

async function runForProfiles(client, options) {
  const {profiles, task, concurrency, stopOnError} =
    validateRunOptions(options);
  const results = new Array(profiles.length);
  let nextIndex = 0;
  let stopped = false;

  async function worker() {
    while (!stopped) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= profiles.length) {
        return;
      }

      const profile = profiles[index];
      let page;
      try {
        const opened = await client.openProfilePage(profile.id);
        page = opened.page;
        const value = await task({profile, page, client});
        results[index] = {...baseResult(profile), success: true, value};
      } catch (error) {
        results[index] = {
          ...baseResult(profile),
          success: false,
          error: serializeError(error),
        };
        if (stopOnError) {
          stopped = true;
        }
      } finally {
        try {
          await closeOwnedPage(page);
        } catch (error) {
          if (results[index]?.success === true) {
            results[index] = {
              ...baseResult(profile),
              success: false,
              error: serializeError(
                new ProfileTaskError(
                  `Task succeeded, but its page could not be closed: ${error.message}`,
                  {cause: error},
                ),
              ),
            };
            if (stopOnError) {
              stopped = true;
            }
          }
        }
      }
    }
  }

  const workerCount = Math.min(concurrency, profiles.length);
  await Promise.all(Array.from({length: workerCount}, () => worker()));

  for (let index = 0; index < profiles.length; index += 1) {
    if (!results[index]) {
      results[index] = {
        ...baseResult(profiles[index]),
        success: false,
        error: serializeError(
          new ProfileTaskError(
            'Task was not started because stopOnError stopped the queue.',
          ),
        ),
      };
    }
  }
  return results;
}

module.exports = {
  runForProfiles,
  validateRunOptions,
};
