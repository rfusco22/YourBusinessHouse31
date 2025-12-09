import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { sendWhatsAppMessage } from "@/lib/twilio"

const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP_NUMBER || "+584244291541"

async function getUsersToNotifyByRole(asesorId: number | null, asesorRole: string): Promise<any[]> {
  // Role hierarchy:
  // - asesor alert: notify asesor + admin + gerencia
  // - admin alert: notify admin + gerencia
  // - gerencia alert: notify only gerencia

  if (asesorRole === "asesor" && asesorId) {
    // Notify the asesor themselves, all admins, and all gerencia
    const users = await query(
      `SELECT id, name, role, whatsapp, phone 
       FROM users 
       WHERE (id = ? OR role = 'admin' OR role = 'gerencia') AND is_active = TRUE`,
      [asesorId],
    )
    return users as any[]
  } else if (asesorRole === "admin" && asesorId) {
    // Notify only the admin themselves and all gerencia
    const users = await query(
      `SELECT id, name, role, whatsapp, phone 
       FROM users 
       WHERE (id = ? OR role = 'gerencia') AND is_active = TRUE`,
      [asesorId],
    )
    return users as any[]
  } else if (asesorRole === "gerencia") {
    // Notify only gerencia users
    const users = await query(
      `SELECT id, name, role, whatsapp, phone 
       FROM users 
       WHERE role = 'gerencia' AND is_active = TRUE`,
    )
    return users as any[]
  } else {
    // Default: notify admin and gerencia
    const users = await query(
      `SELECT id, name, role, whatsapp, phone 
       FROM users 
       WHERE role IN ('admin', 'gerencia') AND is_active = TRUE`,
    )
    return users as any[]
  }
}

