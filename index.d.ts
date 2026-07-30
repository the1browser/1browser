import type {Page, Target} from 'puppeteer-core';

export interface Credentials {
  email?: string;
  password?: string;
}

export type AuthenticationMode =
  | 'auto'
  | 'credentials-only'
  | 'interactive-only'
  | 'error';

export interface AuthenticationOptions {
  mode?: AuthenticationMode;
  timeoutMs?: number;
  interactiveTimeoutMs?: number;
  pollIntervalMs?: number;
}

export interface EnsureAuthenticatedOptions extends AuthenticationOptions {
  email?: string;
  password?: string;
  onInteractiveLogin?: (target: BrowserWindowTarget) => void;
}

export interface LaunchOptions {
  executablePath: string;
  userDataDir: string;
  credentials?: Credentials;
  auth?: AuthenticationOptions;
  headless?: false;
  launchArgs?: string[];
}

export interface ConfigurationResolutionOptions {
  applicationId: string;
  options?: Partial<LaunchOptions>;
  env?: Record<string, string | undefined>;
  cwd?: string;
  configPath?: string;
  secretsPath?: string;
  platform?: string;
  homeDir?: string;
}

export interface BrowserDiscoveryOptions {
  executablePath?: string;
  env?: Record<string, string | undefined>;
  platform?: string;
  homeDir?: string;
  cwd?: string;
  knownPaths?: string[];
}

export interface AuthState {
  signedIn: boolean;
  state?: 'signed_in' | 'signed_out' | 'expired' | 'unknown' | string;
  email?: string;
  userId?: string;
  reason?: string;
}

export interface AuthResponse {
  success: boolean;
  responseCode: number;
  body?: string;
}

export interface BrowserWindowTarget {
  windowId: number;
  targetId: string;
}

export interface FingerprintSetting {
  value?: unknown;
  options?: Array<{name: string; value: unknown}>;
  [key: string]: unknown;
}

export type FingerprintSettings = Record<string, FingerprintSetting>;
export type ProxySettings = Record<string, unknown>;

export interface ProfileInfo {
  id: string;
  name?: string;
  localName?: string;
  path?: string;
  omitted?: boolean;
  signinRequired?: boolean;
  ephemeral?: boolean;
  [key: string]: unknown;
}

export type EnsureProfilesMode =
  | 'ensure-count'
  | 'create-new'
  | 'use-existing';

export interface EnsureProfilesResult {
  profiles: ProfileInfo[];
  reused: ProfileInfo[];
  created: ProfileInfo[];
}

export interface OpenProfilePageResult {
  profileId: string;
  windowId?: number;
  targetId: string;
  target: Target;
  page: Page;
}

export interface ProfileDeletionResult {
  profileId: string;
  success: boolean;
  error?: {name: string; message: string};
}

export interface ProfileTaskResult<T> {
  profileId: string;
  profileName?: string;
  success: boolean;
  value?: T;
  error?: {name: string; message: string};
}

export class OneBrowserError extends Error {
  code: string;
  cause?: unknown;
}
export class ConfigurationError extends OneBrowserError {}
export class BrowserLaunchError extends OneBrowserError {}
export class AuthenticationError extends OneBrowserError {}
export class AuthenticationTimeoutError extends AuthenticationError {}
export class ProfileError extends OneBrowserError {}
export class ProfileLimitError extends ProfileError {}
export class ProfileTargetError extends ProfileError {}
export class ProfileDeletionError extends ProfileError {}
export class ProfileTaskError extends OneBrowserError {}
export class FingerprintError extends OneBrowserError {}
export class ProxyError extends OneBrowserError {}
export class ClientClosedError extends OneBrowserError {}

export class OneBrowser {
  static launch(options: LaunchOptions): Promise<OneBrowser>;

  getAuthState(options?: {validateOnline?: boolean}): Promise<AuthState>;
  ensureAuthenticated(
    options?: EnsureAuthenticatedOptions,
  ): Promise<AuthState>;
  signup(options: {
    email: string;
    password: string;
  }): Promise<AuthResponse>;
  login(): Promise<BrowserWindowTarget>;
  verify(): Promise<AuthResponse>;
  logout(): Promise<void>;

  getProfiles(): Promise<ProfileInfo[]>;
  getPersistentProfiles(options?: {
    includeOmitted?: boolean;
  }): Promise<ProfileInfo[]>;
  getAvailableProfileCreationCount(options?: {
    waitForPolicy?: boolean;
    timeoutMs?: number;
    pollIntervalMs?: number;
  }): Promise<number>;
  getFingerprintSetting(options: {
    profileId?: string;
    name: string;
  }): Promise<FingerprintSetting>;
  getFingerprintSettings(options?: {
    profileId?: string;
  }): Promise<FingerprintSettings>;
  setFingerprintSetting(options: {
    profileId?: string;
    name: string;
    value: unknown;
  }): Promise<FingerprintSetting>;
  generateFingerprint(options?: {
    profileId?: string;
  }): Promise<boolean>;
  getProxySettings(options?: {
    profileId?: string;
  }): Promise<ProxySettings>;
  setProxySettings(options: {
    profileId?: string;
    type: string;
    settings: ProxySettings;
  }): Promise<ProxySettings>;
  setProxyType(options: {
    profileId?: string;
    type: string;
  }): Promise<ProxySettings>;
  checkProxyConnection(options?: {
    profileId?: string;
  }): Promise<boolean>;
  requestNewProxy(options?: {
    profileId?: string;
  }): Promise<boolean>;
  createProfile(name: string): Promise<ProfileInfo>;
  deleteProfile(profileId: string): Promise<ProfileDeletionResult>;
  deleteProfiles(profileIds: string[]): Promise<ProfileDeletionResult[]>;
  ensureProfiles(options: {
    count: number;
    namePrefix: string;
    mode?: EnsureProfilesMode;
  }): Promise<EnsureProfilesResult>;
  openProfilePage(
    profileId: string,
    options?: {timeoutMs?: number},
  ): Promise<OpenProfilePageResult>;
  runForProfiles<T>(options: {
    profiles: ProfileInfo[];
    concurrency?: number;
    openingConcurrency?: number;
    openTimeoutMs?: number;
    stopOnError?: boolean;
    task: (context: {
      profile: ProfileInfo;
      page: Page;
      client: OneBrowser;
    }) => Promise<T>;
  }): Promise<Array<ProfileTaskResult<T>>>;
  send<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<T>;
  close(): Promise<void>;
}

export function loadEnvironmentConfig(
  env?: Record<string, string | undefined>,
): LaunchOptions;
export function resolveConfiguration(
  options: ConfigurationResolutionOptions,
): Promise<LaunchOptions>;
export function sanitizeApplicationId(applicationId: string): string;
export function getDefaultUserDataDir(options: {
  applicationId: string;
  env?: Record<string, string | undefined>;
  platform?: string;
  homeDir?: string;
}): string;
export function findInstalledBrowser(
  options?: BrowserDiscoveryOptions,
): string;
