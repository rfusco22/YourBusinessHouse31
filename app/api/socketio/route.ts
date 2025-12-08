import type { NextRequest } from "next/server"

// This is a placeholder route to initialize WebSocket
// The actual WebSocket server is initialized in the custom server
export async function GET(req: NextRequest) {
  return new Response("WebSocket endpoint active", { status: 200 })
}
