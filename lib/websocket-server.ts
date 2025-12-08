// WebSocket Server Manager for real-time updates
import type { Server as HTTPServer } from "http"
import { Server as SocketIOServer } from "socket.io"

let io: SocketIOServer | null = null

export const initWebSocketServer = (server: HTTPServer) => {
  if (io) return io

  io = new SocketIOServer(server, {
    path: "/api/socketio",
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  })

  io.on("connection", (socket) => {
    console.log("[v0] WebSocket client connected:", socket.id)

    // Join user-specific room for targeted updates
    socket.on("join-user", (userId: string) => {
      socket.join(`user-${userId}`)
      console.log("[v0] User joined room:", `user-${userId}`)
    })

    // Join role-specific room
    socket.on("join-role", (role: string) => {
      socket.join(`role-${role}`)
      console.log("[v0] User joined role room:", `role-${role}`)
    })

    socket.on("disconnect", () => {
      console.log("[v0] WebSocket client disconnected:", socket.id)
    })
  })

  return io
}

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized")
  }
  return io
}

// Event types for type safety
export type WebSocketEvent =
  | { type: "property-created"; data: any }
  | { type: "property-updated"; data: any }
  | { type: "property-deleted"; data: any }
  | { type: "property-status-changed"; data: any }
  | { type: "permission-requested"; data: any }
  | { type: "permission-approved"; data: any }
  | { type: "permission-rejected"; data: any }
  | { type: "alert-created"; data: any }
  | { type: "alert-resolved"; data: any }
  | { type: "user-created"; data: any }
  | { type: "user-updated"; data: any }
  | { type: "user-deleted"; data: any }

// Broadcast to all connected clients
export const broadcastEvent = (event: WebSocketEvent) => {
  const socketIO = getIO()
  socketIO.emit(event.type, event.data)
  console.log("[v0] Broadcasted event:", event.type)
}

// Broadcast to specific user
export const broadcastToUser = (userId: string, event: WebSocketEvent) => {
  const socketIO = getIO()
  socketIO.to(`user-${userId}`).emit(event.type, event.data)
  console.log("[v0] Broadcasted to user:", userId, event.type)
}

// Broadcast to specific role
export const broadcastToRole = (role: string, event: WebSocketEvent) => {
  const socketIO = getIO()
  socketIO.to(`role-${role}`).emit(event.type, event.data)
  console.log("[v0] Broadcasted to role:", role, event.type)
}
