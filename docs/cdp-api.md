# Browser automation over CDP

1browser exposes experimental Chrome DevTools Protocol methods in the
`Browser` domain for local automation. These methods let a script work with
persistent browser profiles, fingerprint masking settings, proxy settings, and
the 1browser auth flow from the browser process.

The API is available only when the browser is launched with the matching
feature flags. Enable all local automation methods with:

```text
--enable-features=DevToolsBrowserProfileMethods,DevToolsBrowserFingerprintMethods,DevToolsBrowserProxyMethods
```

```bash
npm install puppeteer-core
```

Set `ONE_BROWSER_PATH` to the installed 1browser executable path before running
the script. If the script signs in with `Browser.signin`, also set `ONE_EMAIL`
and `ONE_PASSWORD`:

```bash
# macOS
export ONE_BROWSER_PATH="/Applications/1browser.app/Contents/MacOS/1browser"
export ONE_EMAIL="<email>"
export ONE_PASSWORD="<password>"

# Linux
export ONE_BROWSER_PATH="/path/to/1browser"
export ONE_EMAIL="<email>"
export ONE_PASSWORD="<password>"
```

```powershell
# Windows PowerShell
$env:ONE_BROWSER_PATH = "C:\Path\To\1browser.exe"
$env:ONE_EMAIL = "<email>"
$env:ONE_PASSWORD = "<password>"
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
      '--no-first-run',
    ],
  });

  const page = await browser.newPage();
  const cdp = await page.target().createCDPSession();

  // Check whether the persisted auth session is still valid.
  const authState = await cdp.send('Browser.getAuthState', {
    validateOnline: true,
  });

  if (!authState.signedIn) {
    const email = process.env.ONE_EMAIL;
    const password = process.env.ONE_PASSWORD;

    if (!email || !password) {
      throw new Error('Set ONE_EMAIL and ONE_PASSWORD before running this script.');
    }

    // Browser-process auth flow for an existing account.
    const signin = await cdp.send('Browser.signin', {
      email,
      password,
    });
    console.log(signin);
  }

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  await delay(5000);

  const { profiles } = await cdp.send('Browser.getProfiles');
  console.log(profiles);

  const { count } = await cdp.send('Browser.getAvailableProfileCreationCount');
  console.log(`Profiles left to create: ${count}`);

  if (count <= 0) {
    throw new Error('No profiles left to create for the current account.');
  }

  for (let index = 0; index < count; index += 1) {
    const { profile } = await cdp.send('Browser.createProfile', {
      name: `Automation Profile ${index + 1}`,
    });
    console.log(profile);

    const windowInfo = await cdp.send('Browser.createWindowForProfile', {
      profileId: profile.id,
    });
    console.log(windowInfo.windowId, windowInfo.targetId);
  }

  await cdp.send('Browser.verify');
  await cdp.send('Browser.logout');

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

## Methods

All methods are in the `Browser` CDP domain.

| Method | Parameters | Returns |
| --- | --- | --- |
| `Browser.getProfiles` | none | `{ profiles: ProfileInfo[] }` |
| `Browser.getAvailableProfileCreationCount` | none | `{ count: number }` |
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
| `Browser.getAuthState` | `{ validateOnline?: boolean }` | `AuthState` |
| `Browser.signup` | `{ email: string, password: string }` | `AuthResponse` |
| `Browser.signin` | `{ email: string, password: string }` | `AuthResponse` |
| `Browser.verify` | none | `AuthResponse` |
| `Browser.logout` | none | `AuthResponse` |

`Browser.login` opens the 1browser web login page and returns the opened tab
target. Use `Browser.signin` for the email/password backend auth flow.
`Browser.getAuthState` checks the current browser auth state without reading
URLs, cookies, localStorage, or page DOM. With `validateOnline: true`, the
browser validates the persisted refresh token before returning `signed_in`.

## Types

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

type AuthState = {
  signedIn: boolean;
  state: 'signed_in' | 'signed_out' | 'expired' | 'unknown';
  email?: string;
  userId?: string;
  reason?: string;
};
```

Auth responses do not expose access or refresh tokens to the CDP client. When
`Browser.signup` or `Browser.signin` succeeds, the browser process reads the
backend auth token internally and starts the normal 1browser signin flow.

## Profile examples

List persistent profiles:

```js
const {profiles} = await cdp.send('Browser.getProfiles');
```

Get how many more persistent profiles can be created:

