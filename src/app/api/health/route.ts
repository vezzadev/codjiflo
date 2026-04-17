export function GET() {
  return Response.json({
    status: "ok",
    commit: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "unknown",
    timestamp: new Date().toISOString(),
  });
}
