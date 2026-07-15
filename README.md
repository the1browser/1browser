# 1browser

## Getting Started

Where is token? API token is <a href="https://app.1browser.com/api" target="_blank">here</a>.

## Documentation

- [API](docs/api/index.md)
- [Browser automation over CDP](docs/cdp-api.md)

## Browser automation over CDP

1browser exposes experimental Chrome DevTools Protocol methods in the
`Browser` domain for local browser automation. These methods are useful when a
Node.js script needs to create persistent browser profiles, open a window for a
profile, update fingerprint or proxy settings, or run the 1browser auth flow
from the browser process.

See the full CDP method reference and usage examples in
[Browser automation over CDP](docs/cdp-api.md).

The browser must be launched with the matching feature flags. The API can be
called from Puppeteer through a raw CDP session.

```bash
npm install puppeteer-core
```

```js
const puppeteer = require('puppeteer-core');

async function main() {
  const browser = await puppeteer.launch({
    executablePath: process.env.ONE_BROWSER_PATH,
    headless: false,
    defaultViewport: null,
    args: [
      '--remote-debugging-port=0',
      '--user-data-dir=/tmp/onebrowser-cdp-profile',
      '--enable-features=DevToolsBrowserProfileMethods,DevToolsBrowserFingerprintMethods,DevToolsBrowserProxyMethods',
      '--no-first-run',
    ],
  });

  const page = await browser.newPage();
  const cdp = await page.target().createCDPSession();

  const { profiles } = await cdp.send('Browser.getProfiles');
  console.log(profiles);

  const { profile } = await cdp.send('Browser.createProfile', {
    name: 'Automation Profile',
  });

  const windowInfo = await cdp.send('Browser.createWindowForProfile', {
    profileId: profile.id,
  });
  console.log(windowInfo.windowId, windowInfo.targetId);

  // Opens the web login page. This does not accept email/password.
  await cdp.send('Browser.login');

  // Browser-process auth flow for an existing account.
  const signin = await cdp.send('Browser.signin', {
    email: 'email@example.com',
    password: 'password',
  });
  console.log(signin);

  await cdp.send('Browser.verify');
  await cdp.send('Browser.logout');

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

### CDP methods

All methods are in the `Browser` CDP domain.

| Method | Parameters | Returns |
| --- | --- | --- |
| `Browser.getProfiles` | none | `{ profiles: ProfileInfo[] }` |
| `Browser.createProfile` | `{ name?: string, hidden?: boolean }` | `{ profile: ProfileInfo }` |
| `Browser.createWindowForProfile` | `{ profileId: string }` | `{ windowId: number, targetId: string }` |
| `Browser.deleteProfileById` | `{ profileId: string }` | `{ success: boolean }` |
| `Browser.getFingerprintSetting` | `{ profileId?: string, name: string }` | `{ setting: object }` |
| `Browser.getFingerprintSettings` | `{ profileId?: string }` | `{ settings: object }` |
| `Browser.setFingerprintSetting` | `{ profileId?: string, name: string, value: any }` | `{ setting: object }` |
| `Browser.generateFingerprint` | `{ profileId?: string }` | `{ started: boolean }` |
| `Browser.getProxySettings` | `{ profileId?: string }` | `{ settings: object }` |
| `Browser.setProxySettings` | `{ profileId?: string, type: string, settings: object }` | `{ settings: object }` |
| `Browser.setProxyType` | `{ profileId?: string, type: string }` | `{ settings: object }` |
| `Browser.checkProxyConnection` | `{ profileId?: string }` | `{ started: boolean }` |
| `Browser.requestNewProxy` | `{ profileId?: string }` | `{ started: boolean }` |
| `Browser.login` | none | `{ windowId: number, targetId: string }` |
| `Browser.signup` | `{ email: string, password: string }` | `AuthResponse` |
| `Browser.signin` | `{ email: string, password: string }` | `AuthResponse` |
| `Browser.verify` | none | `AuthResponse` |
| `Browser.logout` | none | `AuthResponse` |

`Browser.login` opens the 1browser web login page and returns the opened tab
target. Use `Browser.signin` for the email/password backend auth flow.

`Browser.createProfile` creates a persistent Chrome profile under the current
`--user-data-dir`. `hidden: true` is not currently supported.

```ts
type ProfileInfo = {
  id: string;
  name: string;
  localName: string;
  path: string;
  omitted: boolean;
  signinRequired: boolean;
  ephemeral: boolean;
};

type AuthResponse = {
  success: boolean;
  responseCode: number;
  body?: string;
};
```

Auth responses do not expose tokens to the CDP client. When signup or signin
succeeds, the browser process reads the backend auth token internally and starts
the normal 1browser signin flow.
