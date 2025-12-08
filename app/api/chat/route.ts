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

    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY no configurada. Por favor agrega tu API key de OpenAI en las variables de entorno.",
      )
    }

    const systemMessage = `Eres Hogarcito, un asesor inmobiliario profesional de Your Business House en Venezuela.

PROCESO DE BÚSQUEDA:
1. Pregunta: "¿Estás buscando comprar o alquilar?"
2. Pregunta: "¿En qué ciudad o zona de Venezuela?"
3. Pregunta: "¿Cuál es tu presupuesto aproximado?"
4. Si no mencionó el tipo: "¿Qué tipo de inmueble? (casa, apartamento, local, terreno)"

Cuando tengas operación + ubicación + presupuesto, DEBES usar este formato EXACTO:

[BUSCAR_PROPIEDADES]
operacion:alquiler
ubicacion:prebo valencia
precio_min:500
precio_max:1200
tipo:apartamento
habitaciones:2
[/BUSCAR_PROPIEDADES]

Después del marcador, escribe solo: "Buscando opciones..."

REGLAS:
- Respuestas cortas (máximo 2 líneas)
- UNA pregunta a la vez
- NO menciones WhatsApp en tus respuestas
- Las propiedades se mostrarán automáticamente

WhatsApp contacto: +58 (424) 429-1541`

    const formattedMessages: Message[] = [
      { role: "system", content: systemMessage },
      ...messages.map((m: any) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content || "",
      })),
    ]

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
          let hasSearched = false

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

                    const cleanContent = content.replace(/\[BUSCAR_PROPIEDADES\][\s\S]*?\[\/BUSCAR_PROPIEDADES\]/gi, "")

                    if (cleanContent.trim()) {
                      const data = JSON.stringify({ type: "text", content: cleanContent })
                      controller.enqueue(encoder.encode(`${data}\n`))
                    }

                    if (fullResponse.includes("[/BUSCAR_PROPIEDADES]") && !hasSearched) {
                      hasSearched = true

                      const searchMatch = fullResponse.match(
                        /\[BUSCAR_PROPIEDADES\]([\s\S]*?)\[\/BUSCAR_PROPIEDADES\]/i,
                      )

                      if (searchMatch) {
                        const searchContent = searchMatch[1]

                        const operacionMatch = searchContent.match(/operacion:\s*(compra|alquiler)/i)
                        const ubicacionMatch = searchContent.match(/ubicacion:\s*([^\n]+)/i)
                        const precioMinMatch = searchContent.match(/precio_min:\s*(\d+)/i)
                        const precioMaxMatch = searchContent.match(/precio_max:\s*(\d+)/i)
                        const tipoMatch = searchContent.match(/tipo:\s*([^\n]+)/i)
                        const habitacionesMatch = searchContent.match(/habitaciones:\s*(\d+)/i)

                        if (operacionMatch && ubicacionMatch && precioMaxMatch) {
                          const mysql = require("mysql2/promise")

                          try {
                            const connection = await mysql.createConnection(process.env.DATABASE_URL)

                            let query = `
                              SELECT i.*, 
                                     (SELECT image_url FROM inmueble_images WHERE inmueble_id = i.id LIMIT 1) as image_url
                              FROM inmueble i 
                              WHERE i.status = 'disponible'
                            `
                            const params: any[] = []

                            const operacion = operacionMatch[1].toLowerCase()
                            if (operacion === "compra") {
                              query += " AND (i.operation_type = 'compra' OR i.operation_type = 'ambos')"
                            } else if (operacion === "alquiler") {
                              query += " AND (i.operation_type = 'alquiler' OR i.operation_type = 'ambos')"
                            }

                            const ubicacion = ubicacionMatch[1].trim()
                            query += " AND i.location LIKE ?"
                            params.push(`%${ubicacion}%`)

                            const precioMax = Number.parseInt(precioMaxMatch[1])
                            const precioMin = precioMinMatch ? Number.parseInt(precioMinMatch[1]) : 0

                            if (operacion === "compra") {
                              query += " AND i.purchase_price IS NOT NULL AND i.purchase_price <= ?"
                              params.push(precioMax)
                              if (precioMin > 0) {
                                query += " AND i.purchase_price >= ?"
                                params.push(precioMin)
                              }
                            } else {
                              query += " AND i.rental_price IS NOT NULL AND i.rental_price <= ?"
                              params.push(precioMax)
                              if (precioMin > 0) {
                                query += " AND i.rental_price >= ?"
                                params.push(precioMin)
                              }
                            }

                            if (tipoMatch) {
                              const tipo = tipoMatch[1].trim().toLowerCase()
                              query += " AND LOWER(i.property_type) LIKE ?"
                              params.push(`%${tipo}%`)
                            }

                            if (habitacionesMatch) {
                              query += " AND i.bedrooms >= ?"
                              params.push(Number.parseInt(habitacionesMatch[1]))
                            }

                            query += " LIMIT 10"

                            const [rows] = await connection.execute(query, params)

                            if (Array.isArray(rows) && rows.length > 0) {
                              const propertiesToSend = rows.map((row: any) => ({
                                id: row.id,
                                title: row.title,
                                location: row.location,
                                price: operacion === "compra" ? row.purchase_price : row.rental_price,
                                bedrooms: row.bedrooms,
                                bathrooms: row.bathrooms,
                                area: row.area,
                                image_url: row.image_url,
                              }))

                              const propertiesData = JSON.stringify({
                                type: "properties",
                                properties: propertiesToSend,
                              })
                              controller.enqueue(encoder.encode(`${propertiesData}\n`))
                            } else {
                              const noResultsMsg = JSON.stringify({
                                type: "text",
                                content: "\n\nNo encontré propiedades exactas. ¿Quieres ajustar algún criterio?",
                              })
                              controller.enqueue(encoder.encode(`${noResultsMsg}\n`))
                            }

                            await connection.end()
                          } catch (dbError) {
                            console.error("Database error:", dbError)
                            const errorMsg = JSON.stringify({
                              type: "text",
                              content: "\n\nTuve un problema buscando. Intenta de nuevo.",
                            })
                            controller.enqueue(encoder.encode(`${errorMsg}\n`))
                          }
                        }
                      }
                    }
                  }
                } catch (e) {
                  // Skip parsing errors
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
