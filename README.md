# 1browser

1browser exposes custom Chrome DevTools Protocol (CDP) methods for automating
authentication, persistent browser profiles, fingerprints, and proxies. The
repository includes a Node.js SDK that provides the safe lifecycle as a small,
stable API. Use the
[latest 1browser release](https://1browser.com/download/).

## Build with an AI coding agent

Give an AI coding agent the repository and the task in plain language:

```text
Use https://github.com/the1browser/1browser.

Launch the browser, ensure five profiles exist, and search amazon.com for
"iphone" from each profile.
```

The agent should create the application directory, initialize the Node.js
project, install the current local SDK, generate the source and ignored
configuration, discover the native 1Browser installation, choose a stable
application-specific user-data directory, run checks, and run the application
when possible. It should ask only for genuinely missing values, such as an
undiscoverable executable path or completion of interactive sign-in.

The repository provides a non-interactive scaffolder for that workflow:

```bash
node ./bin/create-onebrowser-app.js amazon-search --non-interactive
```

That command is for the coding agent to run as part of fulfilling the request;
the beginner does not need to create files, install dependencies, choose
storage paths, or copy an example environment file.

## Mandatory automation lifecycle

Every automation client MUST:

1. Resolve a verified native 1Browser executable.
2. Use an explicit persistent application-specific user-data directory.
3. Call `Browser.getAuthState({validateOnline: true})`.
4. Use complete configured credentials when available; otherwise open the
   native login UI and wait for manual sign-in.
5. Confirm authentication before profile operations.
6. Reuse the same user-data directory across runs.
7. Avoid `Browser.logout` unless the user explicitly requests logout.

See [Automation lifecycle](docs/automation-lifecycle.md) for the first-run and
repeated-run flows and [User data directory](docs/user-data-directory.md) for
storage requirements.

## Node.js SDK

The SDK requires Node.js 22.12 or later, pins `puppeteer-core`, and never uses a
Puppeteer-downloaded browser. It is not published to npm yet; the scaffolder
installs the current checkout into generated applications.

A minimal application looks like:

```js
const {OneBrowser, resolveConfiguration} = require('@1browser/sdk');

const config = await resolveConfiguration({
  applicationId: 'example-task',
  options: {},
  env: process.env,
});
const client = await OneBrowser.launch(config);
try {
  await client.ensureAuthenticated({
    onInteractiveLogin() {
      console.log(
        'Complete sign-in in the opened 1Browser window. ' +
        'Automation will continue automatically after authentication.',
      );
    },
  });
  const {profiles} = await client.ensureProfiles({
    count: 2,
    namePrefix: 'Example Task',
  });
  const results = await client.runForProfiles({
    profiles,
    concurrency: 2,
    openingConcurrency: 2,
    openTimeoutMs: 30_000,
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

`resolveConfiguration()` resolves each setting in this order:

```text
explicit SDK options
→ environment variables
→ .onebrowser/config.json and .onebrowser/secrets.json
→ known native 1Browser install locations or a stable platform data directory
→ actionable missing-value error
```

It never searches for or launches Chrome or Chromium. Default browser state is
stored per application under `~/Library/Application Support/1Browser/Automation`
on macOS, `%LOCALAPPDATA%\1Browser\Automation` on Windows, or
`${XDG_DATA_HOME:-~/.local/share}/1browser/automation` on Linux. Explicit
`userDataDir` and `ONE_USER_DATA_DIR` values override the default.

On the first run, the SDK checks the persisted authentication state. If no
session and no credentials are available, 1Browser opens its login UI and the
application waits for manual sign-in. Profile automation continues
automatically after online authentication is confirmed. Later runs reuse the
persisted session. Credentials are optional for local interactive use; CI and
scheduled jobs should select `auth.mode: 'credentials-only'` and provide both
values from an approved secret source.

Validate a generated or existing application with the doctor command:

```bash
node ./bin/onebrowser-doctor.js --application-id example-task
```

It checks Node.js, SDK availability, executable discovery, persistent storage,
write access, and user-data lock files without printing credentials. The
optional `--check-auth` flag launches 1Browser only to check its online auth
state, then closes it without logging out.

Profile deletion is explicit through `deleteProfile(profileId)` or
`deleteProfiles(profileIds)`. The SDK never deletes extra profiles
automatically.

Profile creation methods handle the short account-policy refresh window after
authentication by waiting once for `getAvailableProfileCreationCount()` to
settle before treating a zero count as the real account limit.

The SDK also provides typed wrappers for signup, web login, email verification,
fingerprint settings, fingerprint generation, proxy settings, proxy health
checks, and requesting a new catalog proxy. The raw `send()` method remains an
escape hatch for future documented CDP additions.

## Manual SDK development

This section is for contributors and advanced local development, not the
beginner AI-agent workflow.

Install this repository's dependencies:

```bash
npm install
```

To consume the checkout from an existing local project, run
`npm install /absolute/path/to/1browser` in that project.

## Manual example setup

This optional section is for developers who want to configure and run the
checked-in examples themselves. AI coding agents should create and configure a
new application automatically instead.

The examples consume the local SDK package:

```bash
cd examples/node
npm install
cp .env.example .env
```

The path overrides are optional when native discovery succeeds. Credentials
are also optional for local interactive use:

```dotenv
ONE_BROWSER_PATH=/absolute/path/to/1browser
ONE_USER_DATA_DIR=/absolute/path/to/persistent/1browser-automation-data
# Optional for unattended credential sign-in:
ONE_EMAIL=<email>
ONE_PASSWORD=<password>
```

`ONE_EMAIL` and `ONE_PASSWORD` are read only when the persisted session is not
signed in. Do not commit `.env`.

Run the canonical authentication and session-reuse example:

```bash
npm run auth
```

On the first run, it launches 1browser, checks the online auth state, uses
configured credentials or opens the native login UI, confirms authentication,
and closes without logging out. On later runs with the same
`ONE_USER_DATA_DIR`, it reuses the persisted session.

Continue with the focused examples in [`examples/node`](examples/node):

- list existing profiles;
- create one profile after checking the account limit;
- open one active persistent profile;
- configure a user proxy;
- ensure and search from multiple deterministic profiles with bounded
  concurrency;
- explicitly log out.

## Real-browser integration tests

The integration suite uses a native installed browser and a dedicated test
account. Tests are organized into account, profile, fingerprint, and proxy
groups. The cross-platform runner can execute one file, one group, or the
entire suite, always serially to protect the shared persistent user-data
directory.

Prepare the ignored local configuration:

```bash
cp .env.integration.example .env.integration
```

Set `ONE_BROWSER_PATH`, a dedicated persistent `ONE_USER_DATA_DIR`, and
`ONE_BROWSER_INTEGRATION=1`. Supply test-account credentials for unattended
runs; local interactive authentication is also supported. Mutating or
external actions have additional explicit opt-in flags, so ordinary
`npm test` runs remain non-destructive.

Run one test, one group, or all groups:

```bash
npm run test:integration:controlled
npm run test:integration:file -- account/login.test.js
npm run test:integration:fingerprint
npm run test:integration
```

The profile CRUD compatibility alias remains available:

```bash
npm run test:integration:profile-crud
```

See [Real-browser integration tests](docs/integration-tests.md) for every
group, risk flag, native OS requirement, and macOS/Linux/Windows setup.

## Documentation

- [Automation lifecycle](docs/automation-lifecycle.md)
- [Authentication](docs/authentication.md)
- [User data directory](docs/user-data-directory.md)
- [CDP method reference](docs/cdp-api.md)
- [Node.js SDK](docs/node-sdk.md)
- [Real-browser integration tests](docs/integration-tests.md)
- [HTTP API](docs/api/index.md)
- [Instructions for AI agents](AGENTS.md)

API tokens for the HTTP API are available in the
[1browser app](https://app.1browser.com/api). CDP authentication tokens are
managed internally by the browser process and are never exposed to automation
clients.
