export function runtimeIsoToMinutes(value?: string | null) {
  if (!value) {
    return null;
  }

  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/i.exec(value);
  if (!match) {
    return null;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  return hours * 60 + minutes;
}

export function businessDateFromIso(localDateTime: string) {
  return localDateTime.slice(0, 10);
}
