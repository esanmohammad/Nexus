import { Context } from "hono";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(err: Error, c: Context) {
  console.error(`[ERROR] ${err.name}: ${err.message}`, err.stack);

  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: err.errors,
        },
      },
      400
    );
  }

  if (err instanceof AppError) {
    return c.json(
      {
        error: {
          code: err.code || "ERROR",
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      },
      err.statusCode as any
    );
  }

  // Handle errors with status property (from services)
  const status = (err as any).status;
  if (status && typeof status === "number") {
    return c.json(
      {
        error: {
          code: status === 404 ? "NOT_FOUND" : status === 409 ? "CONFLICT" : status === 429 ? "QUOTA_EXCEEDED" : "ERROR",
          message: err.message,
        },
      },
      status as any
    );
  }

  // Unknown error
  const isProduction = process.env.NODE_ENV === "production";
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: isProduction
          ? "An internal error occurred"
          : err.message,
      },
    },
    500
  );
}
