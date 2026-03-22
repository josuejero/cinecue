import { NextResponse } from "next/server";

export class BadRequestError extends Error {}
export class UnauthorizedError extends Error {}
export class NotFoundError extends Error {}

export class TooManyRequestsError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds = 60,
  ) {
    super(message);
    this.name = "TooManyRequestsError";
  }
}

export function jsonFromError(error: unknown) {
  if (error instanceof BadRequestError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof TooManyRequestsError) {
    return NextResponse.json(
      { error: error.message },
      {
        status: 429,
        headers: {
          "Retry-After": String(error.retryAfterSeconds),
        },
      },
    );
  }

  console.error(error);
  return NextResponse.json({ error: "Internal server error." }, { status: 500 });
}
