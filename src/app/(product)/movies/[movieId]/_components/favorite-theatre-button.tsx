"use client";

import { useState } from "react";
import { ActionButton, HeartIcon } from "@/shared/ui/ui";
import { readJson } from "@/shared/utils/http-client";

export function FavoriteTheatreButton(props: {
  locationId: string;
  theatreId: string;
  initialFavorite: boolean;
  className?: string;
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
    <ActionButton
      className={props.className}
      disabled={busy}
      icon={<HeartIcon filled={favorite} />}
      onClick={() => void toggleFavorite()}
      size="sm"
      variant={favorite ? "primary" : "secondary"}
    >
      {busy ? "Updating..." : favorite ? "Saved theatre" : "Save theatre"}
    </ActionButton>
  );
}
