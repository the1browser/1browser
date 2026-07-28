# @1browser/sdk

`@1browser/sdk` is a small CommonJS SDK over `puppeteer-core` and the
documented custom `Browser.*` CDP methods in 1Browser. It owns browser launch,
online authentication checks, deterministic profile selection, profile target
resolution, bounded task concurrency, and cleanup.

The package is prepared for publication but is not currently published to npm.

## Installation

From this repository root:

```bash
npm install
```

To install the current checkout into another local project, use:

```bash
npm install /absolute/path/to/1browser
```

From `examples/node`, the equivalent relative command is:

```bash
npm install ../..
```

Node.js 22.12 or later is required. The package pins `puppeteer-core` 25.3.0
and never downloads a browser.

## Quick start

```js
const {OneBrowser, loadEnvironmentConfig} = require('@1browser/sdk');

const client = await OneBrowser.launch(loadEnvironmentConfig());

try {
  await client.ensureAuthenticated();

  const {profiles} = await client.ensureProfiles({
    count: 5,
    namePrefix: 'Example Task',
  });

  const results = await client.runForProfiles({
    profiles,
    concurrency: 2,
    task: async ({page}) => {
      await page.goto('https://example.com', {
        waitUntil: 'domcontentloaded',
      });
      return {url: page.url(), title: await page.title()};
    },
  });

  console.table(results);
} finally {
  await client.close();
}
```

`close()` ends the browser process but never calls `Browser.logout`.

## Environment configuration

`loadEnvironmentConfig()` reads:

```dotenv
ONE_BROWSER_PATH=/absolute/path/to/1browser
ONE_USER_DATA_DIR=/absolute/path/to/persistent/1browser-data
ONE_EMAIL=user@example.com
ONE_PASSWORD=secret
```

The executable and user-data directory are always required. The SDK rejects
temporary user-data directories, creates a missing persistent directory, and
does not choose fallback paths. Credentials are optional until the persisted
session is unavailable.

Configuration can also be supplied directly:

```js
const client = await OneBrowser.launch({
  executablePath: process.env.ONE_BROWSER_PATH,
  userDataDir: process.env.ONE_USER_DATA_DIR,
  credentials: {
    email: process.env.ONE_EMAIL,
    password: process.env.ONE_PASSWORD,
  },
  launchArgs: ['--disable-sync'],
});
```

`headless` can only be omitted or set to `false`. Additional arguments cannot
override the persistent user-data directory or remote debugging port.

## Authentication and session reuse

`ensureAuthenticated()` always begins with
`Browser.getAuthState({validateOnline: true})`. If the persistent session is
valid, it returns without using credentials. Otherwise it calls
`Browser.signin`, validates `AuthResponse.success`, and polls the online state
for a bounded period.

Reuse the same `ONE_USER_DATA_DIR` across runs. The first run may need
credentials; later runs use the persisted authenticated session while valid.
Tokens stay inside 1Browser and are never exposed by this SDK.

Account-dependent SDK methods automatically establish authentication if the
caller has not already called `ensureAuthenticated()`.

## Profiles and ownership

`getPersistentProfiles()` excludes profiles with `omitted === true` or
`ephemeral === true`. `includeOmitted: true` includes omitted profiles but
still excludes ephemeral profiles.

`ensureProfiles()` supports three modes:

- `ensure-count` (default) reuses deterministic names and creates only missing
  profiles.
- `create-new` creates exactly the requested number of additional profiles
  after checking the full account limit.
- `use-existing` never creates profiles and fails if too few matches exist.

For a prefix `Search`, the first names are `Search 01`, `Search 02`, and so on.
Version 0.1 infers application ownership from these exact deterministic names;
1Browser does not currently expose a profile metadata tag for stronger
ownership. The SDK always passes `ProfileInfo.id`, never a display name, to
profile operations.

Creation modes check that the full account quota is available before creating
anything. The underlying CDP API is not transactional, so an unexpected
browser or transport failure during a multi-profile creation sequence can
still leave profiles that were created before that failure.

After authentication, 1Browser may refresh account policy asynchronously and
briefly report zero available profile slots. The SDK waits once per client for
that policy refresh before treating zero as the real limit. The public
`getAvailableProfileCreationCount()` method uses the same bounded wait:

```js
const available = await client.getAvailableProfileCreationCount({
  timeoutMs: 15_000,
  pollIntervalMs: 250,
});
```

Set `waitForPolicy: false` to perform a single immediate CDP read. Once the SDK
has observed a settled capacity, later zero values are returned immediately.

## Deleting profiles

Deletion is always explicit. `ensureProfiles()` never deletes profiles when a
later call requests a smaller count.

