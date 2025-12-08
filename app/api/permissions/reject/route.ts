import { query } from "@/lib/db"
import { type NextRequest, NextResponse } from "next/server"
import { broadcastEvent } from "@/lib/websocket-broadcast"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { requestId, adminId, rejectionReason } = body

    if (!requestId || !adminId || !rejectionReason) {
      return NextResponse.json({ error: "Faltan parámetros requeridos", success: false }, { status: 400 })
    }

    const requests = await query(`SELECT * FROM rental_permission_requests WHERE id = ?`, [requestId])
    const request = Array.isArray(requests) && requests.length > 0 ? requests[0] : null

    // Update permission request status
    await query(
      `UPDATE rental_permission_requests 
       SET status = 'rechazado', reviewed_by = ?, review_date = NOW(), rejection_reason = ?
       WHERE id = ?`,
      [adminId, rejectionReason, requestId],
    )

    if (request) {
      const propertyResult = await query(`SELECT title, location FROM inmueble WHERE id = ?`, [
        (request as any).inmueble_id,
      ])
      const property = Array.isArray(propertyResult) && propertyResult.length > 0 ? propertyResult[0] : null

      broadcastEvent("permission_rejected", {
        requestId,
        propertyId: (request as any).inmueble_id,
        propertyTitle: property?.title || "Unknown",
        propertyLocation: property?.location || "Unknown",
        asesorId: (request as any).asesor_id,
        requestType: (request as any).request_type,
        rejectionReason,
        timestamp: Date.now(),
      })
    }

    return NextResponse.json({
      success: true,
      message: "Permiso rechazado exitosamente",
    })
  } catch (error) {
    console.error("[v0] Error rejecting permission:", error)
    return NextResponse.json({ error: "Error al rechazar permiso", success: false }, { status: 500 })
  }
}
