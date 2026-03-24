import { handleUploadRequest } from "@/server/http/uploads";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleUploadRequest(request);
}
