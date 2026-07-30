# Authentication

## Authentication decision tree

Before every account-dependent profile, fingerprint, proxy, window, or raw
authenticated CDP operation, the SDK establishes one shared authentication
attempt:

```text
getAuthState(validateOnline: true)
├── signedIn: true → reuse the persisted session
└── signedIn: false
    ├── auto + complete credentials → credential sign-in
    ├── auto + no credentials → interactive login
    ├── credentials-only + credentials → credential sign-in
    ├── interactive-only → interactive login
    └── error, or credentials-only without credentials → fail immediately
```

No account-dependent method runs until an online check returns
`signedIn: true`. An open browser window, Chromium profile, page cookie,
`localStorage` value, or directory name is not proof of authentication.

## Persisted session

Authentication is stored inside the persistent `userDataDir`. Reuse the same
application-specific directory on later runs. A valid session returns
immediately without reading credentials or opening a login window. Closing
1Browser preserves that session; `Browser.logout` is reserved for an explicit
sign-out request.

## Credential sign-in

Credential sign-in calls:

```js
Browser.signin({email, password})
```

The SDK validates `AuthResponse.success` and then polls
`Browser.getAuthState({validateOnline: true})` for at most 15 seconds by
default. A backend failure remains visible and does not silently fall back to
interactive login.

Credentials may come from method options, launch configuration,
`ONE_EMAIL`/`ONE_PASSWORD`, or ignored local secrets. Both values must be
non-empty. A partial pair throws
`ERR_ONE_BROWSER_AUTH_CREDENTIALS_INCOMPLETE`; remove the partial
configuration to use automatic interactive login, or select
`interactive-only`.

Never hardcode, commit, log, or pass credentials through command-line
arguments. Access and refresh tokens remain internal to 1Browser.

## Interactive login fallback

In the default `auto` mode, an unauthenticated session without credentials
causes the SDK to call `Browser.login()` exactly once. This opens the native
1Browser login UI. The SDK then polls the online state and continues
automatically after the user completes sign-in.

Applications can display guidance without making the SDK core write to
stdout:

```js
await client.ensureAuthenticated({
  onInteractiveLogin(target) {
    console.log(
      'Complete sign-in in the opened 1Browser window. ' +
      'Automation will continue automatically after authentication.',
    );
  },
});
```

The callback receives `{windowId, targetId}` once. It is a notification only;
the target itself is not treated as authenticated.

Concurrent account-dependent calls share one attempt, so they open only one
login window and use one polling loop. The shared attempt is cleared after
success or failure, allowing a later retry.

## Authentication modes

| Mode | Unauthenticated behavior |
| --- | --- |
| `auto` | Use a complete credential pair, otherwise open interactive login. This is the default. |
| `credentials-only` | Require both credentials and never open login UI. |
| `interactive-only` | Ignore configured credentials and open login UI. |
| `error` | Fail immediately without credentials or UI. |

Use `auto` for local applications. Use `credentials-only` for CI and scheduled
jobs that can provide secrets, or `error` when the persisted session is the
only allowed mechanism. Do not infer unattended mode from terminal detection.

## Timeout and cancellation

Credential confirmation defaults to 15 seconds, interactive login to 5
minutes, and polling to 500 milliseconds:

```js
auth: {
  mode: 'auto',
  timeoutMs: 15_000,
  interactiveTimeoutMs: 300_000,
  pollIntervalMs: 500,
}
```

Every timeout must be a positive finite number. Interactive expiry throws
`ERR_ONE_BROWSER_AUTH_INTERACTIVE_TIMEOUT`; credential confirmation uses
`ERR_ONE_BROWSER_AUTH_TIMEOUT`. Calling `close()` cancels a pending wait and
prevents queued account operations from starting.

The SDK never captures or saves credentials entered in the login UI. Only the
browser-managed authenticated session is persisted.

See the [canonical lifecycle](automation-lifecycle.md), [Node.js SDK](node-sdk.md),
and [integration tests](integration-tests.md).
