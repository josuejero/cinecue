function extractErrorCode(error: unknown): string | undefined {
  const visited = new Set<unknown>();

  function traverse(err: unknown): string | undefined {
    if (!err || typeof err !== "object") {
      return undefined;
    }

    if (visited.has(err)) {
      return undefined;
    }

    visited.add(err);

    if ("code" in err) {
      const maybeCode = (err as { code?: unknown }).code;
      if (typeof maybeCode === "string") {
        return maybeCode;
      }
    }

    const cause = (err as { cause?: unknown }).cause;
    if (cause) {
      const code = traverse(cause);
      if (code) {
        return code;
      }
    }

    const originalError = (err as { originalError?: unknown }).originalError;
    if (originalError) {
      const code = traverse(originalError);
      if (code) {
        return code;
      }
    }

    return undefined;
  }

  return traverse(error);
}

export function getPostgresErrorCode(error: unknown): string | undefined {
  return extractErrorCode(error);
}

export function hasPostgresErrorCode(error: unknown, code: string): boolean {
  return extractErrorCode(error) === code;
}
