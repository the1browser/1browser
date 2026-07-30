# Instructions for AI agents

## Purpose

This repository documents automation of 1browser through `puppeteer-core` and
custom Chrome DevTools Protocol methods in the `Browser` domain.

When generating or modifying automation code, follow the requirements below.

## Required launch configuration

Always launch 1browser with:

- `executablePath` resolved from explicit configuration, `ONE_BROWSER_PATH`,
  ignored local configuration, or a verified native 1Browser installation;
- an explicit persistent `--user-data-dir` resolved from explicit
  configuration, `ONE_USER_DATA_DIR`, ignored local configuration, or the
  application-specific platform data directory;
- `puppeteer-core`, not the bundled Puppeteer browser;
- `--remote-debugging-port=0`;
- `headless: false`, unless the documentation explicitly confirms that the
  requested operation supports headless mode.

Never launch:

- system Chrome or system Chromium;
- a Puppeteer-downloaded browser;
- a browser without an explicit user-data directory;
- a browser with a randomly generated or temporary user-data directory.

Do not silently substitute system-browser executables, system-browser profile
directories, or temporary user-data paths. Do not share one user-data
directory between concurrently running browser processes.

## Authentication contract

Before calling account-dependent profile, fingerprint, or proxy methods:

1. Call `Browser.getAuthState({validateOnline: true})`.
2. Reuse a valid persisted session when `signedIn` is `true`.
3. When a complete credential pair is available and the authentication mode
   permits it, call `Browser.signin({email, password})` and check
   `AuthResponse.success`.
4. Otherwise, when interactive authentication is permitted, call
   `Browser.login()` and wait for the user to complete sign-in.
5. Poll `Browser.getAuthState({validateOnline: true})` for a bounded period.
6. Continue only after online authentication reports `signedIn: true`.

For local beginner applications, prefer `auth.mode = "auto"`. Do not ask a
beginner for credentials before attempting the documented interactive-login
fallback. For CI or unattended execution, use
`auth.mode = "credentials-only"` or `auth.mode = "error"`.

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

## Automatic application setup

For a short natural-language automation request, AI coding agents MUST perform
the complete mechanical setup. The agent must:

1. create the application directory;
2. initialize the Node.js project;
3. install the current local `@1browser/sdk`;
4. create complete source files;
5. create `.gitignore`;
6. create ignored local application configuration when needed;
7. select a stable application-specific user-data directory;
8. resolve the installed native 1Browser executable;
9. validate configuration;
10. run syntax checks and tests;
11. run the application when the local environment permits it;
12. report only values or actions that genuinely require user input.

Use the non-interactive scaffolder when starting a separate application:

```bash
node ./bin/create-onebrowser-app.js <application-id> --non-interactive
```

Then replace the generated task placeholders with the requested automation.
Use `resolveConfiguration({applicationId, options, env})`; it creates the
stable user-data directory and discovers known native installations.

AI agents MUST NOT delegate directory creation, `package.json` initialization,
dependency installation, source-file creation, `.gitignore` creation,
user-data-directory selection, example copying, or `.env.example` copying to
the beginner. Ask only for a genuinely undiscoverable executable path, manual
completion of interactive login, credentials explicitly required for
unattended execution, consent for a protected external action, or another
task-specific value that cannot be inferred safely.

## Profiles

A Chromium user-data directory and a 1browser profile are different concepts.

Use `Browser.getProfiles` to obtain profile IDs. Use the returned
`ProfileInfo.id` for profile operations; never use the display name as an ID.

Prefer an existing active persistent profile. Ignore profiles where
`profile.omitted === true` or `profile.ephemeral === true`.

Create a profile only when required by the task. Before creating one, call
`Browser.getAvailableProfileCreationCount`. Do not create all available
profiles as part of a normal example.

Delete profiles only when the user explicitly requests deletion. In Node.js
applications use the SDK's `deleteProfile` or `deleteProfiles` methods and
pass explicit `ProfileInfo.id` values. Never infer deletion targets from
display names, list positions, or a reduced `ensureProfiles` count. Check every
bulk deletion result.

## Code generation requirements

Generated examples MUST:

- be executable without omitted helper functions;
- validate environment variables required by the selected mode;
- validate `AuthResponse.success` whenever credential sign-in is used;
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
resolve configuration
→ validate executable and user-data directory
→ launch 1browser
→ create a CDP session
→ check online auth state
→ use credential sign-in when available, otherwise interactive login
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

The SDK exposes dedicated methods for authentication, profiles, fingerprints,
and proxies. Prefer `signup`, `login`, `verify`, fingerprint methods, and proxy
methods over sending their corresponding `Browser.*` commands manually.

For short natural-language requests:

1. scaffold and configure the application automatically;
2. translate the request into application parameters and task code;
3. use `resolveConfiguration`;
4. use `OneBrowser.launch`;
5. use `ensureAuthenticated`;
6. use `ensureProfiles`;
7. use `openProfilePage` or `runForProfiles`;
8. call `close` without logout;
9. run checks, tests, and the application when possible.

For large profile sets, keep `openingConcurrency` bounded independently from
task `concurrency`. Increase `openTimeoutMs` when native profile startup is
known to be slow; queued profiles do not consume this timeout until an opening
slot is available.

The SDK is not currently published to npm. Install it through the repository
workspace or a local path; do not claim that it is available from the public
npm registry.
