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

PROCESO:
1. Pregunta: "¿Estás buscando comprar o alquilar?"
2. Pregunta por ubicación: "¿En qué ciudad o zona de Venezuela?"
3. Pregunta por presupuesto: "¿Cuál es tu presupuesto aproximado?"
4. Pregunta por tipo (si no lo mencionó): "¿Qué tipo de inmueble buscas? (casa, apartamento, local, terreno)"

Cuando tengas: operación, ubicación y presupuesto, usa EXACTAMENTE este formato:

[BUSCAR_PROPIEDADES]
operacion: compra o alquiler
ubicacion: ciudad o zona
precio_min: numero
precio_max: numero
tipo: tipo de inmueble
habitaciones: numero
[/BUSCAR_PROPIEDADES]

DESPUÉS del bloque [/BUSCAR_PROPIEDADES], di solo: "Espérame un momento mientras busco las mejores opciones para ti."

REGLAS:
- Respuestas MUY cortas (máximo 2 líneas)
- UNA pregunta a la vez
- NO menciones WhatsApp
- Las propiedades se mostrarán automáticamente en el chat

WhatsApp: +58 (424) 429-1541`

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
                  }
                } catch (e) {
                  // Skip parsing errors
                }
              }
            }
          }

          console.log("[v0] Full AI response:", fullResponse)

          const searchMatch = fullResponse.match(/\[BUSCAR_PROPIEDADES\]([\s\S]*?)\[\/BUSCAR_PROPIEDADES\]/i)

          if (searchMatch) {
            console.log("[v0] Property search marker detected!")
            const searchContent = searchMatch[1]
            console.log("[v0] Search content:", searchContent)

            const operacionMatch = searchContent.match(/operacion:\s*(compra|alquiler)/i)
            const ubicacionMatch = searchContent.match(/ubicacion:\s*([^\n]+)/i)
            const precioMinMatch = searchContent.match(/precio_min:\s*(\d+)/i)
            const precioMaxMatch = searchContent.match(/precio_max:\s*(\d+)/i)
            const tipoMatch = searchContent.match(/tipo:\s*([^\n]+)/i)
            const habitacionesMatch = searchContent.match(/habitaciones:\s*(\d+)/i)

            console.log("[v0] Extracted params:", {
              operacion: operacionMatch?.[1],
              ubicacion: ubicacionMatch?.[1],
              precioMin: precioMinMatch?.[1],
              precioMax: precioMaxMatch?.[1],
              tipo: tipoMatch?.[1],
              habitaciones: habitacionesMatch?.[1],
            })

            if (operacionMatch && ubicacionMatch && precioMaxMatch) {
              console.log("[v0] All required params present, searching database...")
              console.log("[v0] DATABASE_URL present:", !!process.env.DATABASE_URL)

              const mysql = require("mysql2/promise")

              try {
                const connection = await mysql.createConnection(process.env.DATABASE_URL)
                console.log("[v0] Database connection established")

                let query = "SELECT * FROM properties WHERE 1=1"
                const params: any[] = []

                const operacion = operacionMatch[1].toLowerCase()
                if (operacion === "compra") {
                  query += " AND (operation_type = 'compra' OR operation_type = 'ambos')"
                } else if (operacion === "alquiler") {
                  query += " AND (operation_type = 'alquiler' OR operation_type = 'ambos')"
                }

                const ubicacion = ubicacionMatch[1].trim()
                query += " AND (city LIKE ? OR address LIKE ? OR location LIKE ?)"
                params.push(`%${ubicacion}%`, `%${ubicacion}%`, `%${ubicacion}%`)

                const precioMax = Number.parseInt(precioMaxMatch[1])
                const precioMin = precioMinMatch ? Number.parseInt(precioMinMatch[1]) : 0

                if (operacion === "compra") {
                  query += " AND purchase_price <= ?"
                  params.push(precioMax)
                  if (precioMin > 0) {
                    query += " AND purchase_price >= ?"
                    params.push(precioMin)
                  }
                } else {
                  query += " AND rental_price <= ?"
                  params.push(precioMax)
                  if (precioMin > 0) {
                    query += " AND rental_price >= ?"
                    params.push(precioMin)
                  }
                }

                if (tipoMatch) {
                  const tipo = tipoMatch[1].trim()
                  query += " AND property_type LIKE ?"
                  params.push(`%${tipo}%`)
                }

                if (habitacionesMatch) {
                  query += " AND bedrooms >= ?"
                  params.push(Number.parseInt(habitacionesMatch[1]))
                }

                query += " LIMIT 10"

                console.log("[v0] Executing SQL query:", query)
                console.log("[v0] With params:", params)

                const [rows] = await connection.execute(query, params)

                console.log("[v0] Query executed. Rows found:", Array.isArray(rows) ? rows.length : 0)

                if (Array.isArray(rows) && rows.length > 0) {
                  console.log("[v0] Found", rows.length, "properties")
                  console.log("[v0] First property:", rows[0])

                  const propertiesToSend = rows.map((row: any) => ({
                    id: row.id,
                    title: row.title,
                    location: row.location || `${row.city}, ${row.state}`,
                    price: operacion === "compra" ? row.purchase_price : row.rental_price,
                    bedrooms: row.bedrooms,
                    bathrooms: row.bathrooms,
                    area: row.area,
                    image_url: row.image_url,
                  }))

                  console.log("[v0] Sending properties to frontend:", propertiesToSend.length)

                  const propertiesData = JSON.stringify({
                    type: "properties",
                    properties: propertiesToSend,
                  })
                  controller.enqueue(encoder.encode(`${propertiesData}\n`))

                  console.log("[v0] Properties data sent successfully")
                } else {
                  console.log("[v0] No properties found matching criteria")

                  const noResultsMsg = JSON.stringify({
                    type: "text",
                    content: "\n\nNo encontré propiedades que coincidan exactamente. ¿Quieres ajustar algún criterio?",
                  })
                  controller.enqueue(encoder.encode(`${noResultsMsg}\n`))
                }

                await connection.end()
                console.log("[v0] Database connection closed")
              } catch (dbError) {
                console.error("[v0] Database error:", dbError)
                const errorMsg = JSON.stringify({
                  type: "text",
                  content: "\n\nTuve un problema al buscar en la base de datos. Intenta de nuevo.",
                })
                controller.enqueue(encoder.encode(`${errorMsg}\n`))
              }
            } else {
              console.log("[v0] Missing required search parameters")
            }
          } else {
            console.log("[v0] No property search marker found in response")
          }

          controller.close()
        } catch (error) {
          console.error("[v0] Stream error:", error)
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
