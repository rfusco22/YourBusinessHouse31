"use client"

import { useEffect } from "react"
import { useToast } from "@/hooks/use-toast"

export function useRealtimeProperties(onUpdate: () => void) {
  const { toast } = useToast()

  useEffect(() => {
    const eventSource = new EventSource("/api/events")

    eventSource.addEventListener("property_created", (event) => {
      const data = JSON.parse(event.data)
      console.log("[v0] Property created event:", data)
      toast({
        title: "Nuevo inmueble creado",
        description: `Se ha creado el inmueble: ${data.title}`,
        variant: "default",
      })
      onUpdate()
    })

    eventSource.addEventListener("property_updated", (event) => {
      const data = JSON.parse(event.data)
      console.log("[v0] Property updated event:", data)
      onUpdate()
    })

    eventSource.addEventListener("property_status_changed", (event) => {
      const data = JSON.parse(event.data)
      console.log("[v0] Property status changed event:", data)
      toast({
        title: "Estado de inmueble actualizado",
        description: `${data.title} ahora está ${data.newStatus}`,
        variant: "default",
      })
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
