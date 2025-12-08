import { query } from "@/lib/db"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { requestId, adminId, adminNotes } = body

    console.log("[v0] Approving permission:", { requestId, adminId })

    if (!requestId || !adminId) {
      return NextResponse.json({ error: "Faltan parámetros requeridos", success: false }, { status: 400 })
    }

    // Get the request details
    const requests = await query(`SELECT * FROM rental_permission_requests WHERE id = ?`, [requestId])

    if (!Array.isArray(requests) || requests.length === 0) {
      console.log("[v0] Permission request not found:", requestId)
      return NextResponse.json({ error: "Permiso no encontrado", success: false }, { status: 404 })
    }

    const request = requests[0] as any
    console.log("[v0] Found permission request:", request)

    // Update permission request status
    await query(
      `UPDATE rental_permission_requests 
       SET status = 'aprobado', reviewed_by = ?, review_date = NOW(), admin_notes = ?
       WHERE id = ?`,
      [adminId, adminNotes || null, requestId],
    )

    console.log("[v0] Updated permission status to aprobado")

    // Update inmueble status based on request type
    if (request.request_type === "disponible_request") {
      await query(`UPDATE inmueble SET status = 'disponible' WHERE id = ?`, [request.inmueble_id])
      console.log("[v0] Set property to disponible")
    } else if (request.request_type === "property_approval" || request.request_type === "nuevo_inmueble") {
      await query(`UPDATE inmueble SET status = 'disponible' WHERE id = ?`, [request.inmueble_id])
      console.log("[v0] Set property to disponible (new property)")
    } else if (request.request_type === "disable_request") {
      await query(`UPDATE inmueble SET status = 'deshabilitado' WHERE id = ?`, [request.inmueble_id])
      console.log("[v0] Set property to deshabilitado")
    } else if (request.request_type === "enable_request") {
      await query(`UPDATE inmueble SET status = 'disponible' WHERE id = ?`, [request.inmueble_id])
      console.log("[v0] Set property to disponible (enabled)")
    }

    return NextResponse.json({
      success: true,
      message: "Permiso aprobado exitosamente",
    })
  } catch (error) {
    console.error("[v0] Error approving permission:", error)
    if (error instanceof Error) {
      console.error("[v0] Error details:", error.message, error.stack)
    }
    return NextResponse.json(
      {
        error: "Error al aprobar permiso",
        details: error instanceof Error ? error.message : "Unknown error",
        success: false,
      },
      { status: 500 },
    )
  }
}
