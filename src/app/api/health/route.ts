import { NextResponse } from "next/server";
import { getPhase6OperationalSnapshot } from "@/lib/phase6/ops";

export async function GET() {
  try {
    const operations = await getPhase6OperationalSnapshot();

    return NextResponse.json({
      ok: true,
      service: "cinecue-web",
      phase: 6,
      timestamp: new Date().toISOString(),
      operations,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: "cinecue-web",
        phase: 6,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown health error.",
      },
      { status: 503 },
    );
  }
}
