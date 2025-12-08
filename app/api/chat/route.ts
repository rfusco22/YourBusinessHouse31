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

    const systemMessage = `Eres Hogarcito, un asesor inmobiliario profesional, amigable y experto de Your Business House en Venezuela. Tu misión es ayudar a los clientes a encontrar su hogar ideal de manera eficiente y personalizada.

PERSONALIDAD:
- Profesional pero cercano, como un asesor venezolano experimentado
- Empático y atento a las necesidades del cliente
- Eficiente: haces preguntas claras y directas
- Entusiasta sobre las propiedades que ofreces

TU PROCESO DE ASESORÍA (paso a paso):

1. SALUDO INICIAL
   - Saluda cordialmente
   - Pregunta: "¿Estás buscando comprar o alquilar?"

2. RECOPILAR INFORMACIÓN ESENCIAL
   Haz UNA pregunta a la vez en este orden:
   a) Tipo de operación: comprar o alquilar
   b) Ubicación: ¿En qué ciudad o zona de Venezuela?
   c) Presupuesto: ¿Cuál es tu presupuesto aproximado?
   d) Tipo de inmueble: ¿Casa, apartamento, local comercial, terreno?

3. DETALLES OPCIONALES (solo si el cliente lo menciona)
   - Número de habitaciones
   - Número de baños
   - Área mínima

4. BUSCAR PROPIEDADES
   Cuando tengas al menos: operación, ubicación y presupuesto, indica que vas a buscar con este formato EXACTO:
   
   [BUSCAR_PROPIEDADES]
   operacion: compra o alquiler
   ubicacion: [ciudad o zona]
   precio_min: [número]
   precio_max: [número]
   tipo: [tipo de inmueble si lo especificó]
   habitaciones: [número si lo especificó]
   banos: [número si lo especificó]
   [/BUSCAR_PROPIEDADES]

5. DESPUÉS DE MOSTRAR PROPIEDADES
   - Si se muestran propiedades, di: "Aquí te muestro algunas opciones que encontré. ¿Te interesa alguna para agendar una visita?"
   - Si no hay propiedades, di: "No encontré propiedades con esos criterios exactos. ¿Quieres que busque con criterios más flexibles?"
   - Ofrece contacto directo: "También puedes contactarnos por WhatsApp al +58 (424) 429-1541"

REGLAS DE COMUNICACIÓN:
- Respuestas MUY cortas (máximo 2 líneas)
- UNA pregunta a la vez
- Si el cliente da varios datos juntos, agradece y pide solo lo que falta
- Usa emojis ocasionalmente: 🏠 🔑 ✨ 👍
- No preguntes por detalles opcionales a menos que el cliente los mencione

IMPORTANTE:
- SIEMPRE usa el formato [BUSCAR_PROPIEDADES] cuando tengas suficiente información
- NO ofrezcas "enviar por WhatsApp", las propiedades se mostrarán automáticamente en el chat
- Sé breve y directo

INFORMACIÓN DE CONTACTO:
- WhatsApp: +58 (424) 429-1541
- Ubicación: CC El Añil, Valencia, Estado Carabobo, Venezuela
- Instagram: @yourbusinesshouse`

    const lastMessage = messages[messages.length - 1]?.content || ""
    const allMessages = messages.map((m: any) => m.content).join(" ")

    const propertiesToSend: any[] = []
    const shouldSearchProperties = false
    const searchParams: any = {}

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
          let fullResponse = ""

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
                    fullResponse += content
                    const data = JSON.stringify({ type: "text", content })
                    controller.enqueue(encoder.encode(`${data}\n`))
                  }
                } catch (e) {
                  console.error("Error parsing SSE:", e)
                }
              }
            }
          }

          const searchMatch = fullResponse.match(/\[BUSCAR_PROPIEDADES\]([\s\S]*?)\[\/BUSCAR_PROPIEDADES\]/i)

          if (searchMatch) {
            const searchContent = searchMatch[1]
            const operacionMatch = searchContent.match(/operacion:\s*(compra|alquiler)/i)
            const ubicacionMatch = searchContent.match(/ubicacion:\s*(.+?)$/im)
            const precioMinMatch = searchContent.match(/precio_min:\s*(\d+)/i)
            const precioMaxMatch = searchContent.match(/precio_max:\s*(\d+)/i)
            const tipoMatch = searchContent.match(/tipo:\s*(.+?)$/im)
            const habitacionesMatch = searchContent.match(/habitaciones:\s*(\d+)/i)
            const banosMatch = searchContent.match(/banos:\s*(\d+)/i)

            if (operacionMatch && ubicacionMatch) {
              // Conectar a base de datos y buscar propiedades
              const mysql = require("mysql2/promise")
              const connection = await mysql.createConnection(process.env.DATABASE_URL)

              try {
                let query = "SELECT * FROM properties WHERE 1=1"
                const params: any[] = []

                // Filtro de operación
                const operacion = operacionMatch[1].toLowerCase()
                if (operacion === "compra") {
                  query += " AND (operation_type = 'compra' OR operation_type = 'ambos')"
                } else if (operacion === "alquiler") {
                  query += " AND (operation_type = 'alquiler' OR operation_type = 'ambos')"
                }

                // Filtro de ubicación
                const ubicacion = ubicacionMatch[1].trim()
                query += " AND (city LIKE ? OR address LIKE ? OR location LIKE ?)"
                params.push(`%${ubicacion}%`, `%${ubicacion}%`, `%${ubicacion}%`)

                // Filtro de precio
                if (precioMinMatch && precioMaxMatch) {
                  const precioMin = Number.parseInt(precioMinMatch[1])
                  const precioMax = Number.parseInt(precioMaxMatch[1])

                  if (operacion === "compra") {
                    query += " AND purchase_price BETWEEN ? AND ?"
                    params.push(precioMin, precioMax)
                  } else {
                    query += " AND rental_price BETWEEN ? AND ?"
                    params.push(precioMin, precioMax)
                  }
                }

                // Filtro de tipo
                if (tipoMatch) {
                  const tipo = tipoMatch[1].trim()
                  query += " AND property_type LIKE ?"
                  params.push(`%${tipo}%`)
                }

                // Filtro de habitaciones
                if (habitacionesMatch) {
                  query += " AND bedrooms >= ?"
                  params.push(Number.parseInt(habitacionesMatch[1]))
                }

                // Filtro de baños
                if (banosMatch) {
                  query += " AND bathrooms >= ?"
                  params.push(Number.parseInt(banosMatch[1]))
                }

                query += " LIMIT 5"

                const [rows] = await connection.execute(query, params)

                if (Array.isArray(rows) && rows.length > 0) {
                  const properties = rows.map((row: any) => ({
                    id: row.id,
                    title: row.title,
                    location: row.location || `${row.city}, ${row.state}`,
                    price: operacion === "compra" ? row.purchase_price : row.rental_price,
                    bedrooms: row.bedrooms,
                    bathrooms: row.bathrooms,
                    area: row.area,
                    image_url: row.image_url,
                  }))

                  const propertiesData = JSON.stringify({ type: "properties", properties })
                  controller.enqueue(encoder.encode(`${propertiesData}\n`))
                }

                await connection.end()
              } catch (dbError) {
                console.error("Database error:", dbError)
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
