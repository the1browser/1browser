# User data directory

`--user-data-dir` stores browser-level persistent state, including the
1browser authentication session and the local Chromium profile registry.

It is not the same as a 1browser profile. A single user-data directory can
contain the registry for multiple 1browser profiles, each identified by the
`id` returned from `Browser.getProfiles`.

The automation client MUST resolve an explicit persistent directory and launch
1browser with:

```js
args: [
  '--remote-debugging-port=0',
  `--user-data-dir=${configuration.userDataDir}`,
]
```

Do not:

- omit `--user-data-dir`;
- use `/tmp` or another temporary directory;
- generate a new random directory on each run;
- fall back to the default system browser directory;
- share one directory between concurrently running browser processes.

Reuse the same directory on later runs to preserve authentication and the local
profile registry. Store it in a location with access restricted to the current
user because it contains browser state.

`getDefaultUserDataDir({applicationId})` sanitizes the application ID, creates
the directory automatically, and returns a stable platform-specific path:

- macOS: `~/Library/Application Support/1Browser/Automation/<application-id>`
- Windows: `%LOCALAPPDATA%\1Browser\Automation\<application-id>`
- Linux: `${XDG_DATA_HOME:-~/.local/share}/1browser/automation/<application-id>`

`resolveConfiguration()` uses this default only after explicit `userDataDir`,
`ONE_USER_DATA_DIR`, and ignored `.onebrowser/config.json` values. The default
is never an OS temporary directory and must not be shared by concurrent
browser processes.

`browser.close()` preserves this data. `Browser.logout` changes the
authentication state and is not a cleanup operation.
