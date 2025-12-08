import { query } from "@/lib/db"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { propertyId, userId, userRole } = body

    console.log("[v0] Enable property request:", { propertyId, userId, userRole })

    if (!propertyId || !userId) {
      return NextResponse.json({ error: "Faltan parámetros requeridos", success: false }, { status: 400 })
    }

    // Admins and Gerencia can enable directly
    if (userRole === "admin" || userRole === "gerencia") {
      await query(`UPDATE inmueble SET status = 'disponible' WHERE id = ?`, [propertyId])

      return NextResponse.json({
        success: true,
        message: "Inmueble habilitado exitosamente",
      })
    }

    // Asesores need to request permission (handled elsewhere)
    return NextResponse.json({
      success: false,
      error: "Los asesores deben solicitar permiso para habilitar inmuebles",
    })
  } catch (error) {
    console.error("[v0] Error enabling property:", error)
    return NextResponse.json({ error: "Error al habilitar inmueble", success: false }, { status: 500 })
  }
}
