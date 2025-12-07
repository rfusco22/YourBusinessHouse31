"use client"

import type React from "react"

import { useEffect, useState } from "react"

declare global {
  interface Window {
    google?: any
    initGoogleMaps?: () => void
  }
}

export function GoogleMapsLoader({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Check if Google Maps is already loaded
    if (window.google?.maps) {
      setIsLoaded(true)
      return
    }

    // Fetch the script URL from the server
    fetch("/api/google-maps-config")
      .then((res) => res.json())
      .then((data) => {
        if (data.scriptUrl) {
          const script = document.createElement("script")
          script.src = data.scriptUrl
          script.async = true
          script.defer = true
          script.onload = () => setIsLoaded(true)
          document.head.appendChild(script)
        }
      })
      .catch((error) => {
        console.error("Failed to load Google Maps:", error)
      })
  }, [])

  return <>{children}</>
}
