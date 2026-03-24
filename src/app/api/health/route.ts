import { handleHealthRequest } from "@/server/http/health";

export const runtime = "nodejs";

export async function GET() {
  return handleHealthRequest();
}
