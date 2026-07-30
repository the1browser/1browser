# Authentication

## Contract

Before account-dependent profile, fingerprint, or proxy operations, an
automation client MUST:

1. Call `Browser.getAuthState({validateOnline: true})`.
2. Continue without credentials when `signedIn` is `true`.
3. Otherwise read `ONE_EMAIL` and `ONE_PASSWORD`.
4. Call `Browser.signin({email, password})`.
5. Check that the returned `AuthResponse.success` is `true`.
6. Call `Browser.getAuthState({validateOnline: true})` again.
7. Continue only when the confirmed state has `signedIn: true`.

`state` can be `signed_in`, `signed_out`, `expired`, or `unknown`. Treat every
state other than a response with `signedIn: true` as unauthenticated.

Do not infer authentication from an open window, a Chromium profile, page
cookies, `localStorage`, or directory names.

## Credentials and tokens

Read credentials from environment variables or an ignored local configuration
file. Never hardcode, commit, or print them. Do not pass credentials through
command-line arguments.

Access and refresh tokens are managed internally by the browser process. CDP
authentication responses do not expose them, and automation clients MUST NOT
attempt to extract them.

## Failed sign-in

`Browser.signin` can return a business error as `success: false` with a
`responseCode` and optional `body`. Validate `success`; do not assume that a
successful CDP transport means the user was signed in.

Because the browser may complete its internal sign-in flow asynchronously,
poll `Browser.getAuthState({validateOnline: true})` for a bounded period after
a successful sign-in response.

## Session reuse

Authentication is persisted in `ONE_USER_DATA_DIR`. Reuse that same directory
on repeated runs. A valid repeated run does not need to read or request
credentials.

## Explicit logout

Call `Browser.logout` only when the user explicitly requests sign-out. Never
call it from routine cleanup. Close the browser normally to preserve the
session.

See the [canonical lifecycle](automation-lifecycle.md) and the
[authentication examples](cdp-api.md#auth-examples).
