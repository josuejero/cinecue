import { getServerEnv } from "./env";

const DEFAULT_MEDIA_CLOUD_BASE_URL = "https://developer.tmsimg.com";
let cachedBaseUrl: string | null = null;

function getMediaCloudBaseUrl() {
  if (cachedBaseUrl) {
    return cachedBaseUrl;
  }

  const env = getServerEnv();
  const raw = env.GRACENOTE_MEDIA_CLOUD_BASE_URL?.trim() ?? DEFAULT_MEDIA_CLOUD_BASE_URL;
  cachedBaseUrl = raw.replace(/\/+$/, "");
  return cachedBaseUrl;
}

export function resolvePosterUrl(posterUrl?: string | null): string | null {
  if (!posterUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(posterUrl)) {
    return posterUrl;
  }

  const base = getMediaCloudBaseUrl();
  const cleaned = posterUrl.replace(/^\/+/, "");
  return `${base}/${cleaned}`;
}
