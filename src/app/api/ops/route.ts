import { NextResponse } from "next/server";
import { getPhase4OperationalSnapshot } from "@/lib/phase4/operations";

export async function GET() {
  try {
    const snapshot = await getPhase4OperationalSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        phase: 4,
        error: error instanceof Error ? error.message : "Unknown ops error.",
      },
      { status: 500 },
    );
  }
}
