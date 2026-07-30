'use strict';

const os = require('node:os');
const path = require('node:path');

const WINDOWS_RESERVED_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

function platformPath(platform) {
  return platform === 'win32' ? path.win32 : path.posix;
}

function getPlatformDataRoot({
  platform = process.platform,
  env = process.env,
  homeDir = os.homedir(),
} = {}) {
  const paths = platformPath(platform);
  if (platform === 'darwin') {
    return paths.join(
      homeDir,
      'Library',
      'Application Support',
      '1Browser',
      'Automation',
    );
  }
  if (platform === 'win32') {
    const localAppData =
      env.LOCALAPPDATA?.trim() ||
      paths.join(homeDir, 'AppData', 'Local');
    return paths.join(localAppData, '1Browser', 'Automation');
  }
  if (platform === 'linux') {
    const dataHome =
      env.XDG_DATA_HOME?.trim() ||
      paths.join(homeDir, '.local', 'share');
    return paths.join(dataHome, '1browser', 'automation');
  }
  throw new Error(`Unsupported platform for 1Browser configuration: ${platform}.`);
}

function getKnownBrowserInstallPaths({
  platform = process.platform,
  env = process.env,
  homeDir = os.homedir(),
} = {}) {
  const paths = platformPath(platform);
  if (platform === 'darwin') {
    return [
      '/Applications/1Browser.app/Contents/MacOS/1Browser',
      paths.join(
        homeDir,
        'Applications',
        '1Browser.app',
        'Contents',
        'MacOS',
        '1Browser',
      ),
    ];
  }
  if (platform === 'win32') {
    const localAppData =
      env.LOCALAPPDATA?.trim() ||
      paths.join(homeDir, 'AppData', 'Local');
    const programFiles =
      env.ProgramFiles?.trim() ||
      env.PROGRAMFILES?.trim() ||
      'C:\\Program Files';
    const programFilesX86 =
      env['ProgramFiles(x86)']?.trim() ||
      env.PROGRAMFILES_X86?.trim() ||
      'C:\\Program Files (x86)';
    return [
      paths.join(
        localAppData,
        'Programs',
        '1Browser',
        '1Browser.exe',
      ),
      paths.join(localAppData, '1Browser', '1Browser.exe'),
      paths.join(programFiles, '1Browser', '1Browser.exe'),
      paths.join(programFilesX86, '1Browser', '1Browser.exe'),
    ];
  }
  if (platform === 'linux') {
    return [
      '/opt/1browser/1browser',
      '/usr/local/bin/1browser',
      '/usr/bin/1browser',
      paths.join(homeDir, '.local', 'bin', '1browser'),
      '/snap/bin/1browser',
    ];
  }
  throw new Error(`Unsupported platform for 1Browser discovery: ${platform}.`);
}

module.exports = {
  WINDOWS_RESERVED_NAMES,
  getKnownBrowserInstallPaths,
  getPlatformDataRoot,
  platformPath,
};
