import { NextResponse } from "next/server"
import { getRecentEvents } from "@/lib/websocket-broadcast"

// Endpoint for clients to poll for events
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const since = Number(searchParams.get("since") || "0")

  const events = getRecentEvents(since)

  return NextResponse.json({
    success: true,
    events,
    timestamp: Date.now(),
  })
}
