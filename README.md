# 1browser

1browser exposes custom Chrome DevTools Protocol (CDP) methods for automating
authentication, persistent browser profiles, fingerprints, and proxies. The
repository includes a Node.js SDK that provides the safe lifecycle as a small,
stable API. Use the
[latest 1browser release](https://1browser.com/download/).

## Mandatory automation lifecycle

Every automation client MUST:

1. Launch the executable from `ONE_BROWSER_PATH`.
2. Use an explicit persistent `ONE_USER_DATA_DIR`.
3. Call `Browser.getAuthState({validateOnline: true})`.
4. Sign in only when the persisted session is unavailable.
5. Confirm authentication before profile operations.
6. Reuse the same user-data directory across runs.
7. Avoid `Browser.logout` unless the user explicitly requests logout.

See [Automation lifecycle](docs/automation-lifecycle.md) for the first-run and
repeated-run flows and [User data directory](docs/user-data-directory.md) for
storage requirements.

## Node.js SDK quick start

The SDK requires Node.js 22.12 or later, pins `puppeteer-core`, and never uses a
Puppeteer-downloaded browser. It is not published to npm yet; install it from
this repository:

```bash
npm install
```

To consume the current checkout from another local project, run
`npm install /absolute/path/to/1browser` in that project.

A minimal application looks like:

```js
const {OneBrowser, loadEnvironmentConfig} = require('@1browser/sdk');

const client = await OneBrowser.launch(loadEnvironmentConfig());
try {
  await client.ensureAuthenticated();
  const {profiles} = await client.ensureProfiles({
    count: 2,
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

See the [SDK package documentation](docs/node-sdk.md) for profiles,
errors, target resolution, TypeScript declarations, compatibility, and the
low-level CDP escape hatch.

Profile deletion is explicit through `deleteProfile(profileId)` or
`deleteProfiles(profileIds)`. The SDK never deletes extra profiles
automatically.

Profile creation methods handle the short account-policy refresh window after
authentication by waiting once for `getAvailableProfileCreationCount()` to
settle before treating a zero count as the real account limit.

## Examples

The examples consume the local SDK package:

```bash
cd examples/node
npm install
cp .env.example .env
```

Set these values in `.env`:

```dotenv
ONE_BROWSER_PATH=/absolute/path/to/1browser
ONE_USER_DATA_DIR=/absolute/path/to/persistent/1browser-automation-data
ONE_EMAIL=<email>
ONE_PASSWORD=<password>
```

`ONE_EMAIL` and `ONE_PASSWORD` are read only when the persisted session is not
signed in. Do not commit `.env`.

Run the canonical authentication and session-reuse example:

```bash
npm run auth
```

On the first run, it launches 1browser, checks the online auth state, signs in
if necessary, confirms authentication, and closes the browser without logging
out. On later runs with the same `ONE_USER_DATA_DIR`, it reuses the persisted
session and does not request credentials while that session remains valid.

Continue with the focused examples in [`examples/node`](examples/node):

- list existing profiles;
- create one profile after checking the account limit;
- open one active persistent profile;
- configure a user proxy;
- ensure and search from multiple deterministic profiles with bounded
  concurrency;
- explicitly log out.

## Profile CRUD integration test

The profile CRUD test uses a real browser and account. It creates uniquely
named profiles, verifies them by the returned `ProfileInfo.id`, deletes only
those exact IDs, and waits until they disappear from `Browser.getProfiles`.
It never selects deletion targets by name or list position.

Prepare the ignored local configuration:

```bash
cp .env.integration.example .env.integration
```

Set `ONE_BROWSER_PATH`, a dedicated persistent `ONE_USER_DATA_DIR`, and test
account credentials when the saved session is not already authenticated. Both
`ONE_BROWSER_INTEGRATION=1` and `ONE_BROWSER_PROFILE_CRUD=1` are required, so
ordinary `npm test` runs remain non-destructive.

The test waits up to `ONE_PROFILE_CRUD_QUOTA_TIMEOUT_MS` for the browser's
asynchronous account policy refresh before checking profile creation capacity.

Run only the CRUD integration test:

```bash
npm run test:integration:profile-crud
```

## Documentation

- [Automation lifecycle](docs/automation-lifecycle.md)
- [Authentication](docs/authentication.md)
- [User data directory](docs/user-data-directory.md)
- [CDP method reference](docs/cdp-api.md)
- [Node.js SDK](docs/node-sdk.md)
- [HTTP API](docs/api/index.md)
- [Instructions for AI agents](AGENTS.md)

API tokens for the HTTP API are available in the
[1browser app](https://app.1browser.com/api). CDP authentication tokens are
managed internally by the browser process and are never exposed to automation
clients.
