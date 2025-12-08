// Helper functions to broadcast WebSocket events from API routes
// Since we can't directly access the WebSocket server in serverless functions,
// we'll use a simple broadcast mechanism

export type WebSocketEventType =
  | "property_created"
  | "property_updated"
  | "property_deleted"
  | "property_status_changed"
  | "permission_created"
  | "permission_approved"
  | "permission_rejected"
  | "alert_created"
  | "alert_resolved"
  | "user_created"
  | "user_updated"
  | "user_deleted"

interface BroadcastEvent {
  type: WebSocketEventType
  data: any
  timestamp: number
}

// In-memory event queue for serverless environments
const eventQueue: BroadcastEvent[] = []

export const broadcastEvent = (type: WebSocketEventType, data: any) => {
  const event: BroadcastEvent = {
    type,
    data,
    timestamp: Date.now(),
  }

  console.log("[v0] Broadcasting event:", type, data)

  // Add to queue
  eventQueue.push(event)

  // Keep only last 100 events
  if (eventQueue.length > 100) {
    eventQueue.shift()
  }

  // Try to import and broadcast to SSE clients
  try {
    // This is a workaround for serverless - in production you'd use Redis/Pusher
    if (typeof globalThis !== "undefined" && (globalThis as any).__broadcastToClients) {
      ;(globalThis as any).__broadcastToClients(type, data)
    }
  } catch (error) {
    // SSE not available, events will be polled instead
  }
}

export const getRecentEvents = (since = 0): BroadcastEvent[] => {
  return eventQueue.filter((event) => event.timestamp > since)
}
