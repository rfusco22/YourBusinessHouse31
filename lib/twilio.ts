// Configuración de Twilio para WhatsApp
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886"

interface SendWhatsAppResult {
  success: boolean
  messageSid?: string
  error?: string
}

export async function sendWhatsAppMessage(to: string, message: string): Promise<SendWhatsAppResult> {
  console.log("[v0] ====== SENDING WHATSAPP MESSAGE ======")
  console.log("[v0] To:", to)
  console.log("[v0] Message length:", message.length)
  console.log("[v0] TWILIO_ACCOUNT_SID exists:", !!TWILIO_ACCOUNT_SID)
  console.log("[v0] TWILIO_AUTH_TOKEN exists:", !!TWILIO_AUTH_TOKEN)
  console.log("[v0] TWILIO_WHATSAPP_FROM:", TWILIO_WHATSAPP_FROM)

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error("[v0] ERROR: Twilio credentials not configured!")
    console.error("[v0] Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables")
    return {
      success: false,
      error:
        "Twilio credentials not configured. Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to environment variables.",
    }
  }

  let formattedTo = to.replace(/\s+/g, "").replace(/-/g, "")
  if (!formattedTo.startsWith("+")) {
    formattedTo = "+" + formattedTo
  }
  if (!formattedTo.startsWith("whatsapp:")) {
    formattedTo = `whatsapp:${formattedTo}`
  }

  console.log("[v0] Formatted recipient:", formattedTo)

  try {
    console.log("[v0] Sending request to Twilio API...")

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: TWILIO_WHATSAPP_FROM,
        To: formattedTo,
        Body: message,
      }),
    })

    const data = await response.json()
    console.log("[v0] Twilio response status:", response.status)
    console.log("[v0] Twilio response:", JSON.stringify(data, null, 2))

    if (response.ok) {
      console.log("[v0] SUCCESS! WhatsApp message sent! SID:", data.sid)
      return { success: true, messageSid: data.sid }
    } else {
      console.error("[v0] TWILIO ERROR:", data.message || data.error_message)
      return { success: false, error: data.message || data.error_message || "Failed to send message" }
    }
  } catch (error) {
    console.error("[v0] EXCEPTION while sending WhatsApp:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export const sendWhatsAppAlert = sendWhatsAppMessage

export function getTwilioStatus(): { configured: boolean; accountSid?: string; fromNumber: string } {
  return {
    configured: !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN),
    accountSid: TWILIO_ACCOUNT_SID ? TWILIO_ACCOUNT_SID.substring(0, 10) + "..." : undefined,
    fromNumber: TWILIO_WHATSAPP_FROM,
  }
}
