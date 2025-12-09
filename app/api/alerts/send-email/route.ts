import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { sendAlertEmail, isEmailConfigured } from "@/lib/email"

// API to manually send alert email for a specific property
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { propertyId, alertId } = body

    if (!propertyId) {
      return NextResponse.json({ error: "Property ID required" }, { status: 400 })
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          error: "Email service not configured",
          hint: "Configure RESEND_API_KEY in environment variables",
        },
        { status: 500 },
      )
    }

    // Get property details
    const properties = (await query(
      `SELECT 
        i.id,
        i.title,
        i.owner_id,
        i.updated_at,
        IFNULL(i.operation_type, 'compra') as operation_type,
        DATEDIFF(CURDATE(), i.updated_at) as days_inactive,
        u.name as owner_name,
        u.email as owner_email,
        u.role as owner_role
      FROM inmueble i
      LEFT JOIN users u ON i.owner_id = u.id
      WHERE i.id = ?`,
      [propertyId],
    )) as any[]

    if (properties.length === 0) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    const property = properties[0]
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://yourbusinesshouse-production.up.railway.app"
    const propertyUrl = `${baseUrl}/propiedades/${property.id}`

    // Get users to notify based on role hierarchy
    let roleCondition = ""
    const ownerRole = property.owner_role || "asesor"

    if (ownerRole === "asesor") {
      roleCondition = `(id = ? OR role = 'admin' OR role = 'gerencia')`
    } else if (ownerRole === "admin") {
      roleCondition = `(id = ? OR role = 'gerencia')`
    } else {
      roleCondition = `(id = ?)`
    }

    const usersToNotify = (await query(
      `SELECT id, name, email, role 
       FROM users 
       WHERE ${roleCondition} AND is_active = TRUE AND email IS NOT NULL`,
      [property.owner_id],
    )) as any[]

    let emailsSent = 0
    let emailsFailed = 0
    const results: any[] = []

    for (const user of usersToNotify) {
      if (!user.email) continue

      const result = await sendAlertEmail(user.email, user.name, {
        propertyTitle: property.title,
        propertyUrl: propertyUrl,
        daysInactive: property.days_inactive,
        operationType: property.operation_type,
        ownerName: property.owner_name,
        ownerRole: ownerRole,
        isOwner: user.id === property.owner_id,
      })

      results.push({
        name: user.name,
        email: user.email,
        role: user.role,
        success: result.success,
        error: result.error,
      })

      if (result.success) {
        emailsSent++
      } else {
        emailsFailed++
      }
    }

    // Update alert notification timestamp if alertId provided
    if (alertId) {
      await query(`UPDATE property_alerts SET last_notified_at = NOW() WHERE id = ?`, [alertId])
    }

    return NextResponse.json({
      success: true,
      emailsSent,
      emailsFailed,
      totalRecipients: usersToNotify.length,
      results,
    })
  } catch (error) {
    console.error("[v0] Error sending alert email:", error)
    return NextResponse.json(
      { error: "Failed to send alert emails", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
