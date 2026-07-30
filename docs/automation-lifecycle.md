# Automation lifecycle

## Mandatory automation lifecycle

Every automation client MUST:

1. Resolve a verified native 1Browser executable.
2. Launch headed with an explicit persistent application user-data directory.
3. Check `Browser.getAuthState({validateOnline: true})`.
4. Reuse a valid persisted session.
5. Otherwise use complete configured credentials when the selected mode
   permits credential sign-in.
6. Otherwise open `Browser.login()` when interactive authentication is
   permitted and wait for manual sign-in.
7. Continue only after an online state reports `signedIn: true`.
8. Close without `Browser.logout`.

The Node.js SDK implements this through `resolveConfiguration`,
`OneBrowser.launch`, `ensureAuthenticated`, account-dependent methods, and
`close`.

## First run

```text
resolve configuration and persistent userDataDir
→ launch native 1Browser
→ getAuthState(validateOnline: true)
→ signedIn = false
→ complete credentials available?
  ├── yes: signin → validate success → bounded confirmation
  └── no: Browser.login → notify application → bounded manual-login wait
→ getAuthState(validateOnline: true) returns signedIn = true
→ work with profiles
→ close without logout
```

Credentials are optional for the normal local interactive workflow. The SDK
does not capture credentials entered in the login UI.

## Repeated run and expired sessions

```text
launch with the same userDataDir
→ online auth check returns signedIn = true
→ no signin and no login UI
→ work with profiles
```

If the persisted session expires, the selected credential or interactive
branch runs again. CI and scheduled jobs should explicitly select
`credentials-only` or `error` rather than relying on an interactive window.

## Profile operations

After authentication:

1. Call `Browser.getProfiles`.
2. Prefer a profile for which `omitted` and `ephemeral` are both `false`.
3. Use `ProfileInfo.id`, never a display name, for later operations.
4. Create a profile only when required.
5. Check `Browser.getAvailableProfileCreationCount` before creation.

Normal examples MUST NOT create every profile allowed by the account.
Concurrent account-dependent methods share one authentication attempt and
perform no profile call while interactive sign-in is pending or after it
times out.

## Cleanup and explicit logout

Use `try`/`finally` and call `close()` in `finally`. Closing cancels a pending
interactive wait, ends the browser process, and preserves the session.

Call `Browser.logout` only when the requested operation is explicit sign-out.
It invalidates the session and is not ordinary cleanup.

See [Authentication](authentication.md), [User data directory](user-data-directory.md),
and the [CDP method reference](cdp-api.md).
