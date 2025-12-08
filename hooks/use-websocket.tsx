"use client"

import { useEffect, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"

type WebSocketEventHandler = (data: any) => void

export const useWebSocket = () => {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io({
      path: "/api/socketio",
      transports: ["websocket", "polling"],
    })

    socketRef.current.on("connect", () => {
      console.log("[v0] WebSocket connected")
      setIsConnected(true)
    })

    socketRef.current.on("disconnect", () => {
      console.log("[v0] WebSocket disconnected")
      setIsConnected(false)
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

  const joinUserRoom = (userId: string) => {
    socketRef.current?.emit("join-user", userId)
  }

  const joinRoleRoom = (role: string) => {
    socketRef.current?.emit("join-role", role)
  }

  const on = (event: string, handler: WebSocketEventHandler) => {
    socketRef.current?.on(event, handler)
  }

  const off = (event: string, handler?: WebSocketEventHandler) => {
    if (handler) {
      socketRef.current?.off(event, handler)
    } else {
      socketRef.current?.off(event)
    }
  }

  return {
    socket: socketRef.current,
    isConnected,
    joinUserRoom,
    joinRoleRoom,
    on,
    off,
  }
}
