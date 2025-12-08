"use client"

import type React from "react"

import { ThemeProvider } from "next-themes"
import { GoogleMapsLoader } from "@/components/google-maps-loader"
import { WebSocketProvider } from "@/contexts/websocket-context"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <GoogleMapsLoader>
        <WebSocketProvider>{children}</WebSocketProvider>
      </GoogleMapsLoader>
    </ThemeProvider>
  )
}
