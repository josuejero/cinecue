import { NextResponse } from "next/server";
import { getPhase6OperationalSnapshot } from "@/lib/phase6/ops";

export async function GET() {
  try {
    const snapshot = await getPhase6OperationalSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        phase: 6,
        error: error instanceof Error ? error.message : "Unknown phase 6 ops error.",
      },
      { status: 500 },
    );
  }
}
