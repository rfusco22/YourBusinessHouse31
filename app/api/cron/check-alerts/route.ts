import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { sendWhatsAppAlert } from "@/lib/twilio"

async function getUsersToNotifyByRole(ownerId: number, ownerRole: string): Promise<any[]> {
  let roleCondition = ""

  // Role hierarchy:
  // - asesor property: notify asesor + admin + gerencia
  // - admin property: notify admin + gerencia
  // - gerencia property: notify only gerencia

  if (ownerRole === "asesor") {
    roleCondition = `(id = ? OR role = 'admin' OR role = 'gerencia')`
  } else if (ownerRole === "admin") {
    roleCondition = `(id = ? OR role = 'gerencia')`
  } else if (ownerRole === "gerencia") {
    roleCondition = `(id = ?)`
  } else {
    // Default: notify owner + admin + gerencia
    roleCondition = `(id = ? OR role = 'admin' OR role = 'gerencia')`
  }

  const users = await query(
    `SELECT id, name, role, whatsapp, phone 
     FROM users 
     WHERE ${roleCondition} AND is_active = TRUE AND (whatsapp IS NOT NULL OR phone IS NOT NULL)`,
    [ownerId],
  )

  return users as any[]
}

export async function GET(request: Request) {
  try {
    console.log("[v0] Cron job: Iniciando verificación automática de alertas")

    // Verificar que es una petición autorizada (de Vercel Cron o con token)
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log("[v0] Cron job: Acceso no autorizado")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const outdatedPropertiesQuery = `
      SELECT 
        i.id,
        i.title,
        i.owner_id as user_id,
        i.updated_at,
        IFNULL(i.operation_type, 'compra') as operation_type,
        DATEDIFF(CURDATE(), i.updated_at) as days_inactive,
        u.name as asesor_name,
        u.whatsapp as asesor_phone,
        u.role as owner_role
      FROM inmueble i
      LEFT JOIN users u ON i.owner_id = u.id
      WHERE i.status = 'disponible'
        AND (
          (IFNULL(i.operation_type, 'compra') IN ('alquiler', 'ambos') AND DATEDIFF(CURDATE(), i.updated_at) > 30)
          OR
          (IFNULL(i.operation_type, 'compra') = 'compra' AND DATEDIFF(CURDATE(), i.updated_at) > 60)
        )
      ORDER BY i.updated_at ASC
    `

    const outdatedProperties = (await query(outdatedPropertiesQuery)) as any[]

    console.log(`[v0] Encontradas ${outdatedProperties.length} propiedades desactualizadas`)

    let notificationsSent = 0
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://yourbusinesshouse-production.up.railway.app"

    for (const property of outdatedProperties) {
      const months = Math.floor(property.days_inactive / 30)
      const isRental = property.operation_type === "alquiler" || property.operation_type === "ambos"
      const propertyUrl = `${baseUrl}/propiedades/${property.id}`
      const ownerRole = property.owner_role || "asesor"

      const usersToNotify = await getUsersToNotifyByRole(property.user_id, ownerRole)

      console.log(`[v0] Propiedad "${property.title}" - Dueño: ${property.asesor_name} (${ownerRole})`)
      console.log(`[v0] Usuarios a notificar: ${usersToNotify.length}`)

      for (const user of usersToNotify) {
        const phoneNumber = user.whatsapp || user.phone
        if (!phoneNumber) continue

        let message = ""

        if (user.id === property.user_id) {
          // Message for the property owner
          if (isRental) {
            message = `🔔 *ALERTA - Your Business House*\n\n📍 Tu propiedad "${property.title}" lleva *${months} mes${months !== 1 ? "es" : ""}* sin alquilarse.\n\nConsidera revisar el precio o mejorar la publicación.\n\n🔗 Ver propiedad: ${propertyUrl}`
          } else {
            message = `🔔 *ALERTA - Your Business House*\n\n📍 Tu propiedad "${property.title}" lleva *${months} mes${months !== 1 ? "es" : ""}* sin venderse.\n\nConsidera revisar el precio o la estrategia de venta.\n\n🔗 Ver propiedad: ${propertyUrl}`
          }
        } else {
          // Message for admins/gerencia
          const alertType = isRental ? "sin alquilarse" : "sin venderse"
          message = `🔔 *ALERTA DEL SISTEMA - Your Business House*\n\n👤 Responsable: ${property.asesor_name} (${ownerRole})\n📍 Propiedad: "${property.title}"\n⏱️ Tiempo inactivo: *${months} mes${months !== 1 ? "es" : ""}* ${alertType}\n\n🔗 Ver propiedad: ${propertyUrl}`
        }

        const sent = await sendWhatsAppAlert(phoneNumber, message)
        if (sent) {
          notificationsSent++
          console.log(`[v0] WhatsApp enviado a ${user.name} (${user.role}): ${phoneNumber}`)
        } else {
          console.log(`[v0] Error enviando WhatsApp a ${user.name} (${user.role})`)
        }
      }
    }

    console.log(
      `[v0] Cron job completado: ${notificationsSent} notificaciones enviadas para ${outdatedProperties.length} propiedades`,
    )

    return NextResponse.json({
      success: true,
      propertiesChecked: outdatedProperties.length,
      notificationsSent,
    })
  } catch (error) {
    console.error("[v0] Error en cron job de alertas:", error)
    return NextResponse.json(
      {
        error: "Error al procesar alertas automáticas",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
