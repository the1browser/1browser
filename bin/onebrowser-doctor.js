#!/usr/bin/env node
'use strict';

const {runDoctor} = require('../src/doctor');

function usage() {
  return [
    'Usage: node ./bin/onebrowser-doctor.js [options]',
    '',
    'Options:',
    '  --application-id <id>  Application-specific configuration namespace',
    '  --check-auth           Launch 1Browser and check the online auth state',
    '  --help                 Show this help',
  ].join('\n');
}

function parseArguments(argv) {
  const result = {checkAuth: false};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      result.help = true;
    } else if (argument === '--check-auth') {
      result.checkAuth = true;
    } else if (argument === '--application-id') {
      index += 1;
      if (!argv[index]) {
        throw new Error('--application-id requires a value.');
      }
      result.applicationId = argv[index];
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  return result;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const result = await runDoctor(options);
  console.log(`1Browser doctor: ${result.applicationId}`);
  for (const check of result.checks) {
    console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}`);
  }
  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {main, parseArguments, usage};
