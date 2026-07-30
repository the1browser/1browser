# Node.js examples

These examples require Node.js 22.12 or later and use the local
`@1browser/sdk` package to enforce the mandatory persistent-session lifecycle.

## AI-agent setup

Give the agent a task such as “ensure five profiles and search Amazon for
iphone from each profile.” The agent should create a separate application with
the repository scaffolder, install the local SDK, replace the task
placeholders, create ignored local configuration, discover the native browser,
run checks, and run the application. It must not ask the beginner to copy this
directory or an example environment file.

The examples themselves now use `resolveConfiguration()`, so native discovery
and a stable `1browser-node-examples` user-data directory work without manual
path selection when exactly one known installation is available.

## Manual setup

This is an optional developer workflow for running the checked-in examples:

```bash
npm install
cp .env.example .env
```

Edit `.env` with an explicit 1browser executable and persistent user-data
directory. Credentials are used only when the persisted session is not
authenticated.

Run one operation at a time:

```bash
npm run auth
npm run list-profiles
npm run create-profile
npm run open-profile
npm run configure-proxy
npm run multi-profile-search
npm run logout
npm run signup
npm run web-login
npm run verify-email
npm run fingerprint-settings
npm run proxy-actions
```

Only `npm run logout` calls `Browser.logout`. Every other example closes the
browser without logging out so later runs can reuse the session.

## Integration-test setup

Real-browser integration tests are separate, explicit, and opt-in because some
groups mutate profiles or can request paid operations. Follow
[`../../docs/integration-tests.md`](../../docs/integration-tests.md); ordinary
example or unit-test setup never enables those flags.

`create-profile` creates exactly one profile and first checks the available
profile count. `open-profile` and `configure-proxy` select the first active
persistent profile returned by `Browser.getProfiles`.

`multi-profile-search` ensures the deterministic profile count configured by
`ONE_PROFILE_COUNT`, then searches Amazon with bounded concurrency. Amazon
markup varies, so the site adapter uses selector fallbacks and explicit
verification. It reports CAPTCHA or manual-verification pages clearly and
does not attempt to bypass them.

`ONE_CONCURRENCY` controls active profile tasks,
`ONE_OPENING_CONCURRENCY` separately limits simultaneous window starts, and
`ONE_PROFILE_OPEN_TIMEOUT_MS` controls target resolution after an opening slot
is acquired.

The new account and settings examples cover every typed auth, fingerprint,
and proxy wrapper:

- `signup` creates a new account only with `ONE_ALLOW_SIGNUP=1` and the
  separate `ONE_SIGNUP_EMAIL` / `ONE_SIGNUP_PASSWORD` credentials.
- `web-login` opens the interactive 1Browser login page and waits for Enter
  before checking the online auth state.
- `verify-email` sends a verification email only with `ONE_ALLOW_VERIFY=1`.
- `fingerprint-settings` reads one and all settings. It writes only when
  `ONE_FINGERPRINT_VALUE` is non-empty and regenerates only when
  `ONE_GENERATE_FINGERPRINT=1`.
- `proxy-actions` reads the current proxy, optionally applies
  `ONE_PROXY_TYPE`, starts a connection check, and requests a new paid catalog
  proxy only with `ONE_REQUEST_NEW_PROXY=1`.

The first run may sign in with `ONE_EMAIL` and `ONE_PASSWORD`. Repeated runs
reuse the same `ONE_USER_DATA_DIR` and deterministic profile names. Only
`npm run logout` explicitly signs out.
