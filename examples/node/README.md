# Node.js examples

These examples require Node.js 22.12 or later and use the local
`@1browser/sdk` package to enforce the mandatory persistent-session lifecycle.
Install and configure them once:

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

`create-profile` creates exactly one profile and first checks the available
profile count. `open-profile` and `configure-proxy` select the first active
persistent profile returned by `Browser.getProfiles`.

`multi-profile-search` ensures the deterministic profile count configured by
`ONE_PROFILE_COUNT`, then searches Amazon with bounded concurrency. Amazon
markup varies, so the site adapter uses selector fallbacks and explicit
verification. It reports CAPTCHA or manual-verification pages clearly and
does not attempt to bypass them.

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
