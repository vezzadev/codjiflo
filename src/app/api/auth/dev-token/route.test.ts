import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';

// Mock NextResponse.json to a predictable { data, status } shape (matches utils.test.ts)
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data: unknown, init?: ResponseInit) => ({
      data,
      status: init?.status ?? 200,
    })),
  },
}));

// Mock the GitHub CLI invocation. execFile is callback-style so node:util's real
// promisify wraps it; each test drives the callback.
const execFileMock = vi.fn();
vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => (execFileMock as (...a: unknown[]) => void)(...args),
}));

interface ResultShape {
  data: unknown;
  status: number;
}

describe('GET /api/auth/dev-token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 404 outside development (cannot leak from a deployed Worker)', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const res = (await GET()) as unknown as ResultShape;

    expect(res.status).toBe(404);
    // Must never have shelled out
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('returns the GitHub CLI token in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], cb: (e: Error | null, r: { stdout: string }) => void) =>
        cb(null, { stdout: 'gho_devtoken123\n' }),
    );

    const res = (await GET()) as unknown as ResultShape;

    expect(execFileMock).toHaveBeenCalledWith('gh', ['auth', 'token'], expect.any(Function));
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ token: 'gho_devtoken123' });
  });

  it('returns 401 when the GitHub CLI is unavailable / not logged in', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], cb: (e: Error | null) => void) =>
        cb(new Error('gh: command not found')),
    );

    const res = (await GET()) as unknown as ResultShape;

    expect(res.status).toBe(401);
  });

  it('returns 401 when the GitHub CLI returns an empty token', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], cb: (e: Error | null, r: { stdout: string }) => void) =>
        cb(null, { stdout: '  \n' }),
    );

    const res = (await GET()) as unknown as ResultShape;

    expect(res.status).toBe(401);
  });
});
