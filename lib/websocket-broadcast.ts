// Helper functions to broadcast WebSocket events from API routes
// Since we can't directly access the WebSocket server in serverless functions,
// we'll use a simple broadcast mechanism

export type WebSocketEventType =
  | "property-created"
  | "property-updated"
  | "property-deleted"
  | "property-status-changed"
  | "permission-requested"
  | "permission-approved"
  | "permission-rejected"
  | "alert-created"
  | "alert-resolved"
  | "user-created"
  | "user-updated"
  | "user-deleted"

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

  // In a real implementation, this would send to Redis/Pusher/etc
  // For now, we'll use a polling mechanism on the client
}

export const getRecentEvents = (since = 0): BroadcastEvent[] => {
  return eventQueue.filter((event) => event.timestamp > since)
}
