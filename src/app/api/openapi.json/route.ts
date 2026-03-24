import { getOpenApiDocument } from "@/server/openapi/track-legend.openapi";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(getOpenApiDocument());
}
