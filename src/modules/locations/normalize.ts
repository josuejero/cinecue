export function normalizePostalCode(value?: string | null) {
  if (!value) {
    return null;
  }

  return value.replace(/\s+/g, "").toUpperCase();
}
