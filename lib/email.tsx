import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

interface AlertEmailData {
  propertyTitle: string
  propertyUrl: string
  daysInactive: number
  operationType: string
  ownerName: string
  ownerRole: string
  isOwner: boolean
}

function generateAlertEmailHTML(recipientName: string, data: AlertEmailData): string {
  const months = Math.floor(data.daysInactive / 30)
  const isRental = data.operationType === "alquiler" || data.operationType === "ambos"
  const alertType = isRental ? "sin alquilarse" : "sin venderse"

  const ownerSection = data.isOwner
    ? `<p style="font-size: 15px; color: #666; margin-bottom: 20px;">
        Tu propiedad <strong>"${data.propertyTitle}"</strong> lleva <strong>${months} mes${months !== 1 ? "es" : ""}</strong> ${alertType}.
        Considera revisar el precio o mejorar la publicación.
      </p>`
    : `<p style="font-size: 15px; color: #666; margin-bottom: 20px;">
        La propiedad <strong>"${data.propertyTitle}"</strong> del ${data.ownerRole} <strong>${data.ownerName}</strong> 
        lleva <strong>${months} mes${months !== 1 ? "es" : ""}</strong> ${alertType}.
      </p>`

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
      .header { background: linear-gradient(135deg, #a27622 0%, #bea244 100%); padding: 40px 20px; text-align: center; color: white; }
      .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 10px; }
      .header p { font-size: 14px; opacity: 0.9; }
      .alert-badge { display: inline-block; background: #dc2626; color: white; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 15px; }
      .content { padding: 40px 20px; }
      .property-card { background: #f9f9f9; border-left: 4px solid #a27622; padding: 20px; border-radius: 8px; margin: 20px 0; }
      .property-title { font-size: 16px; font-weight: 700; color: #333; margin-bottom: 10px; }
      .property-meta { font-size: 13px; color: #666; }
      .property-meta span { display: block; margin-bottom: 5px; }
      .cta-button { display: inline-block; background: #a27622; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
      .cta-button:hover { background: #8a6419; }
      .footer { background: #f5f5f5; padding: 30px 20px; text-align: center; border-top: 1px solid #e0e0e0; }
      .footer p { font-size: 12px; color: #999; line-height: 1.8; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🔔 Alerta de Propiedad</h1>
        <p>Your Business House - Sistema de Alertas</p>
        <div class="alert-badge">REQUIERE ATENCIÓN</div>
      </div>

      <div class="content">
        <p style="font-size: 15px; color: #333; margin-bottom: 10px;">
          Hola <strong>${recipientName}</strong>,
        </p>
        
        ${ownerSection}

        <div class="property-card">
          <div class="property-title">📍 ${data.propertyTitle}</div>
          <div class="property-meta">
            <span>⏱️ Tiempo inactivo: <strong>${data.daysInactive} días</strong> (${months} mes${months !== 1 ? "es" : ""})</span>
            <span>📋 Tipo de operación: <strong>${isRental ? "Alquiler" : "Venta"}</strong></span>
            ${!data.isOwner ? `<span>👤 Responsable: <strong>${data.ownerName}</strong> (${data.ownerRole})</span>` : ""}
          </div>
        </div>

        <p style="font-size: 14px; color: #666;">
          Te recomendamos revisar la propiedad y considerar ajustar el precio o mejorar las fotos y descripción para aumentar su visibilidad.
        </p>

        <center>
          <a href="${data.propertyUrl}" class="cta-button">Ver Propiedad</a>
        </center>
      </div>

      <div class="footer">
        <p>
          Este correo fue enviado automáticamente por el sistema de alertas.<br>
          <strong>Your Business House</strong> - Agencia Inmobiliaria Premium
        </p>
      </div>
    </div>
  </body>
</html>
  `.trim()
}

export async function sendAlertEmail(
  toEmail: string,
  recipientName: string,
  data: AlertEmailData,
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    if (!isEmailConfigured()) {
      console.log("[v0] Email not configured - RESEND_API_KEY missing")
      return { success: false, error: "Email service not configured" }
    }

    const months = Math.floor(data.daysInactive / 30)
    const isRental = data.operationType === "alquiler" || data.operationType === "ambos"
    const alertType = isRental ? "sin alquilar" : "sin vender"

    const subject = `🔔 Alerta: "${data.propertyTitle}" - ${months} mes${months !== 1 ? "es" : ""} ${alertType}`

    console.log(`[v0] Sending alert email to ${toEmail}`)

    const response = await resend.emails.send({
      from: "Your Business House <onboarding@resend.dev>",
      to: toEmail,
      subject: subject,
      html: generateAlertEmailHTML(recipientName, data),
    })

    if (response.error) {
      console.error("[v0] Resend error:", response.error)
      return { success: false, error: response.error.message }
    }

    console.log(`[v0] Email sent successfully to ${toEmail}, ID: ${response.data?.id}`)
    return { success: true, id: response.data?.id }
  } catch (error) {
    console.error("[v0] Error sending email:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
