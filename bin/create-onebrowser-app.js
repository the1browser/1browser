#!/usr/bin/env node
'use strict';

const path = require('node:path');

const {scaffoldApplication} = require('../src/scaffolding');

function usage() {
  return [
    'Usage: node ./bin/create-onebrowser-app.js <application-id> [options]',
    '',
    'Options:',
    '  --output-dir <directory>  Parent directory for the new application',
    '  --non-interactive         Disable interactive command output',
    '  --skip-install            Create files without installing (test/development only)',
    '  --help                    Show this help',
  ].join('\n');
}

function parseArguments(argv) {
  const result = {
    outputRoot: process.cwd(),
    install: true,
    nonInteractive: false,
  };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      result.help = true;
    } else if (argument === '--non-interactive') {
      result.nonInteractive = true;
    } else if (argument === '--skip-install') {
      result.install = false;
    } else if (argument === '--output-dir') {
      index += 1;
      if (!argv[index]) {
        throw new Error('--output-dir requires a directory.');
      }
      result.outputRoot = path.resolve(argv[index]);
    } else if (argument.startsWith('--')) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      positional.push(argument);
    }
  }
  if (positional.length > 1) {
    throw new Error('Only one application-id may be supplied.');
  }
  result.applicationId = positional[0];
  return result;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!options.applicationId) {
    throw new Error(`application-id is required.\n\n${usage()}`);
  }
  const result = scaffoldApplication(options);
  console.log(`Created ${result.applicationId} at ${result.targetDir}`);
  console.log(`Run: ${result.runCommand}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {main, parseArguments, usage};
