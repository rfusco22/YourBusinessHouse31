import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { sendAlertEmail, isEmailConfigured } from "@/lib/email"

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
    roleCondition = `(id = ? OR role = 'admin' OR role = 'gerencia')`
  }

  const users = await query(
    `SELECT id, name, email, role 
     FROM users 
     WHERE ${roleCondition} AND is_active = TRUE AND email IS NOT NULL`,
    [ownerId],
  )

  return users as any[]
}

export async function GET(request: Request) {
  try {
    console.log("[v0] Cron job: Iniciando verificación automática de alertas")

    // Verificar autorización
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log("[v0] Cron job: Acceso no autorizado")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isEmailConfigured()) {
      console.log("[v0] Cron job: Email no configurado (RESEND_API_KEY)")
      return NextResponse.json(
        {
          error: "Email service not configured",
          hint: "Configure RESEND_API_KEY environment variable",
        },
        { status: 500 },
      )
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
        u.email as asesor_email,
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
    let notificationsFailed = 0
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://yourbusinesshouse-production.up.railway.app"

    for (const property of outdatedProperties) {
      const propertyUrl = `${baseUrl}/propiedades/${property.id}`
      const ownerRole = property.owner_role || "asesor"

      const usersToNotify = await getUsersToNotifyByRole(property.user_id, ownerRole)

      console.log(`[v0] Propiedad "${property.title}" - Dueño: ${property.asesor_name} (${ownerRole})`)
      console.log(`[v0] Usuarios a notificar por email: ${usersToNotify.length}`)

      for (const user of usersToNotify) {
        if (!user.email) continue

        const result = await sendAlertEmail(user.email, user.name, {
          propertyTitle: property.title,
          propertyUrl: propertyUrl,
          daysInactive: property.days_inactive,
          operationType: property.operation_type,
          ownerName: property.asesor_name,
          ownerRole: ownerRole,
          isOwner: user.id === property.user_id,
        })

        if (result.success) {
          notificationsSent++
          console.log(`[v0] Email enviado a ${user.name} (${user.role}): ${user.email}`)
        } else {
          notificationsFailed++
          console.log(`[v0] Error enviando email a ${user.name}: ${result.error}`)
        }
      }
    }

    console.log(
      `[v0] Cron job completado: ${notificationsSent} emails enviados, ${notificationsFailed} fallidos, ${outdatedProperties.length} propiedades`,
    )

    return NextResponse.json({
      success: true,
      propertiesChecked: outdatedProperties.length,
      notificationsSent,
      notificationsFailed,
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
