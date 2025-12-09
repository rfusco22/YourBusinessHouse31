import { query } from "@/lib/db"
import { NextResponse } from "next/server"
import { sendAlertEmail } from "@/lib/email"

async function getUsersToNotifyByRole(ownerId: number, ownerRole: string): Promise<any[]> {
  let users: any[] = []

  if (ownerRole === "asesor") {
    const owner = await query(`SELECT id, name, email, role FROM users WHERE id = ? AND is_active = TRUE`, [ownerId])
    const supervisors = await query(
      `SELECT id, name, email, role FROM users WHERE (role = 'admin' OR role = 'gerencia') AND is_active = TRUE`,
    )
    users = [...(owner as any[]), ...(supervisors as any[])]
  } else if (ownerRole === "admin") {
    const owner = await query(`SELECT id, name, email, role FROM users WHERE id = ? AND is_active = TRUE`, [ownerId])
    const gerencia = await query(`SELECT id, name, email, role FROM users WHERE role = 'gerencia' AND is_active = TRUE`)
    users = [...(owner as any[]), ...(gerencia as any[])]
  } else if (ownerRole === "gerencia") {
    const gerencia = await query(`SELECT id, name, email, role FROM users WHERE id = ? AND is_active = TRUE`, [ownerId])
    users = gerencia as any[]
  } else {
    const owner = await query(`SELECT id, name, email, role FROM users WHERE id = ? AND is_active = TRUE`, [ownerId])
    const supervisors = await query(
      `SELECT id, name, email, role FROM users WHERE (role = 'admin' OR role = 'gerencia') AND is_active = TRUE`,
    )
    users = [...(owner as any[]), ...(supervisors as any[])]
  }

  return users
}

