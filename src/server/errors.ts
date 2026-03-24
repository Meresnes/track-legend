type ErrorResponseBody = {
  code: string;
  message: string;
};

export class ServerError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ServerError";
    this.status = status;
    this.code = code;
  }
}

export function isServerError(error: unknown): error is ServerError {
  return error instanceof ServerError;
}

function buildErrorBody(error: unknown): ErrorResponseBody {
  if (isServerError(error)) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  return {
    code: "INTERNAL_SERVER_ERROR",
    message: "Unexpected server error.",
  };
}

export function toErrorResponse(error: unknown): Response {
  const body = buildErrorBody(error);
  const status = isServerError(error) ? error.status : 500;

  return Response.json(body, { status });
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Unknown error";
}
