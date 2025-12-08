"use client"

import { useEffect, useRef } from "react"
import { useWebSocketContext } from "@/contexts/websocket-context"

interface RealtimeUpdateOptions {
  onPropertyCreated?: (data: any) => void
  onPropertyUpdated?: (data: any) => void
  onPropertyStatusChanged?: (data: any) => void
  onPermissionRequested?: (data: any) => void
  onPermissionApproved?: (data: any) => void
  onPermissionRejected?: (data: any) => void
  onAlertCreated?: (data: any) => void
  onAlertResolved?: (data: any) => void
  onUserCreated?: (data: any) => void
  onUserUpdated?: (data: any) => void
}

export const useRealtimeUpdates = (options: RealtimeUpdateOptions) => {
  const { on, off, isConnected } = useWebSocketContext()
  const optionsRef = useRef(options)

  // Update ref when options change
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  useEffect(() => {
    if (!isConnected) return

    // Property events
    const handlePropertyCreated = (data: any) => {
      console.log("[v0] Real-time: Property created", data)
      optionsRef.current.onPropertyCreated?.(data)
    }

    const handlePropertyUpdated = (data: any) => {
      console.log("[v0] Real-time: Property updated", data)
      optionsRef.current.onPropertyUpdated?.(data)
    }

    const handlePropertyStatusChanged = (data: any) => {
      console.log("[v0] Real-time: Property status changed", data)
      optionsRef.current.onPropertyStatusChanged?.(data)
    }

    // Permission events
    const handlePermissionRequested = (data: any) => {
      console.log("[v0] Real-time: Permission requested", data)
      optionsRef.current.onPermissionRequested?.(data)
    }

    const handlePermissionApproved = (data: any) => {
      console.log("[v0] Real-time: Permission approved", data)
      optionsRef.current.onPermissionApproved?.(data)
    }

    const handlePermissionRejected = (data: any) => {
      console.log("[v0] Real-time: Permission rejected", data)
      optionsRef.current.onPermissionRejected?.(data)
    }

    // Alert events
    const handleAlertCreated = (data: any) => {
      console.log("[v0] Real-time: Alert created", data)
      optionsRef.current.onAlertCreated?.(data)
    }

    const handleAlertResolved = (data: any) => {
      console.log("[v0] Real-time: Alert resolved", data)
      optionsRef.current.onAlertResolved?.(data)
    }

    // User events
    const handleUserCreated = (data: any) => {
      console.log("[v0] Real-time: User created", data)
      optionsRef.current.onUserCreated?.(data)
    }

    const handleUserUpdated = (data: any) => {
      console.log("[v0] Real-time: User updated", data)
      optionsRef.current.onUserUpdated?.(data)
    }

    // Register event listeners
    on("property-created", handlePropertyCreated)
    on("property-updated", handlePropertyUpdated)
    on("property-status-changed", handlePropertyStatusChanged)
    on("permission-requested", handlePermissionRequested)
    on("permission-approved", handlePermissionApproved)
    on("permission-rejected", handlePermissionRejected)
    on("alert-created", handleAlertCreated)
    on("alert-resolved", handleAlertResolved)
    on("user-created", handleUserCreated)
    on("user-updated", handleUserUpdated)

    // Cleanup
    return () => {
      off("property-created", handlePropertyCreated)
      off("property-updated", handlePropertyUpdated)
      off("property-status-changed", handlePropertyStatusChanged)
      off("permission-requested", handlePermissionRequested)
      off("permission-approved", handlePermissionApproved)
      off("permission-rejected", handlePermissionRejected)
      off("alert-created", handleAlertCreated)
      off("alert-resolved", handleAlertResolved)
      off("user-created", handleUserCreated)
      off("user-updated", handleUserUpdated)
    }
  }, [isConnected, on, off])

  return { isConnected }
}
