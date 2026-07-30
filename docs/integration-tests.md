# Real-browser integration tests

The integration suite launches an installed native 1Browser executable. It
does not use a Puppeteer-downloaded Chromium and cannot run with
`headless: true`.

## Prerequisites

- Node.js 22.12 or later.
- A native 1Browser build for the host operating system and architecture.
- An interactive desktop session, or X11/Wayland through `xvfb-run` on Linux.
- A dedicated test account.
- One persistent `ONE_USER_DATA_DIR` per runner. Never share it between
  concurrent processes.

Install dependencies and prepare the ignored environment file:

```bash
npm ci
cp .env.integration.example .env.integration
```

In Windows PowerShell, use:

```powershell
npm ci
Copy-Item .env.integration.example .env.integration
```

For real-browser tests, configure:

```dotenv
ONE_BROWSER_INTEGRATION=1
ONE_BROWSER_PATH=/absolute/path/to/native/1browser
ONE_USER_DATA_DIR=/absolute/path/to/persistent/sdk-integration-data
ONE_EMAIL=<test-account-email>
ONE_PASSWORD=<test-account-password>
```

`ONE_EMAIL` and `ONE_PASSWORD` are optional for a local interactive run but
recommended for unattended integration jobs. Keep `.env.integration` out of
version control.

The controlled interactive-auth integration tests use an in-process CDP
fixture and need no native browser or environment file:

```bash
npm run test:integration:controlled
```

## Test organization

Integration tests are grouped for independent extension:

```text
test/integration/
├── account/
│   ├── lifecycle.test.js
│   ├── interactive-fallback.controlled.test.js
│   ├── interactive-fallback.real.test.js
│   ├── login.test.js
│   ├── signup.test.js
│   └── verify.test.js
├── profiles/
│   ├── multi-profile.test.js
│   └── profile-crud.test.js
├── fingerprint/
│   ├── read.test.js
│   ├── write.test.js
│   └── generate.test.js
└── proxy/
    ├── read.test.js
    ├── write.test.js
    ├── actions.test.js
    └── paid-request.test.js
```

The runner always uses `--test-concurrency=1`. A persistent Chromium
user-data directory must not be opened by multiple browser processes at the
same time.

## Run one test

Pass a path relative to `test/integration`:

```bash
npm run test:integration:file -- account/login.test.js
npm run test:integration:file -- fingerprint/read.test.js
npm run test:integration:file -- proxy/write.test.js
```

The existing profile CRUD alias is:

```bash
npm run test:integration:profile-crud
```

## Run one group

```bash
npm run test:integration:account
npm run test:integration:profiles
npm run test:integration:fingerprint
npm run test:integration:proxy
```

## Run all groups

```bash
npm run test:integration
```

Without `ONE_BROWSER_INTEGRATION=1`, every real-browser test is reported as
skipped. Controlled integration tests still run. Tests with additional risk
or manual steps remain skipped until their own opt-in is enabled.

## Mutation and external-action flags

| Flag | Effect |
| --- | --- |
| `ONE_BROWSER_INTERACTIVE_AUTH=1` | Runs manual first-run interactive authentication and repeated-session reuse in `ONE_INTERACTIVE_USER_DATA_DIR`. |
| `ONE_BROWSER_PROFILE_CRUD=1` | Creates, lists, and deletes uniquely named test profiles. |
| `ONE_BROWSER_SIGNUP=1` | Creates a real account using `ONE_SIGNUP_EMAIL` and `ONE_SIGNUP_PASSWORD`. |
| `ONE_BROWSER_VERIFY=1` | Sends a verification email for the main test account. |
| `ONE_BROWSER_FINGERPRINT_WRITE=1` | Changes one setting on a test-owned profile, then deletes that profile. |
| `ONE_BROWSER_FINGERPRINT_GENERATE=1` | Generates a fingerprint on a test-owned profile, then deletes that profile. |
| `ONE_BROWSER_PROXY_WRITE=1` | Changes proxy settings on a test-owned profile, then deletes that profile. |
| `ONE_BROWSER_PROXY_ACTIONS=1` | Calls proxy health and new-proxy actions on a test-owned profile. |
| `ONE_BROWSER_PROXY_PAID_REQUEST=1` | Requests a new paid proxy for `ONE_PROXY_PAID_PROFILE_ID`; it may consume paid traffic. |

The signup test also requires
`ONE_SIGNUP_USER_DATA_DIR`. It must differ from the main
`ONE_USER_DATA_DIR`. Signup credentials must identify a new, previously
unused account, so this test is intentionally not repeatable with the same
email address.

The interactive-auth test requires a clean, dedicated
`ONE_INTERACTIVE_USER_DATA_DIR`. Do not configure credentials for this test.
After it opens 1Browser, complete login manually. The test confirms that
profile access begins after authentication, closes without logout, relaunches
with the same directory, and verifies that the persisted session does not open
another login target. Configure its bounds with:

```dotenv
ONE_BROWSER_INTERACTIVE_AUTH=1
ONE_INTERACTIVE_USER_DATA_DIR=/absolute/path/to/clean/interactive-auth-data
ONE_INTERACTIVE_AUTH_TIMEOUT_MS=300000
ONE_INTERACTIVE_AUTH_TEST_TIMEOUT_MS=360000
```

Fingerprint writes use:

```dotenv
ONE_FINGERPRINT_SETTING=screen_resolution
ONE_FINGERPRINT_TEST_VALUE=800x600
```

`ONE_FINGERPRINT_TEST_VALUE` is parsed as JSON when possible and otherwise
passed as a string.

Proxy writes use:

```dotenv
ONE_PROXY_TEST_URL=http://127.0.0.1:9
```

Use a controlled test proxy when connection behavior matters. Proxy URLs may
contain credentials and must never be printed or committed.

## Operating-system runners

The same npm commands work on every supported operating system. Only the
native executable and persistent directory paths differ:

| Host | Requirements |
| --- | --- |
| macOS | Native application bundle and an active logged-in GUI session. |
| Windows | Native `.exe` and an interactive desktop session. Use forward slashes in `.env` paths when convenient. |
| Linux | Native executable/AppImage and X11 or Wayland. On a headless server, run the headed browser inside Xvfb. |

Example Windows path syntax:

```dotenv
ONE_BROWSER_PATH=C:/Program Files/1Browser/1browser.exe
ONE_USER_DATA_DIR=C:/1browser-test-data/sdk-integration
```

Example Linux invocation with a virtual display:

```bash
xvfb-run -a npm run test:integration
```

For an OS matrix, use one native or self-hosted runner per OS and architecture.
Each runner needs its own installed 1Browser binary, credentials secret, and
user-data directory. Unit tests can run on ordinary hosted runners without a
browser:

```bash
npm run check
npm test
```
