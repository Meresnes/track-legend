import type { OpenAPIV3_1 } from "openapi-types";

const errorResponseSchema: OpenAPIV3_1.SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["code", "message"],
  properties: {
    code: {
      type: "string",
      example: "UPLOAD_FILE_REQUIRED",
    },
    message: {
      type: "string",
      example: "Field 'file' is required.",
    },
  },
};

const healthResponseSchema: OpenAPIV3_1.SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["status", "dependencies", "errors", "timestamp"],
  properties: {
    status: {
      type: "string",
      enum: ["ok", "degraded"],
      example: "ok",
    },
    dependencies: {
      type: "object",
      additionalProperties: false,
      required: ["database", "redis"],
      properties: {
        database: {
          type: "string",
          enum: ["up", "down"],
        },
        redis: {
          type: "string",
          enum: ["up", "down"],
        },
      },
    },
    errors: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dependency", "message"],
        properties: {
          dependency: {
            type: "string",
            example: "database",
          },
          message: {
            type: "string",
            example: "db offline",
          },
        },
      },
    },
    timestamp: {
      type: "string",
      format: "date-time",
      example: "2026-03-24T12:00:00.000Z",
    },
  },
};

const uploadQueuedSchema: OpenAPIV3_1.SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["uploadId", "status", "stage"],
  properties: {
    uploadId: {
      type: "string",
      format: "uuid",
      example: "3eb69d1e-df6e-4256-86cb-5273fbb2f642",
    },
    status: {
      type: "string",
      enum: ["queued"],
      example: "queued",
    },
    stage: {
      $ref: "#/components/schemas/UploadStage",
    },
  },
};

const uploadErrorSchema: OpenAPIV3_1.SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["code", "message"],
  properties: {
    code: {
      type: "string",
      example: "MISSING_CHANNELS",
    },
    message: {
      type: "string",
      example: "Required channels are missing.",
    },
  },
};

const uploadStatusSchema: OpenAPIV3_1.SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["uploadId", "status", "stage", "sessionId", "error"],
  properties: {
    uploadId: {
      type: "string",
      format: "uuid",
      example: "3eb69d1e-df6e-4256-86cb-5273fbb2f642",
    },
    status: {
      type: "string",
      enum: ["queued", "running", "done", "error"],
      example: "running",
    },
    stage: {
      $ref: "#/components/schemas/UploadStage",
    },
    sessionId: {
      type: ["string", "null"],
      format: "uuid",
      example: null,
    },
    error: {
      anyOf: [
        {
          $ref: "#/components/schemas/UploadError",
        },
        {
          type: "null",
        },
      ],
    },
  },
};

const uploadStageSchema: OpenAPIV3_1.SchemaObject = {
  type: "string",
  enum: [
    "queued",
    "open_duckdb",
    "discover_schema",
    "extract_raw_signals",
    "segment_laps",
    "normalize_distance",
    "resample",
    "persist_session",
    "finalize",
  ],
  example: "extract_raw_signals",
};

const sessionListItemSchema: OpenAPIV3_1.SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: [
    "sessionId",
    "createdAt",
    "sim",
    "trackCode",
    "carClass",
    "lapsCount",
    "bestLapTimeMs",
    "referenceLapId",
  ],
  properties: {
    sessionId: {
      type: "string",
      format: "uuid",
      example: "e768ac48-8ed0-4b88-a5f9-48f46dc4122d",
    },
    createdAt: {
      type: "string",
      format: "date-time",
      example: "2026-03-21T10:00:00.000Z",
    },
    sim: {
      type: "string",
      example: "LMU",
    },
    trackCode: {
      type: "string",
      example: "MONZA",
    },
    carClass: {
      type: "string",
      example: "HYPERCAR_2023",
    },
    lapsCount: {
      type: "integer",
      example: 18,
    },
    bestLapTimeMs: {
      type: ["integer", "null"],
      example: 212345,
    },
    referenceLapId: {
      type: ["string", "null"],
      format: "uuid",
      example: "dcd76c1e-b4aa-4497-9db5-e8eb4d98735a",
    },
  },
};

const sessionListResponseSchema: OpenAPIV3_1.SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        $ref: "#/components/schemas/SessionListItem",
      },
    },
  },
};

const lapListItemSchema: OpenAPIV3_1.SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["lapId", "lapNumber", "lapTimeMs", "isValid"],
  properties: {
    lapId: {
      type: "string",
      format: "uuid",
      example: "b0c5a558-6d21-47f0-965e-f7f62f5be92e",
    },
    lapNumber: {
      type: "integer",
      example: 5,
    },
    lapTimeMs: {
      type: ["integer", "null"],
      example: 212345,
    },
    isValid: {
      type: "boolean",
      example: true,
    },
  },
};

