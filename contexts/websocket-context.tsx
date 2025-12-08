"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useWebSocket } from "@/hooks/use-websocket"

interface WebSocketContextType {
  isConnected: boolean
  joinUserRoom: (userId: string) => void
  joinRoleRoom: (role: string) => void
  on: (event: string, handler: (data: any) => void) => void
  off: (event: string, handler?: (data: any) => void) => void
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const websocket = useWebSocket()

  return <WebSocketContext.Provider value={websocket}>{children}</WebSocketContext.Provider>
}

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error("useWebSocketContext must be used within WebSocketProvider")
  }
  return context
}
