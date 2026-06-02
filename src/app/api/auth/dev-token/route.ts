import { NextResponse } from 'next/server';

/**
 * GET /api/auth/dev-token
 *
 * Local-dev only. Returns the GitHub CLI's OAuth token (`gh auth token`) so a
 * manual `npm run dev` session can sign in without the OAuth client secret. The
 * secret-bound code-exchange path (`/api/auth/token`) is therefore exercised
 * only in PR previews / production, never locally.
 *
 * Hard-gated to `NODE_ENV === 'development'`: any production/preview build —
 * and therefore every E2E run, which uses a production build — returns 404 and
 * never reaches the `child_process` code, so a deployed Worker can never shell
 * out or leak a token.
 */
export async function GET(): Promise<Response> {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const run = promisify(execFile);

    const { stdout } = await run('gh', ['auth', 'token']);
    const token = stdout.trim();

    if (!token) {
      return NextResponse.json(
        { error: 'GitHub CLI returned an empty token. Run `gh auth login`.' },
        { status: 401 },
      );
    }

    return NextResponse.json({ token });
  } catch {
    return NextResponse.json(
      { error: 'GitHub CLI unavailable or not logged in. Run `gh auth login`.' },
      { status: 401 },
    );
  }
}
