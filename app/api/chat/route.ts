export const maxDuration = 60

interface Message {
  role: string
  content: string
}

export async function POST(request: Request) {
  try {
    const { messages } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      throw new Error("Messages array is required")
    }

    // Verificar que tengamos API key de OpenAI
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY no configurada. Por favor agrega tu API key de OpenAI en las variables de entorno.",
      )
    }

    // Mensaje del sistema que define el comportamiento del chatbot
    const systemMessage = `Eres Hogarcito, un asesor inmobiliario profesional, amigable y experto de Your Business House en Venezuela. Tu misión es ayudar a los clientes a encontrar su hogar ideal de manera eficiente y personalizada.

PERSONALIDAD:
- Profesional pero cercano, como un asesor venezolano experimentado
- Empático y atento a las necesidades del cliente
- Eficiente: haces preguntas claras y directas
- Entusiasta sobre las propiedades que ofreces

TU PROCESO DE ASESORÍA (paso a paso):

1. SALUDO INICIAL
   - Saluda cordialmente: "¡Hola! Soy Hogarcito, tu agente inmobiliario virtual. Estoy aquí para ayudarte a encontrar tu próximo hogar en cualquier parte de Venezuela."
   - Pregunta: "¿Estás buscando comprar o alquilar?"

2. RECOPILAR INFORMACIÓN BÁSICA
   - Tipo de operación: compra o alquiler
   - Ubicación: ciudad o zona en Venezuela
   - Presupuesto: rango de precio
   - Tipo de inmueble: apartamento, casa, local, etc.

3. DETALLES ADICIONALES (si aplica)
   - Número de habitaciones
   - Número de baños
   - Área mínima

4. BUSCAR Y PRESENTAR OPCIONES
   - Cuando tengas suficiente información, busca propiedades
   - Presenta las opciones de manera atractiva
   - Destaca características importantes

5. CIERRE
   - Pregunta si desean agendar una visita
   - Ofrece contacto por WhatsApp: +58 (424) 429-1541
   - Proporciona información de contacto adicional si la solicitan

REGLAS DE COMUNICACIÓN:
- Respuestas cortas y directas (máximo 2-3 líneas)
- UNA pregunta a la vez
- Usa emojis ocasionalmente (🏠 🔑 ✨)
- Si el cliente menciona varios criterios a la vez, tómalos todos en cuenta
- Sé proactivo y natural en la conversación

INFORMACIÓN DE CONTACTO:
- Ubicación: CC El Añil, Valencia, Estado Carabobo, Venezuela
- Cobertura: Toda Venezuela
- WhatsApp: +58 (424) 429-1541
- Instagram: @yourbusinesshouse
- Email: info@yourbusinesshouse.com

IMPORTANTE: Si te preguntan sobre propiedades disponibles, explica que puedes ayudarles a buscar opciones según sus necesidades. Pregunta por sus preferencias para hacer una búsqueda personalizada.`

    // Preparar mensajes para OpenAI
    const formattedMessages: Message[] = [
      { role: "system", content: systemMessage },
      ...messages.map((m: any) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content || "",
      })),
    ]

    // Llamar a la API de OpenAI directamente
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 500,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("OpenAI API error:", errorData)
      throw new Error(`OpenAI API error: ${errorData.error?.message || "Unknown error"}`)
    }

    // Crear stream de respuesta
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = response.body?.getReader()
          if (!reader) {
            throw new Error("No reader available")
          }

          let buffer = ""

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            for (const line of lines) {
              const trimmedLine = line.trim()
              if (!trimmedLine || trimmedLine === "data: [DONE]") continue

              if (trimmedLine.startsWith("data: ")) {
                try {
                  const jsonStr = trimmedLine.slice(6)
                  const parsed = JSON.parse(jsonStr)
                  const content = parsed.choices?.[0]?.delta?.content

                  if (content) {
                    const data = JSON.stringify({ type: "text", content })
                    controller.enqueue(encoder.encode(`${data}\n`))
                  }
                } catch (e) {
                  console.error("Error parsing SSE:", e)
                }
              }
            }
          }

          controller.close()
        } catch (error) {
          console.error("Stream error:", error)
          const errorData = JSON.stringify({
            type: "text",
            content: "Disculpa, tuve un problema. ¿Podrías intentarlo de nuevo?",
          })
          controller.enqueue(encoder.encode(`${errorData}\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("Error in chat API:", error)

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const errorMsg = error instanceof Error ? error.message : "Error desconocido"
        let userMessage = "Disculpa, hubo un problema técnico. Por favor intenta de nuevo."

        if (errorMsg.includes("OPENAI_API_KEY")) {
          userMessage =
            "El chatbot necesita configuración. Por favor contacta al administrador para agregar la API key de OpenAI."
        }

        const data = JSON.stringify({
          type: "text",
          content: userMessage,
        })
        controller.enqueue(encoder.encode(`${data}\n`))
        controller.close()
      },
    })

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache",
      },
    })
  }
}
