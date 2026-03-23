type LogLevel = "info" | "warn" | "error";

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  return {
    message: typeof error === "string" ? error : JSON.stringify(error),
  };
}

export function writeLog(
  level: LogLevel,
  event: string,
  payload: Record<string, unknown> = {},
) {
  const record = {
    level,
    event,
    service: "cinecue",
    timestamp: new Date().toISOString(),
    ...payload,
  };

  const line = JSON.stringify(record);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function writeErrorLog(
  event: string,
  error: unknown,
  payload: Record<string, unknown> = {},
) {
  writeLog("error", event, {
    ...payload,
    error: serializeError(error),
  });
}
