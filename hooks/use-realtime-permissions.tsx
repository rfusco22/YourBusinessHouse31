"use client"

import { useEffect } from "react"
import { useToast } from "@/hooks/use-toast"

export function useRealtimePermissions(onUpdate: () => void) {
  const { toast } = useToast()

  useEffect(() => {
    const eventSource = new EventSource("/api/events")

    eventSource.addEventListener("permission_created", (event) => {
      const data = JSON.parse(event.data)
      console.log("[v0] Permission created event:", data)
      toast({
        title: "Nueva solicitud de permiso",
        description: `${data.asesorName} ha solicitado un permiso`,
        variant: "default",
      })
      onUpdate()
    })

    eventSource.addEventListener("permission_approved", (event) => {
      const data = JSON.parse(event.data)
      console.log("[v0] Permission approved event:", data)
      onUpdate()
    })

    eventSource.addEventListener("permission_rejected", (event) => {
      const data = JSON.parse(event.data)
      console.log("[v0] Permission rejected event:", data)
      onUpdate()
    })

    eventSource.onerror = (error) => {
      console.error("[v0] EventSource error:", error)
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [onUpdate, toast])
}
