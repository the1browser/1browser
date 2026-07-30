# Automation lifecycle

## Mandatory automation lifecycle

Every automation client MUST:

1. Resolve the verified native 1Browser executable from explicit options,
   `ONE_BROWSER_PATH`, ignored local configuration, or known install paths.
2. Pass `--user-data-dir` with an explicit persistent path from explicit
   options, `ONE_USER_DATA_DIR`, ignored local configuration, or the stable
   application-specific platform default.
3. Call `Browser.getAuthState({validateOnline: true})`.
4. Call `Browser.signin` only when the persisted session is unavailable.
5. Check `AuthResponse.success` and confirm the online auth state before
   account-dependent profile, fingerprint, or proxy operations.
6. Reuse the same user-data directory across runs.
7. Close the browser without calling `Browser.logout`.

`Browser.logout` is reserved for an explicit user request to sign out.

For Node.js applications, use the repository's
[`@1browser/sdk`](node-sdk.md) package. Its
`resolveConfiguration`, `OneBrowser.launch`, `ensureAuthenticated`, profile
methods, and `close` implement this lifecycle. Use raw CDP calls for operations
the SDK does not yet wrap or when working on the SDK itself.

## First run

```text
resolve configuration and launch with the application user-data directory
→ getAuthState(validateOnline: true)
→ signedIn = false
→ read ONE_EMAIL and ONE_PASSWORD
→ signin
→ validate AuthResponse.success
→ getAuthState(validateOnline: true)
→ signedIn = true
→ work with profiles
→ close browser without logout
```

Credentials are required only when the online auth check reports that no valid
persisted session is available.

## Repeated run

```text
resolve configuration and launch with the same user-data directory
→ getAuthState(validateOnline: true)
→ signedIn = true
→ do not read or request credentials
→ work with profiles
→ close browser without logout
```

If the persisted session has expired, follow the first-run authentication
branch and replace it with a newly authenticated session.

## Profile operations

After authentication:

1. Call `Browser.getProfiles`.
2. Prefer an existing profile for which `omitted` and `ephemeral` are both
   `false`.
3. Use `ProfileInfo.id`, never the display name, for later operations.
4. Create a profile only when the task requires one.
5. Before creating a profile, call
   `Browser.getAvailableProfileCreationCount`.

Normal examples MUST NOT create every profile allowed by the account.

## Cleanup

Use `try`/`finally` and close the Puppeteer browser in `finally`. Closing the
browser preserves the session in the resolved user-data directory.

## Explicit logout

Call `Browser.logout` only when the requested operation is to sign the user
out. Do not include it in normal automation cleanup.

Closing the browser is not equivalent to logging out:

- `browser.close()` ends the current browser process and preserves the
  persisted authentication session;
- `Browser.logout` invalidates or removes the authentication session.

See [Authentication](authentication.md), [User data directory](user-data-directory.md),
and the [CDP method reference](cdp-api.md).
