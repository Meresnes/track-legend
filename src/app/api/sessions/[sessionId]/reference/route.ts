import { handleReferenceLapRequest } from "@/server/http/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReferenceLapRouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: Request, context: ReferenceLapRouteContext) {
  const { sessionId } = await context.params;
  return handleReferenceLapRequest(request, sessionId);
}
