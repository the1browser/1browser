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

The first run may sign in with `ONE_EMAIL` and `ONE_PASSWORD`. Repeated runs
reuse the same `ONE_USER_DATA_DIR` and deterministic profile names. Only
`npm run logout` explicitly signs out.
