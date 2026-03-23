import crypto from "node:crypto";
import { TooManyRequestsError } from "@/shared/http/errors";
import { getRedis } from "@/shared/infra/redis";

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return null;
}

export async function assertRateLimit(input: {
  request: Request;
  scope: string;
  subject?: string | null;
  limit: number;
  windowSeconds: number;
}) {
  const actor = input.subject?.trim() || getClientIp(input.request) || "unknown";
  const currentSecond = Math.floor(Date.now() / 1000);
  const windowStart = currentSecond - (currentSecond % input.windowSeconds);
  const key = `rate:${input.scope}:${sha256(actor)}:${windowStart}`;
  const redis = getRedis();

  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, input.windowSeconds + 5);
  }

  if (count > input.limit) {
    const retryAfterSeconds = Math.max(
      1,
      windowStart + input.windowSeconds - currentSecond,
    );

    throw new TooManyRequestsError(
      "Too many requests. Please try again shortly.",
      retryAfterSeconds,
    );
  }

  return {
    key,
    count,
    remaining: Math.max(0, input.limit - count),
  };
}
