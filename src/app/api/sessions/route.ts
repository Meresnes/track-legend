import { handleSessionsListRequest } from "@/server/http/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleSessionsListRequest();
}