```js
const {count} = await cdp.send('Browser.getAvailableProfileCreationCount');
```

The value is based on the current account profile limit and the number of
active, non-omitted profiles.

Create a persistent profile under the current `--user-data-dir`:

```js
const {profile} = await cdp.send('Browser.createProfile', {
  name: 'Test User',
});
```

Open a new browser window for a profile:

```js
const {windowId, targetId} = await cdp.send('Browser.createWindowForProfile', {
  profileId: profile.id,
});
```

Delete a persistent profile by id:

```js
const {success} = await cdp.send('Browser.deleteProfileById', {
  profileId: profile.id,
});
```

Use the `id` returned in `ProfileInfo`. Do not use the display name as a
profile id: multiple profiles can have the same name.

## Fingerprint examples

Read one fingerprint masking setting:

```js
const {setting} = await cdp.send('Browser.getFingerprintSetting', {
  profileId: profile.id,
  name: 'screen_resolution',
});
```

Read all supported fingerprint masking settings:

```js
const {settings} = await cdp.send('Browser.getFingerprintSettings', {
  profileId: profile.id,
});
```

Write one fingerprint masking setting:

```js
const {setting} = await cdp.send('Browser.setFingerprintSetting', {
  profileId: profile.id,
  name: 'screen_resolution',
  value: '800x600',
});
```

Start backend fingerprint regeneration:

```js
const {started} = await cdp.send('Browser.generateFingerprint', {
  profileId: profile.id,
});
```

`profileId` is optional for fingerprint methods. If it is omitted, the browser
uses the default loaded profile. The shape of `setting` and `settings` matches
the payload used by the browser settings UI.

## Proxy examples

Read proxy settings:

```js
const {settings} = await cdp.send('Browser.getProxySettings', {
  profileId: profile.id,
});
```

Write proxy settings:

```js
const {settings} = await cdp.send('Browser.setProxySettings', {
  profileId: profile.id,
  type: 'User proxy',
  settings: {
    user: 'http://user:pass@host:8080',
    free: '',
    tor: '',
    datacenter: '',
    mobile: '',
    resident: '',
  },
});
```

`type` must be one of:

- `No proxy`
- `User proxy`
- `Free proxy`
- `Free Tor proxy`
- `Datacenter proxy`
- `Mobile proxy`
- `Resident proxy`

`setProxySettings` always expects the full proxy settings object. Fill the
field for the proxy type you want to use, and keep the other fields as their
current values from `Browser.getProxySettings` or as empty strings. Country
fields use country codes from the corresponding `countriesSelect` list in
`settings.availableProxies`.

Disable proxy:

```js
const {settings} = await cdp.send('Browser.setProxySettings', {
  profileId: profile.id,
  type: 'No proxy',
  settings: {
    user: '',
    free: '',
    tor: '',
    datacenter: '',
    mobile: '',
    resident: '',
  },
});
```

Use a custom user proxy:

```js
const {settings} = await cdp.send('Browser.setProxySettings', {
  profileId: profile.id,
  type: 'User proxy',
  settings: {
    user: 'http://user:pass@host:8080',
    free: '',
    tor: '',
    datacenter: '',
    mobile: '',
    resident: '',
  },
});
```

Use a free proxy in Italy:

```js
const {settings} = await cdp.send('Browser.setProxySettings', {
  profileId: profile.id,
  type: 'Free proxy',
  settings: {
    user: '',
    free: 'IT',
    tor: '',
    datacenter: '',
    mobile: '',
    resident: '',
  },
});
```

Use a free Tor proxy in the United States:

```js
const {settings} = await cdp.send('Browser.setProxySettings', {
  profileId: profile.id,
  type: 'Free Tor proxy',
  settings: {
    user: '',
    free: '',
    tor: 'US',
    datacenter: '',
    mobile: '',
    resident: '',
  },
});
```

Use a datacenter proxy in Germany:

```js
const {settings} = await cdp.send('Browser.setProxySettings', {
  profileId: profile.id,
  type: 'Datacenter proxy',
  settings: {
    user: '',
    free: '',
    tor: '',
    datacenter: 'DE',
    mobile: '',
    resident: '',
  },
});
```

Use a mobile proxy in France:

```js
const {settings} = await cdp.send('Browser.setProxySettings', {
  profileId: profile.id,
  type: 'Mobile proxy',
  settings: {
    user: '',
    free: '',
    tor: '',
    datacenter: '',
    mobile: 'FR',
    resident: '',
  },
});
```

