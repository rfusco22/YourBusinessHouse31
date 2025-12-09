import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

interface AlertEmailData {
  propertyTitle: string
  propertyUrl: string
  alertType: "no_alquilado" | "no_vendido"
  daysInactive: number
  monthsInactive: number
  description: string
  ownerName: string
  ownerRole: string
  price?: number
  location?: string
  operationType?: string
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

export async function sendAlertEmail(
  to: string,
  recipientName: string,
  alertData: AlertEmailData,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isEmailConfigured()) {
      console.error("[v0] RESEND_API_KEY not configured")
      return { success: false, error: "Email service not configured" }
    }

    const alertTypeText = alertData.alertType === "no_alquilado" ? "no alquilada" : "no vendida"
    const alertColor = alertData.alertType === "no_alquilado" ? "#f59e0b" : "#ef4444"

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #1a1a1a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #2a2a2a; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.3);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #b8860b 0%, #daa520 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #1a1a1a; font-size: 28px; font-weight: bold;">
                YOUR BUSINESS HOUSE
              </h1>
              <p style="margin: 8px 0 0 0; color: #1a1a1a; font-size: 14px; opacity: 0.8;">
                Sistema de Alertas Inmobiliarias
              </p>
            </td>
          </tr>

          <!-- Alert Badge -->
          <tr>
            <td style="padding: 30px 30px 20px 30px; text-align: center;">
              <div style="display: inline-block; background-color: ${alertColor}; color: white; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: bold; text-transform: uppercase;">
                ⚠️ Alerta: Propiedad ${alertTypeText}
              </div>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <p style="margin: 0; color: #ffffff; font-size: 16px;">
                Hola <strong>${recipientName}</strong>,
              </p>
              <p style="margin: 10px 0 0 0; color: #a0a0a0; font-size: 14px; line-height: 1.6;">
                Se ha detectado una propiedad que requiere tu atención inmediata.
              </p>
            </td>
          </tr>

          <!-- Property Card -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #363636; border-radius: 12px; border-left: 4px solid ${alertColor};">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="margin: 0 0 16px 0; color: #daa520; font-size: 20px;">
                      ${alertData.propertyTitle}
                    </h2>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #4a4a4a;">
                          <span style="color: #a0a0a0; font-size: 13px;">Tiempo inactivo</span><br>
                          <span style="color: #ffffff; font-size: 15px; font-weight: bold;">
                            ${alertData.monthsInactive} ${alertData.monthsInactive === 1 ? "mes" : "meses"} (${alertData.daysInactive} días)
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #4a4a4a;">
                          <span style="color: #a0a0a0; font-size: 13px;">Responsable</span><br>
                          <span style="color: #ffffff; font-size: 15px;">
                            ${alertData.ownerName} <span style="color: #daa520;">(${alertData.ownerRole})</span>
                          </span>
                        </td>
                      </tr>
                      ${
                        alertData.location
                          ? `
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #4a4a4a;">
                          <span style="color: #a0a0a0; font-size: 13px;">Ubicación</span><br>
                          <span style="color: #ffffff; font-size: 15px;">${alertData.location}</span>
                        </td>
                      </tr>
                      `
                          : ""
                      }
                      ${
                        alertData.price
                          ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #a0a0a0; font-size: 13px;">Precio</span><br>
                          <span style="color: #22c55e; font-size: 18px; font-weight: bold;">$${alertData.price.toLocaleString()}</span>
                        </td>
                      </tr>
                      `
                          : ""
                      }
                    </table>

                    <p style="margin: 20px 0 0 0; color: #d0d0d0; font-size: 14px; line-height: 1.6; background-color: #2a2a2a; padding: 12px; border-radius: 8px;">
                      ${alertData.description}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 30px 30px 30px; text-align: center;">
              <a href="${alertData.propertyUrl}" style="display: inline-block; background: linear-gradient(135deg, #b8860b 0%, #daa520 100%); color: #1a1a1a; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Ver Propiedad →
              </a>
            </td>
          </tr>

          <!-- Recommendations -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background-color: #363636; border-radius: 12px; padding: 20px;">
                <h3 style="margin: 0 0 12px 0; color: #daa520; font-size: 16px;">
                  💡 Recomendaciones
                </h3>
                <ul style="margin: 0; padding-left: 20px; color: #d0d0d0; font-size: 14px; line-height: 1.8;">
                  <li>Revisa el precio comparándolo con propiedades similares</li>
                  <li>Actualiza las fotos y descripción del inmueble</li>
                  <li>Considera promocionar la propiedad en redes sociales</li>
                  <li>Contacta al propietario para evaluar opciones</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #1f1f1f; padding: 24px 30px; text-align: center;">
              <p style="margin: 0; color: #666666; font-size: 12px;">
                Este correo fue enviado automáticamente por el sistema de alertas de<br>
                <strong style="color: #daa520;">Your Business House</strong>
              </p>
              <p style="margin: 12px 0 0 0; color: #555555; font-size: 11px;">
                © ${new Date().getFullYear()} Your Business House. Todos los derechos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `

    const { data, error } = await resend.emails.send({
      from: "Your Business House <alertas@yourbusinesshouse.com>",
      to: [to],
      subject: `⚠️ Alerta: ${alertData.propertyTitle} - ${alertTypeText} por ${alertData.monthsInactive} ${alertData.monthsInactive === 1 ? "mes" : "meses"}`,
      html: htmlContent,
    })

    if (error) {
      console.error("[v0] Error sending email:", error)
      return { success: false, error: error.message }
    }

    console.log("[v0] Email sent successfully:", data?.id)
    return { success: true }
  } catch (error) {
    console.error("[v0] Exception sending email:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
