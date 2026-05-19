export function GET() {
  // Temporary diagnostic logging for PR #495 / Vercel deploy investigation.
  console.log('[api/health] GET invoked', {
    commit: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? 'unknown',
    nodeVersion: process.version,
    vercelEnv: process.env.VERCEL_ENV ?? 'unknown',
    vercelRegion: process.env.VERCEL_REGION ?? 'unknown',
  });
  return Response.json({
    status: "ok",
    commit: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "unknown",
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    vercelEnv: process.env.VERCEL_ENV ?? "unknown",
  });
}
