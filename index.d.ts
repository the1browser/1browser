import type {Page, Target} from 'puppeteer-core';

export interface Credentials {
  email?: string;
  password?: string;
}

export interface LaunchOptions {
  executablePath: string;
  userDataDir: string;
  credentials?: Credentials;
  headless?: false;
  launchArgs?: string[];
  auth?: {
    validateOnline?: boolean;
    timeoutMs?: number;
    pollIntervalMs?: number;
  };
}

export interface AuthState {
  signedIn: boolean;
  state?: 'signed_in' | 'signed_out' | 'expired' | 'unknown' | string;
  email?: string;
  userId?: string;
  reason?: string;
}

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
export class ProfileTaskError extends OneBrowserError {}
export class ClientClosedError extends OneBrowserError {}

export class OneBrowser {
  static launch(options: LaunchOptions): Promise<OneBrowser>;

  getAuthState(options?: {validateOnline?: boolean}): Promise<AuthState>;
  ensureAuthenticated(options?: {
    email?: string;
    password?: string;
    timeoutMs?: number;
    pollIntervalMs?: number;
  }): Promise<AuthState>;
  logout(): Promise<void>;

  getProfiles(): Promise<ProfileInfo[]>;
  getPersistentProfiles(options?: {
    includeOmitted?: boolean;
  }): Promise<ProfileInfo[]>;
  createProfile(name: string): Promise<ProfileInfo>;
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
