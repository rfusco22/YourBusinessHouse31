import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { sendWhatsAppMessage, getTwilioStatus } from "@/lib/twilio"

export async function POST(request: Request) {
  try {
    const { alertId, propertyId, userId } = await request.json()

    console.log("[v0] Manual WhatsApp notification requested")
    console.log("[v0] Alert ID:", alertId)
    console.log("[v0] Property ID:", propertyId)
    console.log("[v0] User ID:", userId)

    // Check Twilio status first
    const twilioStatus = getTwilioStatus()
    console.log("[v0] Twilio status:", twilioStatus)

    if (!twilioStatus.configured) {
      return NextResponse.json({
        success: false,
        error:
          "Twilio no está configurado. Contacta al administrador para configurar TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN.",
        twilioStatus,
      })
    }

    // Get property info
    const propertyResult = await query(
      `SELECT 
        i.id, i.title, i.owner_id, i.operation_type, i.updated_at,
        DATEDIFF(CURDATE(), i.updated_at) as days_inactive,
        u.name as owner_name, u.whatsapp as owner_whatsapp, u.phone as owner_phone, u.role as owner_role
       FROM inmueble i
       LEFT JOIN users u ON i.owner_id = u.id
       WHERE i.id = ?`,
      [propertyId],
    )

    if (!Array.isArray(propertyResult) || propertyResult.length === 0) {
      return NextResponse.json({ success: false, error: "Propiedad no encontrada" })
    }

    const property = propertyResult[0] as any
    const ownerRole = property.owner_role || "asesor"
    const months = Math.floor(property.days_inactive / 30)
    const isRental = property.operation_type === "alquiler" || property.operation_type === "ambos"
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://yourbusinesshouse-production.up.railway.app"
    const propertyUrl = `${baseUrl}/propiedades/${property.id}`

    // Get users to notify based on role hierarchy
    let roleCondition = ""
    if (ownerRole === "asesor") {
      roleCondition = `(id = ? OR role = 'admin' OR role = 'gerencia')`
    } else if (ownerRole === "admin") {
      roleCondition = `(id = ? OR role = 'gerencia')`
    } else {
      roleCondition = `(id = ?)`
    }

    const usersToNotify = await query(
      `SELECT id, name, role, whatsapp, phone 
       FROM users 
       WHERE ${roleCondition} AND is_active = TRUE AND (whatsapp IS NOT NULL OR phone IS NOT NULL)`,
      [property.owner_id],
    )

    console.log("[v0] Users to notify:", usersToNotify)

    const results = []

    for (const user of usersToNotify as any[]) {
      const phoneNumber = user.whatsapp || user.phone
      if (!phoneNumber) {
        results.push({ user: user.name, success: false, error: "No phone number" })
        continue
      }

      let message = ""
      if (user.id === property.owner_id) {
        if (isRental) {
          message = `🔔 *ALERTA - Your Business House*\n\n📍 Tu propiedad "${property.title}" lleva *${months} mes${months !== 1 ? "es" : ""}* sin alquilarse.\n\nConsidera revisar el precio o mejorar la publicación.\n\n🔗 Ver propiedad: ${propertyUrl}`
        } else {
          message = `🔔 *ALERTA - Your Business House*\n\n📍 Tu propiedad "${property.title}" lleva *${months} mes${months !== 1 ? "es" : ""}* sin venderse.\n\nConsidera revisar el precio o la estrategia de venta.\n\n🔗 Ver propiedad: ${propertyUrl}`
        }
      } else {
        const alertType = isRental ? "sin alquilarse" : "sin venderse"
        message = `🔔 *ALERTA DEL SISTEMA - Your Business House*\n\n👤 Responsable: ${property.owner_name} (${ownerRole})\n📍 Propiedad: "${property.title}"\n⏱️ Tiempo inactivo: *${months} mes${months !== 1 ? "es" : ""}* ${alertType}\n\n🔗 Ver propiedad: ${propertyUrl}`
      }

      console.log(`[v0] Sending to ${user.name} (${user.role}) at ${phoneNumber}`)
      const result = await sendWhatsAppMessage(phoneNumber, message)

      results.push({
        user: user.name,
        role: user.role,
        phone: phoneNumber,
        success: result.success,
        error: result.error,
        messageSid: result.messageSid,
      })
    }

    const successCount = results.filter((r) => r.success).length
    console.log(`[v0] WhatsApp notifications complete: ${successCount}/${results.length} sent`)

    return NextResponse.json({
      success: successCount > 0,
      totalSent: successCount,
      totalFailed: results.length - successCount,
      results,
      twilioStatus,
    })
  } catch (error) {
    console.error("[v0] Error sending WhatsApp notification:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    )
  }
}

// GET endpoint to check Twilio status
export async function GET() {
  const status = getTwilioStatus()
  return NextResponse.json(status)
}
