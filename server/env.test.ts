import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertNoTestSettingsOnHostedPlatform, flags, onHostedPlatform } from './env.js';

const PLATFORM = ['VERCEL', 'VERCEL_ENV', 'REPL_ID', 'REPLIT_DEPLOYMENT'];
const TEST_SETTINGS = ['NEXA_TEST_MODE', 'EMAIL_MOCK', 'AI_MOCK', 'RATE_LIMIT_MULTIPLIER'];

beforeEach(() => {
  for (const name of [...PLATFORM, ...TEST_SETTINGS]) vi.stubEnv(name, '');
  vi.stubEnv('NODE_ENV', 'test');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('test mode', () => {
  it('is off unless NEXA_TEST_MODE=1, even when the mocks are set', () => {
    vi.stubEnv('EMAIL_MOCK', '1');
    vi.stubEnv('AI_MOCK', '1');
    expect(flags.testMode).toBe(false);
    expect(flags.emailMock).toBe(false);
    expect(flags.aiMock).toBe(false);
  });

  it('turns on the mocks locally with NEXA_TEST_MODE=1', () => {
    vi.stubEnv('NEXA_TEST_MODE', '1');
    vi.stubEnv('EMAIL_MOCK', '1');
    vi.stubEnv('AI_MOCK', '1');
    expect(flags.emailMock).toBe(true);
    expect(flags.aiMock).toBe(true);
  });

  it.each([
    ['VERCEL', '1'],
    ['VERCEL_ENV', 'preview'],
    ['REPL_ID', 'abc'],
    ['REPLIT_DEPLOYMENT', '1'],
    ['NODE_ENV', 'production'],
  ])('never runs when %s=%s', (name, value) => {
    vi.stubEnv('NEXA_TEST_MODE', '1');
    vi.stubEnv('EMAIL_MOCK', '1');
    vi.stubEnv(name, value);
    expect(onHostedPlatform()).toBe(true);
    expect(flags.testMode).toBe(false);
    expect(flags.emailMock).toBe(false);
  });
});

describe('deployment check', () => {
  it('passes locally with test settings', () => {
    vi.stubEnv('NEXA_TEST_MODE', '1');
    vi.stubEnv('EMAIL_MOCK', '1');
    expect(() => assertNoTestSettingsOnHostedPlatform()).not.toThrow();
  });

  it('refuses a deployment that carries test settings', () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('EMAIL_MOCK', '1');
    vi.stubEnv('RATE_LIMIT_MULTIPLIER', '100');
    expect(() => assertNoTestSettingsOnHostedPlatform()).toThrow(/EMAIL_MOCK, RATE_LIMIT_MULTIPLIER/);
  });

  it('accepts switched off values copied from .env.example', () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('AI_MOCK', '0');
    vi.stubEnv('RATE_LIMIT_MULTIPLIER', '1');
    expect(() => assertNoTestSettingsOnHostedPlatform()).not.toThrow();
  });
});
