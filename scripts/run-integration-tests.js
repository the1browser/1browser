'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const repositoryRoot = path.resolve(__dirname, '..');
const integrationRoot = path.join(repositoryRoot, 'test', 'integration');
const groups = new Set(['account', 'fingerprint', 'profiles', 'proxy']);

function integrationFiles(directory) {
  return fs
    .readdirSync(directory, {withFileTypes: true})
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return integrationFiles(entryPath);
      }
      return entry.isFile() && entry.name.endsWith('.test.js')
        ? [entryPath]
        : [];
    })
    .sort();
}

function relativeTestPath(file) {
  return path.relative(repositoryRoot, file);
}

function resolveTestFile(requested) {
  if (!requested) {
    throw new Error(
      'Pass a test path, for example account/login.test.js.',
    );
  }

  const candidate = path.resolve(integrationRoot, requested);
  const relative = path.relative(integrationRoot, candidate);
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    !candidate.endsWith('.test.js') ||
    !fs.statSync(candidate, {throwIfNoEntry: false})?.isFile()
  ) {
    throw new Error(
      `${requested} must identify a .test.js file inside test/integration.`,
    );
  }
  return candidate;
}

function selectedFiles(arguments_) {
  if (arguments_.length === 0) {
    return integrationFiles(integrationRoot);
  }

  const [option, value, ...extra] = arguments_;
  if (extra.length > 0) {
    throw new Error('Only one integration test selector may be used.');
  }
  if (option === '--group') {
    if (!groups.has(value)) {
      throw new Error(
        `Unknown integration group ${value ?? '<missing>'}. ` +
          `Expected one of: ${[...groups].join(', ')}.`,
      );
    }
    return integrationFiles(path.join(integrationRoot, value));
  }
  if (option === '--file') {
    return [resolveTestFile(value)];
  }
  throw new Error('Use --group <name>, --file <path>, or no selector.');
}

function main() {
  const files = selectedFiles(process.argv.slice(2));
  if (files.length === 0) {
    throw new Error('No integration tests matched the requested selector.');
  }

  console.log('Integration tests:');
  for (const file of files) {
    console.log(`- ${relativeTestPath(file)}`);
  }

  const result = spawnSync(
    process.execPath,
    [
      '--env-file=.env.integration',
      '--test',
      '--test-concurrency=1',
      ...files.map(relativeTestPath),
    ],
    {
      cwd: repositoryRoot,
      env: process.env,
      stdio: 'inherit',
    },
  );

  if (result.error) {
    throw result.error;
  }
  process.exitCode = result.status ?? 1;
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