Delete one profile by its `ProfileInfo.id`:

```js
const result = await client.deleteProfile(profile.id);
console.log(result); // {profileId: '...', success: true}
```

The method throws `ProfileDeletionError` unless
`Browser.deleteProfileById` returns `{success: true}`.

Delete several explicitly selected IDs:

```js
const results = await client.deleteProfiles(
  profiles.map((profile) => profile.id),
);

for (const result of results) {
  if (!result.success) {
    console.error(result.profileId, result.error.message);
  }
}
```

The complete ID list is validated before the first deletion, duplicate IDs
are rejected, and deletions run sequentially. The result order matches the
input order. A browser failure for one ID is recorded in that ID's result and
does not hide or skip the remaining requested IDs.

Never pass display names to deletion methods. Names are not unique and the SDK
does not translate names or prefixes into IDs.

## Profile pages and target resolution

`openProfilePage(profile.id)` calls `Browser.createWindowForProfile`, observes
targets before that command, resolves the returned CDP `targetId`, and returns
the corresponding Puppeteer `Page`.

Puppeteer 25.3.0 has no public `Target.id()`. The compatibility boundary in
[`src/targets.js`](../src/targets.js) uses only public Puppeteer APIs: it
creates a CDP session for each candidate target and calls standard
`Target.getTargetInfo`. It does not read Puppeteer private fields. A future
public `Target.id()` is preferred automatically when available.

## Multi-profile execution

`runForProfiles()` defaults to concurrency `2`, preserves input ordering, and
returns one structured result per profile. A failed task does not stop other
tasks unless `stopOnError: true` is set. When stopping early, unstarted
profiles receive explicit failed results.

The runner closes only the `Page` it opened for each task. It does not close
the global browser or log out after an individual task.

## Errors

The public error hierarchy is:

- `OneBrowserError`
- `ConfigurationError`
- `BrowserLaunchError`
- `AuthenticationError`
- `AuthenticationTimeoutError`
- `ProfileError`
- `ProfileLimitError`
- `ProfileTargetError`
- `ProfileDeletionError`
- `ProfileTaskError`
- `ClientClosedError`

Every SDK error has a stable `code`. Error messages contain actionable counts
or response codes where available, but never credentials or tokens.

## Explicit logout

Logout is deliberately separate from cleanup:

```js
const client = await OneBrowser.launch(loadEnvironmentConfig());
try {
  await client.logout();
} finally {
  await client.close();
}
```

After explicit logout, the next run must authenticate again. Normal
applications should only call `close()`.

## Low-level CDP escape hatch

Use `client.send(method, params)` when the documented 1Browser operation is not
yet wrapped by the SDK, such as proxy or fingerprint configuration. It ensures
the client is authenticated but otherwise passes the command through
unchanged. Prefer the typed high-level methods when one exists.

## API reference

- `OneBrowser.launch(options)`
- `getAuthState(options?)`
- `ensureAuthenticated(options?)`
- `getProfiles()`
- `getPersistentProfiles(options?)`
- `getAvailableProfileCreationCount(options?)`
- `createProfile(name)`
- `deleteProfile(profileId)`
- `deleteProfiles(profileIds)`
- `ensureProfiles(options)`
- `openProfilePage(profileId, options?)`
- `runForProfiles(options)`
- `send(method, params?)`
- `logout()`
- `close()`
- `loadEnvironmentConfig(env?)`

The package includes TypeScript declarations for all public methods, options,
results, profile data, and error types.

## CDP mapping

The SDK maps directly to the documented methods:

| SDK method | Browser CDP methods |
| --- | --- |
| `ensureAuthenticated` | `getAuthState`, `signin` |
| `getProfiles` | `getProfiles` |
| `getAvailableProfileCreationCount` | `getAvailableProfileCreationCount` |
| `createProfile` | `getAvailableProfileCreationCount`, `createProfile` |
| `deleteProfile`, `deleteProfiles` | `deleteProfileById` |
| `ensureProfiles` | `getProfiles`, `getAvailableProfileCreationCount`, `createProfile` |
| `openProfilePage` | `createWindowForProfile` |
| `logout` | `logout` |

## Compatibility

| SDK version | Node.js | Puppeteer | 1Browser |
| --- | ---: | ---: | --- |
| 0.1.0 | >=22.12.0 | 25.3.0 | Current documented `Browser` CDP API |

Target matching is the most version-sensitive boundary and is isolated in
[`src/targets.js`](../src/targets.js).

## Security notes

Do not commit `.env`, credentials, local browser paths, user-data directories,
or screenshots containing sensitive data. Do not pass credentials through
command-line arguments. Never share a user-data directory between concurrent
browser processes.