const sessionLapListResponseSchema: OpenAPIV3_1.SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["sessionId", "referenceLapId", "bestLapId", "bestLapTimeMs", "items"],
  properties: {
    sessionId: {
      type: "string",
      format: "uuid",
      example: "e768ac48-8ed0-4b88-a5f9-48f46dc4122d",
    },
    referenceLapId: {
      type: ["string", "null"],
      format: "uuid",
      example: "dcd76c1e-b4aa-4497-9db5-e8eb4d98735a",
    },
    bestLapId: {
      type: ["string", "null"],
      format: "uuid",
      example: "b0c5a558-6d21-47f0-965e-f7f62f5be92e",
    },
    bestLapTimeMs: {
      type: ["integer", "null"],
      example: 212345,
    },
    items: {
      type: "array",
      items: {
        $ref: "#/components/schemas/LapListItem",
      },
    },
  },
};

const referenceLapUpdateResponseSchema: OpenAPIV3_1.SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["sessionId", "referenceLapId"],
  properties: {
    sessionId: {
      type: "string",
      format: "uuid",
      example: "e768ac48-8ed0-4b88-a5f9-48f46dc4122d",
    },
    referenceLapId: {
      type: ["string", "null"],
      format: "uuid",
      example: "b0c5a558-6d21-47f0-965e-f7f62f5be92e",
    },
  },
};

export function getOpenApiDocument(): OpenAPIV3_1.Document {
  return {
    openapi: "3.1.0",
    info: {
      title: "Track Legend BFF API",
      version: "0.1.0",
      description:
        "Internal backend-for-frontend API for telemetry upload and platform health checks.",
    },
    servers: [
      {
        url: "/",
        description: "Current deployment origin",
      },
    ],
    tags: [
      {
        name: "Platform",
        description: "Operational and health endpoints.",
      },
      {
        name: "Uploads",
        description: "Telemetry file upload and ingest entrypoints.",
      },
      {
        name: "Sessions",
        description: "Session and lap review endpoints.",
      },
    ],
    paths: {
      "/api/health": {
        get: {
          operationId: "getHealth",
          tags: ["Platform"],
          summary: "Get backend readiness status",
          responses: {
            "200": {
              description: "All required dependencies are reachable.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/HealthResponse",
                  },
                },
              },
            },
            "503": {
              description: "One or more backend dependencies are unavailable.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/HealthResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/uploads": {
        post: {
          operationId: "createUpload",
          tags: ["Uploads"],
          summary: "Upload a .duckdb telemetry file for ingest",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file"],
                  properties: {
                    file: {
                      type: "string",
                      format: "binary",
                      description: "Raw Le Mans Ultimate telemetry export in .duckdb format.",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Upload accepted and queued for worker processing.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/UploadQueuedResponse",
                  },
                },
              },
            },
            "400": {
              description: "Invalid multipart payload, missing file, or unsupported extension.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            "413": {
              description: "Uploaded file exceeds MAX_UPLOAD_MB.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            "503": {
              description: "Upload persisted but could not be queued for processing.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/uploads/{uploadId}": {
        get: {
          operationId: "getUploadStatus",
          tags: ["Uploads"],
          summary: "Get ingest status for a previously uploaded file",
          parameters: [
            {
              name: "uploadId",
              in: "path",
              required: true,
              schema: {
                type: "string",
                format: "uuid",
              },
            },
          ],
          responses: {
            "200": {
              description: "Current upload processing status.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/UploadStatusResponse",
                  },
                },
              },
            },
            "404": {
              description: "Upload id was not found.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/sessions": {
        get: {
          operationId: "listSessions",
          tags: ["Sessions"],
          summary: "List imported telemetry sessions",
          responses: {
            "200": {
              description: "Sessions ordered by creation time.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/SessionListResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/sessions/{sessionId}/laps": {
        get: {
          operationId: "listSessionLaps",
          tags: ["Sessions"],
          summary: "List laps for a session",
          parameters: [
            {
              name: "sessionId",
              in: "path",
              required: true,
              schema: {
                type: "string",
                format: "uuid",
              },
            },
          ],
          responses: {
            "200": {
              description: "Laps for a session ordered by lap number.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/SessionLapListResponse",
                  },
                },
              },
            },
            "404": {
              description: "Session not found.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/sessions/{sessionId}/reference": {
        post: {
          operationId: "setReferenceLap",
          tags: ["Sessions"],
          summary: "Set reference lap for a session",
          parameters: [
            {
              name: "sessionId",
              in: "path",
              required: true,
              schema: {
                type: "string",
                format: "uuid",
              },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: ["lapId"],
                  properties: {
                    lapId: {
                      type: "string",
                      format: "uuid",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Reference lap updated.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ReferenceLapUpdateResponse",
                  },
                },
              },
            },
            "400": {
              description: "Validation error.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            "404": {
              description: "Session or lap not found.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        ErrorResponse: errorResponseSchema,
        HealthResponse: healthResponseSchema,
        UploadError: uploadErrorSchema,
        UploadStage: uploadStageSchema,
        UploadQueuedResponse: uploadQueuedSchema,
        UploadStatusResponse: uploadStatusSchema,
        SessionListItem: sessionListItemSchema,
        SessionListResponse: sessionListResponseSchema,
        LapListItem: lapListItemSchema,
        SessionLapListResponse: sessionLapListResponseSchema,
        ReferenceLapUpdateResponse: referenceLapUpdateResponseSchema,
      },
    },
  };
}
