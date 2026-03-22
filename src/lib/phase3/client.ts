export async function readJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(data?.error ?? `Request failed with ${response.status}.`);
  }

  return data as T;
}
