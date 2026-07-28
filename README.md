# 1browser

1browser exposes custom Chrome DevTools Protocol (CDP) methods for automating
authentication, persistent browser profiles, fingerprints, and proxies. Use the
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

## Quick start

The example requires Node.js and `puppeteer-core`; it never uses a
Puppeteer-downloaded browser.

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
- explicitly log out.

## Documentation

- [Automation lifecycle](docs/automation-lifecycle.md)
- [Authentication](docs/authentication.md)
- [User data directory](docs/user-data-directory.md)
- [CDP method reference](docs/cdp-api.md)
- [HTTP API](docs/api/index.md)
- [Instructions for AI agents](AGENTS.md)

API tokens for the HTTP API are available in the
[1browser app](https://app.1browser.com/api). CDP authentication tokens are
managed internally by the browser process and are never exposed to automation
clients.
