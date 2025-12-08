export const dynamic = "force-dynamic"

const clients = new Set<ReadableStreamDefaultController>()

export async function GET(request: Request) {
  const stream = new ReadableStream({
    start(controller) {
      clients.add(controller)

      // Send initial connection message
      controller.enqueue(`data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`)

      // Keep-alive ping every 30 seconds
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(`: keepalive\n\n`)
        } catch (error) {
          clearInterval(keepAlive)
          clients.delete(controller)
        }
      }, 30000)

      // Cleanup on connection close
      request.signal.addEventListener("abort", () => {
        clearInterval(keepAlive)
        clients.delete(controller)
        try {
          controller.close()
        } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

// Helper to broadcast to all connected clients
export function broadcastToClients(eventType: string, data: any) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`

  clients.forEach((controller) => {
    try {
      controller.enqueue(message)
    } catch (error) {
      console.error("[v0] Error broadcasting to client:", error)
      clients.delete(controller)
    }
  })
}
