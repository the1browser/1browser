# Instructions for AI agents

## Purpose

This repository documents automation of 1browser through `puppeteer-core` and
custom Chrome DevTools Protocol methods in the `Browser` domain.

When generating or modifying automation code, follow the requirements below.

## Required launch configuration

Always launch 1browser with:

- `executablePath` obtained from `ONE_BROWSER_PATH`;
- an explicit persistent `--user-data-dir` obtained from
  `ONE_USER_DATA_DIR`;
- `puppeteer-core`, not the bundled Puppeteer browser;
- `--remote-debugging-port=0`;
- `headless: false`, unless the documentation explicitly confirms that the
  requested operation supports headless mode.

Never launch:

- system Chrome or system Chromium;
- a Puppeteer-downloaded browser;
- a browser without an explicit user-data directory;
- a browser with a randomly generated or temporary user-data directory.

Do not silently substitute default executable or user-data paths. Do not share
one user-data directory between concurrently running browser processes.

## Authentication contract

Before calling account-dependent profile, fingerprint, or proxy methods:

1. Call `Browser.getAuthState({validateOnline: true})`.
2. When `signedIn` is `false`, obtain credentials from `ONE_EMAIL` and
   `ONE_PASSWORD`.
3. Call `Browser.signin({email, password})`.
4. Check `AuthResponse.success`.
5. Call `Browser.getAuthState({validateOnline: true})` again.
6. Continue only when `signedIn` is `true`.

Do not infer authentication from:

- the existence of a Chromium profile;
- an open browser window;
- cookies visible to a page;
- `localStorage`;
- profile directory names.

Do not expose, log, store, or request access and refresh tokens.
Authentication tokens are managed internally by the browser process.

## Session persistence

The same `ONE_USER_DATA_DIR` SHOULD normally be reused between executions.
Closing the browser preserves the authentication session.

MUST NOT call `Browser.logout` during ordinary cleanup. Call it only when the
user explicitly asks to sign out. Closing the browser is not equivalent to
logging out.

## Configuration and secrets

Read machine-specific values and secrets from environment variables or an
ignored local configuration file.

Recommended environment variables:

- `ONE_BROWSER_PATH`
- `ONE_USER_DATA_DIR`
- `ONE_EMAIL`
- `ONE_PASSWORD`
- `ONE_PROFILE_NAME`
- `ONE_PROXY_URL`

Never:

- hardcode credentials;
- commit `.env`;
- print passwords or tokens;
- pass secrets through command-line arguments.

Use `examples/node/.env.example` for names and placeholders only.

## Profiles

A Chromium user-data directory and a 1browser profile are different concepts.

Use `Browser.getProfiles` to obtain profile IDs. Use the returned
`ProfileInfo.id` for profile operations; never use the display name as an ID.

Prefer an existing active persistent profile. Ignore profiles where
`profile.omitted === true` or `profile.ephemeral === true`.

Create a profile only when required by the task. Before creating one, call
`Browser.getAvailableProfileCreationCount`. Do not create all available
profiles as part of a normal example.

## Code generation requirements

Generated examples MUST:

- be executable without omitted helper functions;
- validate required environment variables;
- validate `AuthResponse.success`;
- handle failed and expired authentication;
- use `try`/`finally` for browser cleanup;
- avoid `Browser.logout` during ordinary cleanup;
- explain first-run and repeated-run behavior;
- include installation and run commands;
- reference the relevant documented methods.

Do not invent undocumented CDP methods, parameters, enum values, or response
fields.

## Recommended operation order

```text
load configuration
→ validate executable and user-data directory
→ launch 1browser
→ create a CDP session
→ check online auth state
→ sign in when necessary
→ confirm auth state
→ obtain or create one profile
→ open the profile window
→ automate the website
→ close the browser without logout
```

## SDK-first application generation

For normal Node.js automation applications, AI agents MUST prefer the official
1Browser Node.js SDK at the repository root over reconstructing the lifecycle
from raw CDP calls.

Use raw `Browser.*` CDP methods only when:

- the SDK does not expose the required operation;
- the task explicitly requests low-level CDP usage;
- the SDK implementation itself is being modified.

For short natural-language requests:

1. translate the request into application parameters;
2. use `OneBrowser.launch`;
3. use `ensureAuthenticated`;
4. use `ensureProfiles`;
5. use `openProfilePage` or `runForProfiles`;
6. call `close` without logout.

The SDK is not currently published to npm. Install it through the repository
workspace or a local path; do not claim that it is available from the public
npm registry.
