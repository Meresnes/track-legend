export type ApiErrorInput = {
  status: number;
  message: string;
  code?: string;
  details?: unknown;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor({ status, message, code, details }: ApiErrorInput) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type ApiErrorHandler = (error: ApiError) => void;

let apiErrorHandler: ApiErrorHandler | null = null;

export function setApiErrorHandler(handler: ApiErrorHandler | null) {
  apiErrorHandler = handler;
}

export function notifyApiError(error: ApiError) {
  apiErrorHandler?.(error);
}
