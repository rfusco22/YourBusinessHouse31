"use client"

import type React from "react"

import { ThemeProvider } from "next-themes"
import { GoogleMapsLoader } from "@/components/google-maps-loader"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <GoogleMapsLoader>{children}</GoogleMapsLoader>
    </ThemeProvider>
  )
}
