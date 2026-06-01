export function GET() {
  return Response.json({
    status: "ok",
    commit: process.env.NEXT_PUBLIC_APP_COMMIT_SHA ?? "unknown",
    timestamp: new Date().toISOString(),
  });
}