async function sendImmediateEmailNotification(alert: any, baseUrl: string) {
  const usersToNotify = await getUsersToNotifyByRole(alert.agentId, alert.agentRole || "asesor")
  const emailResults = []

  for (const user of usersToNotify) {
    if (!user.email) continue

    const alertData = {
      propertyTitle: alert.propertyTitle,
      propertyUrl: `${baseUrl}/propiedades/${alert.propertyId}`,
      alertType: alert.type === "no_alquilado_1m" ? "no_alquilado" : "no_vendido",
      daysInactive: alert.daysInactive,
      monthsInactive: Math.floor(alert.daysInactive / 30),
      description: alert.description,
      ownerName: alert.agentName,
      ownerRole: alert.agentRole || "asesor",
      operationType: alert.operationType,
    }

    const result = await sendAlertEmail(user.email, user.name, alertData)
    emailResults.push({
      userId: user.id,
      userName: user.name,
      role: user.role,
      email: user.email,
      success: result.success,
      error: result.error,
    })

    console.log(`[v0] Immediate email to ${user.name} (${user.role}):`, result.success ? "sent" : `failed`)
  }

  return emailResults
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get("agentId")
    const autoNotify = searchParams.get("autoNotify") !== "false"

    console.log("[v0] Fetching property inactivity alerts...")

    let whereClause = "WHERE i.status = 'disponible'"
    if (agentId) {
      whereClause += ` AND i.owner_id = ${agentId}`
    }

    const alertsQuery = `
      SELECT 
        i.id,
        i.title,
        i.status,
        i.operation_type,
        i.created_at,
        i.updated_at,
        i.last_sale_date,
        i.last_rental_date,
        i.owner_id,
        i.price,
        i.location,
        u.name as agent_name,
        u.email as agent_email,
        u.role as agent_role,
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
      ${whereClause}
      ORDER BY days_inactive DESC
    `

    const alerts = await query(alertsQuery)
    console.log("[v0] Total properties checked:", (alerts as any[]).length)

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://yourbusinesshouse-production.up.railway.app"

    // Filter and format alerts
    const formattedAlerts = (alerts as any[])
      .filter((alert: any) => {
        if (alert.operation_type === "compra" && alert.days_inactive >= 60) return true
        if (alert.operation_type === "alquiler" && alert.days_inactive >= 30) return true
        if (alert.operation_type === "ambos") return alert.days_inactive >= 30
        return false
      })
      .map((alert: any) => {
        let title = "Alerta de Inactividad"
        let description = ""
        let alertType = ""
        const monthsInactive = Math.floor(alert.days_inactive / 30)

        if (alert.operation_type === "compra" && alert.days_inactive >= 60) {
          title = `Propiedad no vendida`
          description = `"${alert.title}" no ha sido vendida en ${monthsInactive} ${monthsInactive === 1 ? "mes" : "meses"}. Considera revisar el precio o la estrategia de venta.`
          alertType = "no_vendido_2m"
        } else if (alert.operation_type === "alquiler" && alert.days_inactive >= 30) {
          title = `Propiedad no alquilada`
          description = `"${alert.title}" no ha sido alquilada en ${monthsInactive} ${monthsInactive === 1 ? "mes" : "meses"}. Considera revisar el precio de alquiler o mejorar la publicación.`
          alertType = "no_alquilado_1m"
        } else if (alert.operation_type === "ambos") {
          if (alert.days_inactive >= 60) {
            title = `Propiedad no vendida`
            description = `"${alert.title}" no ha sido vendida en ${monthsInactive} ${monthsInactive === 1 ? "mes" : "meses"}.`
            alertType = "no_vendido_2m"
          } else if (alert.days_inactive >= 30) {
            title = `Propiedad no alquilada`
            description = `"${alert.title}" no ha sido alquilada en ${monthsInactive} ${monthsInactive === 1 ? "mes" : "meses"}.`
            alertType = "no_alquilado_1m"
          }
        }

        return {
          id: alert.id,
          title,
          description,
          type: alertType,
          status: "activa",
          createdAt: new Date(alert.created_at).toISOString().split("T")[0],
          propertyTitle: alert.title,
          daysInactive: alert.days_inactive,
          agentId: alert.owner_id,
          agentName: alert.agent_name,
          agentEmail: alert.agent_email,
          agentRole: alert.agent_role,
          propertyId: alert.id,
          operationType: alert.operation_type,
          price: alert.price,
          location: alert.location,
        }
      })

    const notificationResults: any[] = []
    if (autoNotify && formattedAlerts.length > 0) {
      console.log("[v0] Sending immediate email notifications for", formattedAlerts.length, "alerts...")

      for (const alert of formattedAlerts) {
        // Check if we already notified about this alert today
        const notificationCheck = await query(
          `SELECT id FROM email_notification_log 
           WHERE property_id = ? AND alert_type = ? AND DATE(sent_at) = CURDATE()`,
          [alert.propertyId, alert.type],
        ).catch(() => []) // Table might not exist yet

        if ((notificationCheck as any[]).length > 0) {
          console.log(`[v0] Already notified about property ${alert.propertyId} today, skipping`)
          continue
        }

        const emailResults = await sendImmediateEmailNotification(alert, baseUrl)

        // Log the notification
        for (const result of emailResults) {
          if (result.success) {
            await query(
              `INSERT INTO email_notification_log (property_id, alert_type, recipient_id, recipient_email, sent_at)
               VALUES (?, ?, ?, ?, NOW())`,
              [alert.propertyId, alert.type, result.userId, result.email],
            ).catch(() => {}) // Table might not exist yet
          }
        }

        notificationResults.push({
          propertyId: alert.propertyId,
          propertyTitle: alert.propertyTitle,
          type: alert.type,
          emailsSent: emailResults.filter((r) => r.success).length,
          results: emailResults,
        })
      }
    }

    console.log("[v0] Property alerts generated:", formattedAlerts.length)
    console.log("[v0] Email notifications sent:", notificationResults.length)

    return NextResponse.json({
      success: true,
      alerts: formattedAlerts,
      notifications: notificationResults,
    })
  } catch (error) {
    console.error("[v0] Error fetching property alerts:", error)
    return NextResponse.json({ success: false, error: "Error al obtener alertas" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { propertyId, actionType } = body

    if (!propertyId || !actionType) {
      return NextResponse.json({ success: false, error: "propertyId and actionType are required" }, { status: 400 })
    }

    let updateQuery = ""
    if (actionType === "sold") {
      updateQuery = `UPDATE inmueble SET last_sale_date = NOW(), status = 'no_disponible' WHERE id = ?`
    } else if (actionType === "rented") {
      updateQuery = `UPDATE inmueble SET last_rental_date = NOW() WHERE id = ?`
    } else if (actionType === "edited") {
      updateQuery = `UPDATE inmueble SET updated_at = NOW() WHERE id = ?`
    }

    if (updateQuery) {
      await query(updateQuery, [propertyId])
    }

    return NextResponse.json({ success: true, message: "Alert resolved successfully" })
  } catch (error) {
    console.error("[v0] Error resolving alert:", error)
    return NextResponse.json({ success: false, error: "Error al resolver la alerta" }, { status: 500 })
  }
}