Use a residential proxy in Spain:

```js
const {settings} = await cdp.send('Browser.setProxySettings', {
  profileId: profile.id,
  type: 'Resident proxy',
  settings: {
    user: '',
    free: '',
    tor: '',
    datacenter: '',
    mobile: '',
    resident: 'ES',
  },
});
```

Change only the active proxy type:

```js
const {settings} = await cdp.send('Browser.setProxyType', {
  profileId: profile.id,
  type: 'No proxy',
});
```

Start proxy health verification:

```js
const {started} = await cdp.send('Browser.checkProxyConnection', {
  profileId: profile.id,
});
```

Request a new catalog proxy for the current paid proxy type and country:

```js
const {started} = await cdp.send('Browser.requestNewProxy', {
  profileId: profile.id,
});
```

`profileId` is optional for proxy methods. If it is omitted, the browser uses
the default loaded profile. `setProxySettings.settings` must contain the keys
`user`, `free`, `tor`, `datacenter`, `mobile`, and `resident`.

Successful `getProxySettings`, `setProxySettings`, and `setProxyType` calls
return the same settings shape used by `chrome://settings/manageProxy`:

```json
{
  "settings": {
    "userProxy": "http://user:pass@host:8080",
    "publicIP": "64.190.76.13",
    "timezone": "Europe/Rome",
    "city": "Turin",
    "proxyStatusString": "update proxy done",
    "proxyStatus": "ProxyOk",
    "currentProxy": "Free proxy",
    "fingerprintCheck": {
      "checkerStatus": "approved",
      "fingerprintStatus": "consistent"
    },
    "availableProxies": {
      "Free proxy": {
        "countryValue": "IT",
        "countriesSelect": [
          {"name": "Italy", "value": "IT", "is_selected": true}
        ]
      },
      "Free Tor proxy": {
        "countryValue": "US",
        "countriesSelect": []
      },
      "Datacenter proxy": {
        "countryValue": "DE",
        "countriesSelect": [],
        "trafficRemaining": "1.00 GB"
      },
      "Mobile proxy": {
        "countryValue": "FR",
        "countriesSelect": [],
        "trafficRemaining": "1.00 GB"
      },
      "Resident proxy": {
        "countryValue": "ES",
        "countriesSelect": [],
        "trafficRemaining": "1.00 GB"
      }
    },
    "selectInfo": [
      {
        "name": "Free proxy",
        "value": "Public proxies for quick tests only; unreliable and risky.",
        "is_selected": true,
        "disabled": false
      }
    ],
    "trafficPurchasePlans": [],
    "trafficPricePerGb": 0,
    "defaultTrafficPurchasePlanName": ""
  }
}
```

The info chips in `chrome://settings/manageProxy` are populated from this
response:

- Type: `settings.currentProxy`
- Your IP: `settings.publicIP`
- Location: `settings.city`
- Timezone: `settings.timezone`
- IPhey status: `settings.fingerprintCheck.checkerStatus`
- Fingerprint status: `settings.fingerprintCheck.fingerprintStatus`

Proxy health status can be `ProxyOk`, `ProxyCheckHealthInProgress`,
`ProxyCheckHealthFailed`, `ProxyCheckHealthLongTimeout`,
`ProxyCheckHealthVeryLongTimeout`, `ProxyChanged`, `ProxyChangingIp`,
`ProxyNotFound`, or `ProxyStatusUnknown`.

`setProxySettings` and `setProxyType` return immediately after browser-side
settings are updated. For catalog proxy types, fetching the actual
`connectionString` and refreshing `publicIP`, `city`, `timezone`, and
fingerprint status can finish later. Poll `Browser.getProxySettings` or call
`Browser.checkProxyConnection` and wait until `proxyStatus` reaches a terminal
value such as `ProxyOk` or `ProxyCheckHealthFailed`.

Action methods return only whether the browser started the action:

```json
{"started": true}
```

`Browser.checkProxyConnection` returns `{"started": false}` for an empty
`User proxy`. `Browser.requestNewProxy` returns `{"started": false}` when the
current type is not `Datacenter proxy`, `Mobile proxy`, or `Resident proxy`, or
when paid proxy traffic is exhausted.

Invalid proxy requests fail as CDP errors rather than settings payloads:

