import type { ErrorCode } from "@/lib/models";
import { ZodError } from "zod";

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function toErrorResponse(error: unknown): {
  status: number;
  body: { ok: false; code: ErrorCode; message: string };
} {
  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        ok: false,
        code: "BAD_REQUEST",
        message: error.issues[0]?.message ?? "Invalid request body.",
      },
    };
  }

  if (error instanceof SyntaxError) {
    return {
      status: 400,
      body: {
        ok: false,
        code: "BAD_REQUEST",
        message: "Request body must be valid JSON.",
      },
    };
  }

  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: {
        ok: false,
        code: error.code,
        message: error.message,
      },
    };
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  return {
    status: 500,
    body: {
      ok: false,
      code: "EXTRACT_FAILED",
      message,
    },
  };
}
