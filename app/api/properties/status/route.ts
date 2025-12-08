import { query } from "@/lib/db"
import { NextResponse } from "next/server"
import { broadcastEvent } from "@/lib/websocket-broadcast"

// API route to update property status (vendido, alquilado, disponible)
export async function PUT(request: Request) {
  try {
    const { propertyId, status } = await request.json()

    if (!propertyId) {
      return NextResponse.json({ error: "propertyId es requerido", success: false }, { status: 400 })
    }

    if (!status || !["disponible", "vendido", "alquilado"].includes(status)) {
      return NextResponse.json(
        { error: "status debe ser 'disponible', 'vendido' o 'alquilado'", success: false },
        { status: 400 },
      )
    }

    console.log("[v0] Updating property status:", propertyId, "to:", status)

    const propertyResult = await query(`SELECT title, location FROM inmueble WHERE id = ?`, [propertyId])
    const property = Array.isArray(propertyResult) && propertyResult.length > 0 ? propertyResult[0] : null

    await query(`UPDATE inmueble SET status = ? WHERE id = ?`, [status, propertyId])

    console.log("[v0] Property status updated successfully")

    broadcastEvent("property_status_changed", {
      propertyId,
      title: property?.title || "Unknown",
      location: property?.location || "Unknown",
      newStatus: status,
      timestamp: Date.now(),
    })

    return NextResponse.json({
      success: true,
      message: `Inmueble marcado como ${status}`,
    })
  } catch (error) {
    console.error("[v0] Error updating property status:", error)
    return NextResponse.json(
      { error: "Error al actualizar el estado del inmueble", success: false, details: String(error) },
      { status: 500 },
    )
  }
}
