import { NextResponse } from "next/server";
import { getPhase4OperationalSnapshot } from "@/lib/phase4/operations";

export async function GET() {
  try {
    const operations = await getPhase4OperationalSnapshot();

    return NextResponse.json({
      ok: true,
      service: "cinecue-web",
      phase: 4,
      timestamp: new Date().toISOString(),
      operations,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: "cinecue-web",
        phase: 4,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown health error.",
      },
      { status: 503 },
    );
  }
}
