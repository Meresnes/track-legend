import { handleUploadStatusRequest } from "@/server/http/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadStatusRouteContext = {
  params: Promise<{ uploadId: string }>;
};

export async function GET(_request: Request, context: UploadStatusRouteContext) {
  const { uploadId } = await context.params;
  return handleUploadStatusRequest(uploadId);
}
