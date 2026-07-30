'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const test = require('node:test');

const {
  scaffoldApplication,
  validateApplicationId,
} = require('../src/scaffolding');

const fixtureRoot = path.join(__dirname, `.scaffolding-${process.pid}`);
const sdkPath = path.resolve(__dirname, '..');

test.afterEach(() => {
  fs.rmSync(fixtureRoot, {recursive: true, force: true});
});

test('validates scaffolding application IDs', () => {
  assert.equal(validateApplicationId('amazon-search'), 'amazon-search');
  assert.throws(() => validateApplicationId('Amazon Search'), /lowercase/);
  assert.throws(() => validateApplicationId('../escape'), /lowercase/);
});

test('generates the project structure and ignored local configuration', () => {
  const result = scaffoldApplication({
    applicationId: 'generated-structure',
    outputRoot: fixtureRoot,
    sdkPath,
    install: false,
    nonInteractive: true,
  });
  const expected = [
    '.gitignore',
    '.onebrowser/config.json',
    'package.json',
    'src/main.js',
    'src/task.js',
  ];
  for (const relative of expected) {
    assert.equal(
      fs.existsSync(path.join(result.targetDir, relative)),
      true,
      `${relative} should be generated`,
    );
  }
  const gitignore = fs.readFileSync(
    path.join(result.targetDir, '.gitignore'),
    'utf8',
  );
  assert.match(gitignore, /^node_modules\/$/m);
  assert.match(gitignore, /^\.onebrowser\/$/m);
  assert.match(gitignore, /^\.env$/m);
  assert.equal(fs.existsSync(path.join(result.targetDir, '.env')), false);

  const main = fs.readFileSync(
    path.join(result.targetDir, 'src', 'main.js'),
    'utf8',
  );
  const task = fs.readFileSync(
    path.join(result.targetDir, 'src', 'task.js'),
    'utf8',
  );
  assert.match(main, /openingConcurrency: task\.openingConcurrency/);
  assert.match(main, /openTimeoutMs: task\.openTimeoutMs/);
  assert.match(task, /openingConcurrency: 2/);
  assert.match(task, /openTimeoutMs: 30_000/);
});

test('non-interactive scaffolding installs the local SDK and checks syntax', () => {
  const calls = [];
  const fakeSpawn = (command, args, options) => {
    calls.push({command, args, options});
    return {status: 0, stdout: '', stderr: ''};
  };
  scaffoldApplication({
    applicationId: 'non-interactive',
    outputRoot: fixtureRoot,
    sdkPath,
    nonInteractive: true,
    spawnSyncApi: fakeSpawn,
  });
  assert.equal(calls[0].args[0], 'install');
  assert.equal(calls[0].options.stdio, 'pipe');
  assert.deepEqual(
    calls.slice(1).map(({args}) => args),
    [
      ['--check', 'src/main.js'],
      ['--check', 'src/task.js'],
    ],
  );
});

test('repeated scaffolding refuses to overwrite the first project', () => {
  const options = {
    applicationId: 'repeat-safe',
    outputRoot: fixtureRoot,
    sdkPath,
    install: false,
    nonInteractive: true,
  };
  const first = scaffoldApplication(options);
  const marker = path.join(first.targetDir, 'src', 'task.js');
  const original = fs.readFileSync(marker, 'utf8');
  assert.throws(
    () => scaffoldApplication(options),
    (error) => error.code === 'ERR_ONE_BROWSER_SCAFFOLD_EXISTS',
  );
  assert.equal(fs.readFileSync(marker, 'utf8'), original);
});

test('end-to-end CLI scaffolding installs the SDK without an env copy', {
  timeout: 60_000,
}, () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'onebrowser-scaffold-e2e-'),
  );
  try {
    const cli = path.join(sdkPath, 'bin', 'create-onebrowser-app.js');
    const result = spawnSync(
      process.execPath,
      [
        cli,
        'e2e-agent-app',
        '--output-dir',
        temporaryRoot,
        '--non-interactive',
      ],
      {
        cwd: sdkPath,
        encoding: 'utf8',
        env: process.env,
      },
    );
    assert.equal(
      result.status,
      0,
      `${result.stderr}\n${result.stdout}`,
    );
    const application = path.join(temporaryRoot, 'e2e-agent-app');
    const resolution = spawnSync(
      process.execPath,
      ['-p', "require.resolve('@1browser/sdk')"],
      {
        cwd: application,
        encoding: 'utf8',
        env: process.env,
      },
    );
    assert.equal(
      resolution.status,
      0,
      `${resolution.stderr}\n${resolution.stdout}`,
    );
    assert.match(resolution.stdout.trim(), /src[/\\]index\.js$/);
    assert.equal(fs.existsSync(path.join(application, '.env')), false);
    assert.equal(
      fs.existsSync(path.join(application, '.onebrowser', 'config.json')),
      true,
    );
    const check = spawnSync('npm', ['run', 'check'], {
      cwd: application,
      encoding: 'utf8',
      env: process.env,
    });
    assert.equal(check.status, 0, `${check.stderr}\n${check.stdout}`);
  } finally {
    fs.rmSync(temporaryRoot, {recursive: true, force: true});
  }
});
