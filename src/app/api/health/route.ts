import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "cinecue-web",
    phase: 2,
    timestamp: new Date().toISOString(),
  });
}
