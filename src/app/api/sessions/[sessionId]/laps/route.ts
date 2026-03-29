import { handleSessionLapsRequest } from "@/server/http/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionLapsRouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: SessionLapsRouteContext) {
  const { sessionId } = await context.params;
  return handleSessionLapsRequest(sessionId);
}
