import { NextResponse } from "next/server";
import { getOperationalSnapshot } from "@/modules/ops/server";

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const operations = await getOperationalSnapshot();

    return NextResponse.json({
      ok: true,
      service: "cinecue-web",
      timestamp,
      checks: {
        operations: true,
      },
      operations,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: "cinecue-web",
        timestamp,
        checks: {
          operations: false,
        },
        operations: null,
        error: error instanceof Error ? error.message : "Unknown health error.",
      },
      { status: 503 },
    );
  }
}