export async function GET(request: Request) {
  // Verificar clave secreta para proteger el endpoint (Cron Job)
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get("secret")

  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    const rentAlerts = (await query(
      `SELECT 
        i.id,
        i.title,
        i.location,
        i.price,
        i.created_at,
        i.last_rental_date,
        i.owner_id as asesor_id,
        u.name as agent_name,
        u.role as agent_role,
        u.whatsapp as agent_whatsapp
      FROM inmueble i
      LEFT JOIN users u ON i.owner_id = u.id
      WHERE i.operation_type IN ('alquiler', 'ambos')
        AND i.status = 'disponible'
        AND (i.last_rental_date IS NULL OR i.last_rental_date < ?)
        AND i.created_at < ?
        AND NOT EXISTS (
          SELECT 1 FROM alert_notifications an 
          WHERE an.property_id = i.id 
          AND an.alert_type = 'alquiler_sin_movimiento'
          AND an.notified_at > ?
        )`,
      [oneMonthAgo, oneMonthAgo, oneMonthAgo],
    )) as any[]

    const saleAlerts = (await query(
      `SELECT 
        i.id,
        i.title,
        i.location,
        i.price,
        i.created_at,
        i.last_sale_date,
        i.owner_id as asesor_id,
        u.name as agent_name,
        u.role as agent_role,
        u.whatsapp as agent_whatsapp
      FROM inmueble i
      LEFT JOIN users u ON i.owner_id = u.id
      WHERE i.operation_type IN ('compra', 'ambos')
        AND i.status = 'disponible'
        AND (i.last_sale_date IS NULL OR i.last_sale_date < ?)
        AND i.created_at < ?
        AND NOT EXISTS (
          SELECT 1 FROM alert_notifications an 
          WHERE an.property_id = i.id 
          AND an.alert_type = 'venta_sin_movimiento'
          AND an.notified_at > ?
        )`,
      [twoMonthsAgo, twoMonthsAgo, twoMonthsAgo],
    )) as any[]

    const notifications: Array<{
      propertyId: number
      type: string
      agentRole: string
      notifiedUsers: Array<{ name: string; role: string; success: boolean }>
    }> = []

    // --- 3. PROCESAR ALERTAS DE ALQUILER ---
    for (const property of rentAlerts) {
      const daysSinceCreated = Math.floor(
        (now.getTime() - new Date(property.created_at).getTime()) / (1000 * 60 * 60 * 24),
      )

      const agentRole = property.agent_role || "asesor"

      const usersToNotify = await getUsersToNotifyByRole(property.asesor_id, agentRole)

      console.log(`[v0] Rent alert from ${agentRole} - notifying ${usersToNotify.length} users`)

      const notifiedUsers: Array<{ name: string; role: string; success: boolean }> = []

      for (const user of usersToNotify) {
        const phoneNumber = user.whatsapp || user.phone

        if (!phoneNumber) {
          console.log(`[v0] User ${user.name} (${user.role}) has no phone, skipping`)
          continue
        }

        const message = `*ALERTA DE INMUEBLE - Your Business House*

*${property.title}*
Ubicacion: ${property.location || "No especificada"}
Precio: $${Number(property.price).toLocaleString()}
Tipo: Alquiler
Dias sin alquilar: ${daysSinceCreated} dias
Responsable: ${property.agent_name || "No asignado"} (${agentRole})

Este inmueble lleva mas de 30 dias sin alquilarse. Se requiere atencion.

_Notificacion enviada a: ${user.role}_`

        const result = await sendWhatsAppMessage(phoneNumber, message)

        notifiedUsers.push({
          name: user.name,
          role: user.role,
          success: result.success,
        })

        console.log(`[v0] WhatsApp to ${user.name} (${user.role}): ${result.success ? "sent" : "failed"}`)
      }

      // Registrar notificación en la base de datos
      await query(
        `INSERT INTO alert_notifications (property_id, alert_type, whatsapp_sent, message_sid, notified_at)
         VALUES (?, 'alquiler_sin_movimiento', ?, ?, NOW())
         ON DUPLICATE KEY UPDATE 
            notified_at = NOW(),
            whatsapp_sent = VALUES(whatsapp_sent),
            message_sid = VALUES(message_sid)`,
        [property.id, notifiedUsers.some((u) => u.success), null],
      )

      notifications.push({
        propertyId: property.id,
        type: "alquiler_sin_movimiento",
        agentRole: agentRole,
        notifiedUsers: notifiedUsers,
      })
    }

    // --- 4. PROCESAR ALERTAS DE VENTA ---
    for (const property of saleAlerts) {
      const daysSinceCreated = Math.floor(
        (now.getTime() - new Date(property.created_at).getTime()) / (1000 * 60 * 60 * 24),
      )

      const agentRole = property.agent_role || "asesor"

      const usersToNotify = await getUsersToNotifyByRole(property.asesor_id, agentRole)

      console.log(`[v0] Sale alert from ${agentRole} - notifying ${usersToNotify.length} users`)

      const notifiedUsers: Array<{ name: string; role: string; success: boolean }> = []

      for (const user of usersToNotify) {
        const phoneNumber = user.whatsapp || user.phone

        if (!phoneNumber) {
          console.log(`[v0] User ${user.name} (${user.role}) has no phone, skipping`)
          continue
        }

        const message = `*ALERTA DE INMUEBLE - Your Business House*

*${property.title}*
Ubicacion: ${property.location || "No especificada"}
Precio: $${Number(property.price).toLocaleString()}
Tipo: Venta
Dias sin vender: ${daysSinceCreated} dias
Responsable: ${property.agent_name || "No asignado"} (${agentRole})

Este inmueble lleva mas de 60 dias sin venderse. Se requiere atencion.

_Notificacion enviada a: ${user.role}_`

        const result = await sendWhatsAppMessage(phoneNumber, message)

        notifiedUsers.push({
          name: user.name,
          role: user.role,
          success: result.success,
        })

        console.log(`[v0] WhatsApp to ${user.name} (${user.role}): ${result.success ? "sent" : "failed"}`)
      }

      // Registrar notificación en la base de datos
      await query(
        `INSERT INTO alert_notifications (property_id, alert_type, whatsapp_sent, message_sid, notified_at)
         VALUES (?, 'venta_sin_movimiento', ?, ?, NOW())
         ON DUPLICATE KEY UPDATE 
            notified_at = NOW(),
            whatsapp_sent = VALUES(whatsapp_sent),
            message_sid = VALUES(message_sid)`,
        [property.id, notifiedUsers.some((u) => u.success), null],
      )

      notifications.push({
        propertyId: property.id,
        type: "venta_sin_movimiento",
        agentRole: agentRole,
        notifiedUsers: notifiedUsers,
      })
    }

    return NextResponse.json({
      success: true,
      totalAlerts: rentAlerts.length + saleAlerts.length,
      rentAlerts: rentAlerts.length,
      saleAlerts: saleAlerts.length,
      notifications,
      roleHierarchy: {
        asesor: "notifies: asesor + admin + gerencia",
        admin: "notifies: admin + gerencia",
        gerencia: "notifies: gerencia only",
      },
    })
  } catch (error) {
    console.error("[v0] Error checking alerts:", error)
    return NextResponse.json(
      { error: "Error checking alerts", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
