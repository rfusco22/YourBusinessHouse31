import { query } from "@/lib/db"
import { NextResponse } from "next/server"
import { sendAlertEmail } from "@/lib/email"

async function getUsersToNotifyByRole(asesorId: number, asesorRole: string): Promise<any[]> {
  let users: any[] = []

  // Role hierarchy:
  // - asesor alert: notify asesor + admin + gerencia
  // - admin alert: notify admin + gerencia
  // - gerencia alert: notify only gerencia

  if (asesorRole === "asesor") {
    // Get the asesor
    const asesor = await query(`SELECT id, name, email, role FROM users WHERE id = ? AND is_active = TRUE`, [asesorId])
    // Get all admins and gerencia
    const supervisors = await query(
      `SELECT id, name, email, role FROM users WHERE (role = 'admin' OR role = 'gerencia') AND is_active = TRUE`,
    )
    users = [...(asesor as any[]), ...(supervisors as any[])]
  } else if (asesorRole === "admin") {
    // Get the admin
    const admin = await query(`SELECT id, name, email, role FROM users WHERE id = ? AND is_active = TRUE`, [asesorId])
    // Get all gerencia
    const gerencia = await query(`SELECT id, name, email, role FROM users WHERE role = 'gerencia' AND is_active = TRUE`)
    users = [...(admin as any[]), ...(gerencia as any[])]
  } else if (asesorRole === "gerencia") {
    // Only notify the gerencia user
    const gerencia = await query(`SELECT id, name, email, role FROM users WHERE id = ? AND is_active = TRUE`, [
      asesorId,
    ])
    users = gerencia as any[]
  } else {
    // Default: notify everyone with admin or gerencia role plus the owner
    const owner = await query(`SELECT id, name, email, role FROM users WHERE id = ? AND is_active = TRUE`, [asesorId])
    const supervisors = await query(
      `SELECT id, name, email, role FROM users WHERE (role = 'admin' OR role = 'gerencia') AND is_active = TRUE`,
    )
    users = [...(owner as any[]), ...(supervisors as any[])]
  }

  return users
}

