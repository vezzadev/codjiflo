// Diagnostic route for PR #495 Vercel deployment investigation.
// Purely isolated: imports nothing, just returns a static JSON.
// If THIS returns 500, the issue is global Vercel runtime, not specific routes.
export function GET() {
  return Response.json({
    pong: true,
    timestamp: new Date().toISOString(),
  });
}
