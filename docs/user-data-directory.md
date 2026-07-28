# User data directory

`--user-data-dir` stores browser-level persistent state, including the
1browser authentication session and the local Chromium profile registry.

It is not the same as a 1browser profile. A single user-data directory can
contain the registry for multiple 1browser profiles, each identified by the
`id` returned from `Browser.getProfiles`.

The automation client MUST obtain an explicit persistent directory from
`ONE_USER_DATA_DIR` and launch 1browser with:

```js
args: [
  '--remote-debugging-port=0',
  `--user-data-dir=${process.env.ONE_USER_DATA_DIR}`,
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

`browser.close()` preserves this data. `Browser.logout` changes the
authentication state and is not a cleanup operation.