```json
{"error": {"code": -32602, "message": "type must not be empty"}}
```

```json
{"error": {"code": -32000, "message": "Unknown proxy type"}}
```

```json
{"error": {"code": -32000, "message": "settings must contain string fields: user, free, tor, datacenter, mobile, resident"}}
```

## Auth examples

Check whether the current browser session is signed in:

```js
const authState = await cdp.send('Browser.getAuthState', {
  validateOnline: true,
});

if (!authState.signedIn) {
  await cdp.send('Browser.login');
}
```

Use this before login/signin when reusing the same `--user-data-dir`. If the
session is still valid, repeated authorization is not required. If the token is
expired or the session is missing, `signedIn` is `false` and `state` is
`signed_out`, `expired`, or `unknown`.

Open the web login page:

```js
const {windowId, targetId} = await cdp.send('Browser.login');
```

Sign up and start the browser signin flow:

```js
const signup = await cdp.send('Browser.signup', {
  email: process.env.ONE_EMAIL,
  password: process.env.ONE_PASSWORD,
});

if (!signup.success) {
  throw new Error(`Signup failed: ${signup.responseCode} ${signup.body ?? ''}`);
}
```

Sign in an existing account:

```js
const signin = await cdp.send('Browser.signin', {
  email: process.env.ONE_EMAIL,
  password: process.env.ONE_PASSWORD,
});

if (!signin.success) {
  throw new Error(`Signin failed: ${signin.responseCode} ${signin.body ?? ''}`);
}
```

Send email verification for the current user:

```js
const verify = await cdp.send('Browser.verify');
```

Sign out the current user:

```js
const logout = await cdp.send('Browser.logout');
```

Backend business errors, such as invalid credentials or an already registered
email, are returned as `success: false`, `responseCode`, and optional raw
`body`. They are not necessarily CDP protocol errors.

## Raw CDP payloads

Any CDP WebSocket client can call the same methods directly:

```json
{"id":1,"method":"Browser.getProfiles"}
```

```json
{"id":2,"method":"Browser.getAvailableProfileCreationCount"}
```

```json
{"id":3,"method":"Browser.createProfile","params":{"name":"Test User"}}
```

```json
{"id":4,"method":"Browser.createWindowForProfile","params":{"profileId":"Profile 1"}}
```

```json
{"id":5,"method":"Browser.deleteProfileById","params":{"profileId":"Profile 1"}}
```

```json
{"id":6,"method":"Browser.getFingerprintSetting","params":{"profileId":"Profile 1","name":"screen_resolution"}}
```

```json
{"id":7,"method":"Browser.getFingerprintSettings","params":{"profileId":"Profile 1"}}
```

```json
{"id":8,"method":"Browser.setFingerprintSetting","params":{"profileId":"Profile 1","name":"screen_resolution","value":"800x600"}}
```

```json
{"id":9,"method":"Browser.generateFingerprint","params":{"profileId":"Profile 1"}}
```

```json
{"id":10,"method":"Browser.getProxySettings","params":{"profileId":"Profile 1"}}
```

```json
{"id":11,"method":"Browser.setProxySettings","params":{"profileId":"Profile 1","type":"User proxy","settings":{"user":"http://user:pass@host:8080","free":"","tor":"","datacenter":"","mobile":"","resident":""}}}
```

```json
{"id":12,"method":"Browser.setProxyType","params":{"profileId":"Profile 1","type":"No proxy"}}
```

```json
{"id":13,"method":"Browser.checkProxyConnection","params":{"profileId":"Profile 1"}}
```

```json
{"id":14,"method":"Browser.requestNewProxy","params":{"profileId":"Profile 1"}}
```

```json
{"id":15,"method":"Browser.login"}
```

```json
{"id":16,"method":"Browser.getAuthState","params":{"validateOnline":true}}
```

```json
{"id":17,"method":"Browser.signup","params":{"email":"<email>","password":"<password>"}}
```

```json
{"id":18,"method":"Browser.signin","params":{"email":"<email>","password":"<password>"}}
```

```json
{"id":19,"method":"Browser.verify"}
```

```json
{"id":20,"method":"Browser.logout"}
```

## Troubleshooting

`Unknown method` or `Method not found` means the running 1browser build does not
include that custom CDP method in its generated protocol and browser handler.

`Browser.verify` and `Browser.logout` use the current access token only if it is
already available in the browser process. The methods return the backend
response code and body when the backend rejects the request.
