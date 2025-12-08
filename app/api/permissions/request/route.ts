import { query } from "@/lib/db"
import { type NextRequest, NextResponse } from "next/server"
import { broadcastEvent } from "@/lib/websocket-broadcast"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { inmuebleId, asesorId, requestType, justification } = body

    if (!inmuebleId || !asesorId || !requestType || !justification) {
      return NextResponse.json({ error: "Faltan parámetros requeridos", success: false }, { status: 400 })
    }

    // Insert permission request
    await query(
      `INSERT INTO rental_permission_requests (inmueble_id, asesor_id, request_type, justification, status, created_at)
       VALUES (?, ?, ?, ?, 'pendiente', NOW())`,
      [inmuebleId, asesorId, requestType, justification],
    )

    const propertyResult = await query(`SELECT title, location FROM inmueble WHERE id = ?`, [inmuebleId])
    const asesorResult = await query(`SELECT name, email FROM users WHERE id = ?`, [asesorId])

    const property = Array.isArray(propertyResult) && propertyResult.length > 0 ? propertyResult[0] : null
    const asesor = Array.isArray(asesorResult) && asesorResult.length > 0 ? asesorResult[0] : null

    broadcastEvent("permission_created", {
      propertyId: inmuebleId,
      propertyTitle: property?.title || "Unknown",
      propertyLocation: property?.location || "Unknown",
      asesorId,
      asesorName: asesor?.name || "Unknown",
      asesorEmail: asesor?.email || "Unknown",
      requestType,
      timestamp: Date.now(),
    })

    return NextResponse.json({
      success: true,
      message: "Solicitud de permiso creada exitosamente",
    })
  } catch (error) {
    console.error("[v0] Error creating permission request:", error)
    return NextResponse.json({ error: "Error al crear solicitud de permiso", success: false }, { status: 500 })
  }
}
