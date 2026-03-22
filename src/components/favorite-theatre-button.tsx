"use client";

import { useState } from "react";
import { readJson } from "@/lib/phase3/client";

export function FavoriteTheatreButton(props: {
  locationId: string;
  theatreId: string;
  initialFavorite: boolean;
}) {
  const [favorite, setFavorite] = useState(props.initialFavorite);
  const [busy, setBusy] = useState(false);

  async function toggleFavorite() {
    try {
      setBusy(true);

      await readJson<{ ok: boolean; favoriteTheatreIds: string[] }>(
        `/api/locations/${props.locationId}/favorite-theatres`,
        {
          method: favorite ? "DELETE" : "POST",
          body: JSON.stringify({ theatreId: props.theatreId }),
        },
      );

      setFavorite((current) => !current);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className="inline-flex h-10 items-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-900 transition hover:border-slate-900 disabled:opacity-50"
      disabled={busy}
      onClick={() => void toggleFavorite()}
      type="button"
    >
      {favorite ? "★ Favorite theatre" : "☆ Favorite theatre"}
    </button>
  );
}
