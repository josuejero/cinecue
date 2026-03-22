import { getOrCreateAppUser } from "@/lib/phase2/auth";
import { NotFoundError, jsonFromError } from "@/lib/phase2/errors";
import { resolveUserLocation } from "@/lib/phase2/locations";
import { trackProductEvent } from "@/lib/phase6/analytics";
import {
  buildCalendarFile,
  listUpcomingShowingsForMovieAndLocation,
} from "@/lib/phase6/calendar";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ movieId: string }> },
) {
  try {
    const { movieId } = await params;
    const locationId = new URL(request.url).searchParams.get("locationId");
    const user = await getOrCreateAppUser();
    const location = await resolveUserLocation(user.id, locationId);
    const showings = await listUpcomingShowingsForMovieAndLocation({
      movieId,
      locationId: location.locationId,
      limit: 25,
    });

    if (!showings.length) {
      throw new NotFoundError("No upcoming showings available for calendar export.");
    }

    await trackProductEvent({
      userId: user.id,
      locationId: location.locationId,
      movieId,
      eventName: "calendar_export",
      properties: { showingCount: showings.length },
    });

    const calendar = buildCalendarFile(showings);
    const slug = showings[0].title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return new Response(calendar, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug || movieId}.ics"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return jsonFromError(error);
  }
}
