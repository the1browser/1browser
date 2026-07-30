'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const {ConfigurationError} = require('./errors');
const {sanitizeApplicationId} = require('./config');

function validateApplicationId(applicationId) {
  const sanitized = sanitizeApplicationId(applicationId);
  if (
    sanitized !== applicationId ||
    !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(applicationId)
  ) {
    throw new ConfigurationError(
      'application-id must use 1-64 lowercase letters, numbers, or single-purpose hyphens, and must start and end with a letter or number.',
      {code: 'ERR_ONE_BROWSER_APPLICATION_ID'},
    );
  }
  return sanitized;
}

function sdkDependency(_targetDir, sdkPath) {
  // npm resolves the project cwd through filesystem symlinks on some systems
  // (notably /var -> /private/var on macOS). An absolute local dependency
  // remains correct across that normalization.
  return `file:${sdkPath.split(path.sep).join('/')}`;
}

function projectFiles({applicationId, targetDir, sdkPath}) {
  const packageJson = {
    name: applicationId,
    version: '1.0.0',
    private: true,
    description: `1Browser automation application: ${applicationId}`,
    main: 'src/main.js',
    scripts: {
      check: 'node --check src/main.js && node --check src/task.js',
      doctor:
        `node node_modules/@1browser/sdk/bin/onebrowser-doctor.js ` +
        `--application-id ${applicationId}`,
      start: 'node src/main.js',
      test: 'npm run check',
    },
    engines: {
      node: '>=22.12.0',
    },
    dependencies: {
      '@1browser/sdk': sdkDependency(targetDir, sdkPath),
    },
  };

  const main = `'use strict';

const {OneBrowser, resolveConfiguration} = require('@1browser/sdk');
const task = require('./task');

const APPLICATION_ID = ${JSON.stringify(applicationId)};

async function main() {
  const configuration = await resolveConfiguration({
    applicationId: APPLICATION_ID,
    options: {},
    env: process.env,
  });
  const client = await OneBrowser.launch(configuration);
  try {
    await client.ensureAuthenticated({
      onInteractiveLogin() {
        console.log(
          'Complete sign-in in the opened 1Browser window. ' +
          'Automation will continue automatically after authentication.',
        );
      },
    });
    console.log('Authentication confirmed.');
    const {profiles} = await client.ensureProfiles({
      count: task.profileCount,
      namePrefix: task.profileNamePrefix,
    });
    const results = await client.runForProfiles({
      profiles,
      concurrency: task.concurrency,
      openingConcurrency: task.openingConcurrency,
      openTimeoutMs: task.openTimeoutMs,
      task: task.run,
    });
    console.table(results);
  } finally {
    // Closing preserves the authenticated session. Do not log out here.
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
`;

  const task = `'use strict';

module.exports = {
  // Replace these placeholders with the values from the user's task.
  profileCount: 1,
  profileNamePrefix: ${JSON.stringify(applicationId)},
  concurrency: 1,
  openingConcurrency: 2,
  openTimeoutMs: 30_000,

  async run({page, profile}) {
    // Replace this placeholder with the requested website automation.
    await page.goto('about:blank');
    return {
      profileId: profile.id,
      status: 'Task placeholder ready for implementation',
    };
  },
};
`;

  return new Map([
    ['package.json', `${JSON.stringify(packageJson, null, 2)}\n`],
    [
      '.gitignore',
      [
        'node_modules/',
        '.onebrowser/',
        '.env',
        '.env.*',
        '!.env.example',
        '*.log',
        '',
      ].join('\n'),
    ],
    [
      path.join('.onebrowser', 'config.json'),
      `${JSON.stringify({applicationId}, null, 2)}\n`,
    ],
    [path.join('src', 'main.js'), main],
    [path.join('src', 'task.js'), task],
  ]);
}

function runCommand(command, args, options, spawnSyncApi = spawnSync) {
  const result = spawnSyncApi(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env,
    shell: false,
    stdio: options.stdio ?? 'pipe',
  });
  if (result.error || result.status !== 0) {
    const detail = [result.error?.message, result.stderr, result.stdout]
      .filter(Boolean)
      .join('\n')
      .trim();
    throw new ConfigurationError(
      `${options.label} failed${detail ? `:\n${detail}` : '.'}`,
      {code: 'ERR_ONE_BROWSER_SCAFFOLD_COMMAND', cause: result.error},
    );
  }
}

function scaffoldApplication({
  applicationId,
  outputRoot = process.cwd(),
  sdkPath = path.resolve(__dirname, '..'),
  install = true,
  nonInteractive = false,
  fsApi = fs,
  spawnSyncApi = spawnSync,
  env = process.env,
} = {}) {
  const id = validateApplicationId(applicationId);
  const root = path.resolve(outputRoot);
  const targetDir = path.join(root, id);
  fsApi.mkdirSync(root, {recursive: true});
  try {
    fsApi.mkdirSync(targetDir);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new ConfigurationError(
        `Refusing to overwrite the existing path: ${targetDir}`,
        {code: 'ERR_ONE_BROWSER_SCAFFOLD_EXISTS'},
      );
    }
    throw error;
  }

  for (const [relativePath, contents] of projectFiles({
    applicationId: id,
    targetDir,
    sdkPath: path.resolve(sdkPath),
  })) {
    const destination = path.join(targetDir, relativePath);
    fsApi.mkdirSync(path.dirname(destination), {recursive: true});
    fsApi.writeFileSync(destination, contents, {
      encoding: 'utf8',
      flag: 'wx',
      mode: relativePath.startsWith('.onebrowser') ? 0o600 : 0o644,
    });
  }

  if (install) {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    runCommand(
      npm,
      ['install', '--no-audit', '--no-fund', '--ignore-scripts'],
      {
        cwd: targetDir,
        env,
        label: 'Local SDK installation',
        stdio: nonInteractive ? 'pipe' : 'inherit',
      },
      spawnSyncApi,
    );
  }

  for (const file of ['src/main.js', 'src/task.js']) {
    runCommand(
      process.execPath,
      ['--check', file],
      {
        cwd: targetDir,
        env,
        label: `Syntax check for ${file}`,
      },
      spawnSyncApi,
    );
  }

  return {
    applicationId: id,
    targetDir,
    installed: install,
    runCommand: `cd ${JSON.stringify(targetDir)} && npm start`,
  };
}

module.exports = {
  projectFiles,
  scaffoldApplication,
  validateApplicationId,
};
