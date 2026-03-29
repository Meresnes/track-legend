import { describe, expect, it } from "vitest";
import { GET as getOpenApiResponse } from "@/app/api/openapi.json/route";
import { scalarConfiguration } from "@/app/docs/api/page";
import { getOpenApiDocument } from "@/server/openapi/track-legend.openapi";

describe("OpenAPI document", () => {
  it("returns a valid OpenAPI 3.1 document", async () => {
    const response = await getOpenApiResponse();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.openapi).toBe("3.1.0");
  });

  it("documents the required backend paths", () => {
    const document = getOpenApiDocument();

    expect(document.paths).toHaveProperty("/api/health");
    expect(document.paths).toHaveProperty("/api/uploads");
    expect(document.paths).toHaveProperty("/api/uploads/{uploadId}");
  });

  it("includes required response codes and component schemas", () => {
    const document = getOpenApiDocument();
    const uploadPath = document.paths["/api/uploads"];
    const healthPath = document.paths["/api/health"];

    expect(uploadPath?.post?.responses).toHaveProperty("201");
    expect(uploadPath?.post?.responses).toHaveProperty("400");
    expect(uploadPath?.post?.responses).toHaveProperty("413");
    expect(uploadPath?.post?.responses).toHaveProperty("503");
    expect(document.paths["/api/uploads/{uploadId}"]?.get?.responses).toHaveProperty("200");
    expect(document.paths["/api/uploads/{uploadId}"]?.get?.responses).toHaveProperty("404");
    expect(healthPath?.get?.responses).toHaveProperty("200");
    expect(healthPath?.get?.responses).toHaveProperty("503");
    expect(document.components?.schemas).toHaveProperty("ErrorResponse");
    expect(document.components?.schemas).toHaveProperty("HealthResponse");
    expect(document.components?.schemas).toHaveProperty("UploadStage");
    expect(document.components?.schemas).toHaveProperty("UploadQueuedResponse");
    expect(document.components?.schemas).toHaveProperty("UploadStatusResponse");
  });

  it("configures Scalar to use the local OpenAPI route", () => {
    expect(scalarConfiguration.url).toBe("/api/openapi.json");
    expect(scalarConfiguration.theme).toBe("saturn");
  });
});
