"use client"

import { useEffect, useState, useCallback } from "react"

interface UseLiveDataOptions {
  endpoint: string
  interval?: number // milliseconds, default 5000ms (5 seconds)
  onError?: (error: Error) => void
  shouldFetch?: boolean
}

interface UseLiveDataReturn<T> {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook para obtener datos en vivo con polling automático
 * Actualiza los datos automáticamente sin recargar la página
 */
export function useLiveData<T>(options: UseLiveDataOptions): UseLiveDataReturn<T> {
  const { endpoint, interval = 5000, onError, shouldFetch = true } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    if (!shouldFetch) return

    try {
      setError(null)
      const response = await fetch(endpoint)
      if (!response.ok) throw new Error(`Error: ${response.statusText}`)

      const result = await response.json()
      setData(result)
      setLoading(false)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      onError?.(error)
      setLoading(false)
    }
  }, [endpoint, shouldFetch, onError])

  // Fetch inicial
  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!shouldFetch) return

    // Connect to SSE endpoint for real-time updates
    const eventSource = new EventSource("/api/events")

    eventSource.addEventListener("property-created", () => {
      console.log("[v0] SSE: Property created, refetching...")
      fetchData()
    })

    eventSource.addEventListener("property-updated", () => {
      console.log("[v0] SSE: Property updated, refetching...")
      fetchData()
    })

    eventSource.addEventListener("property-status-changed", () => {
      console.log("[v0] SSE: Property status changed, refetching...")
      fetchData()
    })

    eventSource.addEventListener("permission-requested", () => {
      console.log("[v0] SSE: Permission requested, refetching...")
      fetchData()
    })

    eventSource.addEventListener("permission-approved", () => {
      console.log("[v0] SSE: Permission approved, refetching...")
      fetchData()
    })

    eventSource.addEventListener("permission-rejected", () => {
      console.log("[v0] SSE: Permission rejected, refetching...")
      fetchData()
    })

    eventSource.addEventListener("user-created", () => {
      console.log("[v0] SSE: User created, refetching...")
      fetchData()
    })

    eventSource.addEventListener("user-updated", () => {
      console.log("[v0] SSE: User updated, refetching...")
      fetchData()
    })

    eventSource.addEventListener("alert-created", () => {
      console.log("[v0] SSE: Alert created, refetching...")
      fetchData()
    })

    eventSource.onerror = (err) => {
      console.error("[v0] SSE connection error:", err)
      eventSource.close()
    }

    return () => {
      console.log("[v0] Closing SSE connection")
      eventSource.close()
    }
  }, [shouldFetch, fetchData])

  // Polling automático (como respaldo)
  useEffect(() => {
    if (!shouldFetch) return

    const timer = setInterval(fetchData, interval)
    return () => clearInterval(timer)
  }, [fetchData, interval, shouldFetch])

  return { data, loading, error, refetch: fetchData }
}
