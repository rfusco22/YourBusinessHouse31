import { query } from "@/lib/db"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { propertyId, userId, userRole, reason, action } = body

    console.log("[v0] Disable/Enable request:", { propertyId, userId, userRole, reason, action })

    if (!propertyId || !userId || !reason || !action) {
      return NextResponse.json({ error: "Faltan parámetros requeridos", success: false }, { status: 400 })
    }

    if (action !== "disable" && action !== "enable") {
      return NextResponse.json({ error: "Acción inválida", success: false }, { status: 400 })
    }

    // Admin and Gerencia can disable/enable directly without permission
    if (userRole === "admin" || userRole === "gerencia") {
      const newStatus = action === "disable" ? "deshabilitado" : "disponible"
      await query(`UPDATE inmueble SET status = ? WHERE id = ?`, [newStatus, propertyId])

      return NextResponse.json({
        success: true,
        message: `Inmueble ${action === "disable" ? "deshabilitado" : "habilitado"} exitosamente`,
        direct: true,
      })
    }

    // Asesores must request permission
    const requestType = action === "disable" ? "disable_request" : "enable_request"

    // Check if there's already a pending request for this property
    const existingRequest = await query(
      `SELECT id FROM rental_permission_requests 
       WHERE inmueble_id = ? AND request_type = ? AND status = 'pendiente'`,
      [propertyId, requestType],
    )

    if (existingRequest && existingRequest.length > 0) {
      return NextResponse.json(
        {
          error: "Ya existe una solicitud pendiente para este inmueble",
          success: false,
        },
        { status: 400 },
      )
    }

    // Create permission request
    await query(
      `INSERT INTO rental_permission_requests 
       (inmueble_id, asesor_id, request_type, justification, status, created_at)
       VALUES (?, ?, ?, ?, 'pendiente', NOW())`,
      [propertyId, userId, requestType, reason],
    )

    return NextResponse.json({
      success: true,
      message: "Solicitud de permiso enviada exitosamente. Espera la aprobación del administrador.",
      requiresApproval: true,
    })
  } catch (error) {
    console.error("[v0] Error processing disable/enable request:", error)
    return NextResponse.json({ error: "Error al procesar la solicitud", success: false }, { status: 500 })
  }
}