export async function POST(req: Request) {
  try {
    console.log("[v0] Starting automatic alert generation and email notification...")

    // Check if property_alerts table exists
    try {
      await query("SELECT 1 FROM property_alerts LIMIT 1")
    } catch (tableError) {
      console.error("[v0] property_alerts table does not exist")
      return NextResponse.json({ success: false, error: "Alerts system not initialized" }, { status: 500 })
    }

    // 1. Get all available properties with inactivity data
    const propertiesQuery = `
      SELECT 
        i.id as property_id,
        i.title,
        i.operation_type,
        i.created_at,
        i.last_sale_date,
        i.last_rental_date,
        i.owner_id as asesor_id,
        i.price,
        i.location,
        u.name as asesor_name,
        u.role as asesor_role,
        u.email as asesor_email,
        CASE 
          WHEN i.operation_type = 'compra' AND i.last_sale_date IS NOT NULL 
            THEN DATEDIFF(NOW(), i.last_sale_date)
          WHEN i.operation_type = 'compra' AND i.last_sale_date IS NULL 
            THEN DATEDIFF(NOW(), i.created_at)
          WHEN i.operation_type = 'alquiler' AND i.last_rental_date IS NOT NULL 
            THEN DATEDIFF(NOW(), i.last_rental_date)
          WHEN i.operation_type = 'alquiler' AND i.last_rental_date IS NULL 
            THEN DATEDIFF(NOW(), i.created_at)
          ELSE DATEDIFF(NOW(), i.created_at)
        END as days_inactive
      FROM inmueble i
      LEFT JOIN users u ON i.owner_id = u.id
      WHERE i.status = 'disponible'
      ORDER BY days_inactive DESC
    `

    const properties = (await query(propertiesQuery)) as any[]
    console.log("[v0] Total properties checked:", properties.length)

    // 2. Filter properties that meet alert criteria
    const alertsToCreate = properties.filter((prop) => {
      if (prop.operation_type === "compra" && prop.days_inactive >= 60) return true
      if (prop.operation_type === "alquiler" && prop.days_inactive >= 30) return true
      if (prop.operation_type === "ambos" && prop.days_inactive >= 30) return true
      return false
    })

    console.log("[v0] Properties requiring alerts:", alertsToCreate.length)

    const results = []
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://yourbusinesshouse-production.up.railway.app"

    // 3. For each property, create or update alert and send email immediately
    for (const prop of alertsToCreate) {
      let alertType: "no_vendido_2m" | "no_alquilado_1m" = "no_vendido_2m"
      let title = ""
      let description = ""
      const monthsInactive = Math.floor(prop.days_inactive / 30)

      if (prop.operation_type === "alquiler" && prop.days_inactive >= 30) {
        alertType = "no_alquilado_1m"
        title = `Propiedad no alquilada`
        description = `"${prop.title}" no ha sido alquilada en ${monthsInactive} ${monthsInactive === 1 ? "mes" : "meses"}. Considera revisar el precio de alquiler o mejorar la publicación.`
      } else if (prop.operation_type === "compra" && prop.days_inactive >= 60) {
        alertType = "no_vendido_2m"
        title = `Propiedad no vendida`
        description = `"${prop.title}" no ha sido vendida en ${monthsInactive} ${monthsInactive === 1 ? "mes" : "meses"}. Considera revisar el precio o la estrategia de venta.`
      } else if (prop.operation_type === "ambos") {
        if (prop.days_inactive >= 60) {
          alertType = "no_vendido_2m"
          title = `Propiedad no vendida`
          description = `"${prop.title}" no ha sido vendida en ${monthsInactive} ${monthsInactive === 1 ? "mes" : "meses"}.`
        } else if (prop.days_inactive >= 30) {
          alertType = "no_alquilado_1m"
          title = `Propiedad no alquilada`
          description = `"${prop.title}" no ha sido alquilada en ${monthsInactive} ${monthsInactive === 1 ? "mes" : "meses"}.`
        }
      }

      // Check if alert already exists and is active
      const existingAlert = await query(
        `SELECT id, notified_at FROM property_alerts 
         WHERE property_id = ? AND alert_type = ? AND status = 'activa'`,
        [prop.property_id, alertType],
      )

      let alertId: number
      let isNewAlert = false

      if ((existingAlert as any[]).length > 0) {
        alertId = (existingAlert as any[])[0].id
        const alreadyNotified = (existingAlert as any[])[0].notified_at

        await query(
          `UPDATE property_alerts 
           SET days_inactive = ?, description = ?, title = ?
           WHERE id = ?`,
          [prop.days_inactive, description, title, alertId],
        )

        console.log("[v0] Updated existing alert:", alertId)

        if (alreadyNotified) {
          const lastNotified = new Date(alreadyNotified).getTime()
          const now = Date.now()
          const hoursSinceNotified = (now - lastNotified) / (1000 * 60 * 60)

          if (hoursSinceNotified < 24) {
            console.log("[v0] Alert already notified within 24h, skipping email")
            results.push({ alertId, action: "updated", notified: false, reason: "already_notified_24h" })
            continue
          }
        }
      } else {
        const insertResult = await query(
          `INSERT INTO property_alerts (property_id, asesor_id, alert_type, title, description, days_inactive, status)
           VALUES (?, ?, ?, ?, ?, ?, 'activa')`,
          [prop.property_id, prop.asesor_id, alertType, title, description, prop.days_inactive],
        )

        alertId = (insertResult as any).insertId
        isNewAlert = true
        console.log("[v0] Created new alert:", alertId)
      }

      const asesorRole = prop.asesor_role || "asesor"
      const usersToNotify = await getUsersToNotifyByRole(prop.asesor_id, asesorRole)

      console.log(`[v0] Alert from ${asesorRole} - Users to notify:`, usersToNotify.length)

      const emailResults = []
      const propertyUrl = `${baseUrl}/propiedades/${prop.property_id}`

      for (const user of usersToNotify) {
        if (!user.email) {
          console.log(`[v0] User ${user.name} (${user.role}) has no email, skipping`)
          continue
        }

        const alertData = {
          propertyTitle: prop.title,
          propertyUrl,
          alertType: alertType === "no_alquilado_1m" ? "no_alquilado" : "no_vendido",
          daysInactive: prop.days_inactive,
          monthsInactive,
          description,
          ownerName: prop.asesor_name,
          ownerRole: asesorRole,
          price: prop.price,
          location: prop.location,
          operationType: prop.operation_type,
        }

        console.log(`[v0] Sending email to ${user.name} (${user.role}) at ${user.email}`)

        const emailResult = await sendAlertEmail(user.email, user.name, alertData)

        emailResults.push({
          userId: user.id,
          userName: user.name,
          role: user.role,
          email: user.email,
          success: emailResult.success,
          error: emailResult.error,
        })

        console.log(`[v0] Email to ${user.name}:`, emailResult.success ? "sent" : `failed - ${emailResult.error}`)
      }

      await query(`UPDATE property_alerts SET notified_at = NOW() WHERE id = ?`, [alertId])

      results.push({
        alertId,
        propertyId: prop.property_id,
        propertyTitle: prop.title,
        asesorRole,
        action: isNewAlert ? "created" : "updated",
        notified: true,
        emailNotifications: emailResults,
      })
    }

    console.log("[v0] Alert generation and email notification complete")
    console.log("[v0] Total alerts processed:", results.length)

    return NextResponse.json({
      success: true,
      message: "Alerts generated and email notifications sent",
      alertsProcessed: results.length,
      results,
    })
  } catch (error) {
    console.error("[v0] Error in alert generation:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Error generating alerts",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return POST(new Request("http://localhost/api/alerts/generate-and-notify", { method: "POST" }))
}
