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
3. Pregunta: "¿Cuál es tu presupuesto aproximado?" (solo un número)
4. Si no mencionó el tipo: "¿Qué tipo de inmueble? (casa, apartamento, local, terreno)"
5. Si no mencionó habitaciones para apartamento/casa: "¿Cuántas habitaciones necesitas?"

IMPORTANTE: Cuando el usuario dice su presupuesto (ej: "1000"), usa ese valor como precio_max. NO inventes un precio_min.

Cuando tengas operación + ubicación + presupuesto, usa este formato EXACTO:

[BUSCAR_PROPIEDADES]operacion:alquiler|ubicacion:prebo valencia|precio_max:1000|tipo:apartamento|habitaciones:4[/BUSCAR_PROPIEDADES]

Después del marcador, NO escribas nada más. Las propiedades se mostrarán automáticamente.

REGLAS:
- Respuestas cortas (máximo 2 líneas)
- UNA pregunta a la vez
- El presupuesto del usuario es el precio_max (NO agregues precio_min)
- Después de [BUSCAR_PROPIEDADES]...[/BUSCAR_PROPIEDADES] NO escribas texto adicional
- NO menciones WhatsApp en tus respuestas

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
          let insideSearchBlock = false

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
                    if (content.includes("[BUSCAR_PROPIEDADES]")) {
                      insideSearchBlock = true
                      console.log("[v0] Search block detected, hiding output")
                    }

                    fullResponse += content

                    if (!insideSearchBlock) {
                      const data = JSON.stringify({ type: "text", content: content })
                      controller.enqueue(encoder.encode(`${data}\n`))
                    }

                    if (content.includes("[/BUSCAR_PROPIEDADES]")) {
                      insideSearchBlock = false
                      console.log("[v0] Search block complete, processing search")
                    }

                    if (fullResponse.includes("[/BUSCAR_PROPIEDADES]") && !hasSearched) {
                      hasSearched = true

                      const searchingMsg = JSON.stringify({
                        type: "text",
                        content: "\n\nBuscando opciones disponibles...",
                      })
                      controller.enqueue(encoder.encode(`${searchingMsg}\n`))

                      const searchMatch = fullResponse.match(
                        /\[BUSCAR_PROPIEDADES\]([\s\S]*?)\[\/BUSCAR_PROPIEDADES\]/i,
                      )

                      if (searchMatch) {
                        const searchContent = searchMatch[1].trim()
                        console.log("[v0] Search content:", searchContent)

                        const params: any = {}
                        const paramParts = searchContent.split("|")

                        for (const part of paramParts) {
                          const colonIndex = part.indexOf(":")
                          if (colonIndex > -1) {
                            const key = part.substring(0, colonIndex).trim()
                            const value = part.substring(colonIndex + 1).trim()
                            if (key && value) {
                              params[key] = value
                            }
                          }
                        }

                        console.log("[v0] Parsed params:", params)

                        if (params.operacion && params.ubicacion) {
                          const mysql = require("mysql2/promise")

                          try {
                            const connection = await mysql.createConnection(process.env.DATABASE_URL)

                            let query = `
                              SELECT i.*, 
                                     (SELECT image_url FROM inmueble_images WHERE inmueble_id = i.id ORDER BY display_order LIMIT 1) as image_url
                              FROM inmueble i 
                              WHERE i.status = 'disponible'
                            `
                            const queryParams: any[] = []

                            const operacion = params.operacion.toLowerCase()
                            if (operacion === "compra" || operacion === "comprar") {
                              query += " AND (i.operation_type = 'compra' OR i.operation_type = 'ambos')"
                            } else if (operacion === "alquiler" || operacion === "alquilar") {
                              query += " AND (i.operation_type = 'alquiler' OR i.operation_type = 'ambos')"
                            }

                            const ubicacion = params.ubicacion.toLowerCase()
                            query += " AND LOWER(i.location) LIKE ?"
                            queryParams.push(`%${ubicacion}%`)

                            const precioMax = params.precio_max ? Number.parseInt(params.precio_max) : null

                            console.log("[v0] Budget (precio_max):", precioMax)

                            if (operacion === "compra" || operacion === "comprar") {
                              query += " AND i.purchase_price IS NOT NULL"
                              if (precioMax) {
                                query += " AND i.purchase_price <= ?"
                                queryParams.push(precioMax)
                              }
                            } else {
                              query += " AND i.rental_price IS NOT NULL"
                              if (precioMax) {
                                query += " AND i.rental_price <= ?"
                                queryParams.push(precioMax)
                              }
                            }

                            if (params.tipo) {
                              const tipo = params.tipo.toLowerCase()
                              query += " AND LOWER(i.property_type) LIKE ?"
                              queryParams.push(`%${tipo}%`)
                            }

                            if (params.habitaciones) {
                              const habitaciones = Number.parseInt(params.habitaciones)
                              query += " AND i.bedrooms = ?"
                              queryParams.push(habitaciones)
                            }

                            query += " ORDER BY i.created_at DESC LIMIT 10"

                            console.log("[v0] Final SQL query:", query)
                            console.log("[v0] Query parameters:", queryParams)

                            const [rows] = await connection.execute(query, queryParams)

                            console.log("[v0] Query returned rows:", Array.isArray(rows) ? rows.length : 0)

                            if (Array.isArray(rows) && rows.length > 0) {
                              const propertiesToSend = rows.map((row: any) => ({
                                id: row.id,
                                title: row.title,
                                location: row.location,
                                price:
                                  operacion === "compra" || operacion === "comprar"
                                    ? row.purchase_price
                                    : row.rental_price,
                                bedrooms: row.bedrooms,
                                bathrooms: row.bathrooms,
                                area: row.area,
                                property_type: row.property_type,
                                image_url: row.image_url,
                              }))

                              console.log("[v0] Sending properties to frontend:", propertiesToSend.length)

                              const propertiesData = JSON.stringify({
                                type: "properties",
                                properties: propertiesToSend,
                              })
                              controller.enqueue(encoder.encode(`${propertiesData}\n`))

                              const successMsg = JSON.stringify({
                                type: "text",
                                content: `\n\nEncontré ${rows.length} ${rows.length === 1 ? "propiedad" : "propiedades"} que ${rows.length === 1 ? "coincide" : "coinciden"} con tu búsqueda. ¿Te gustaría ver los detalles de alguna?`,
                              })
                              controller.enqueue(encoder.encode(`${successMsg}\n`))
                            } else {
                              console.log("[v0] No properties found with exact criteria, searching alternatives")

                              let altQuery = `
                                SELECT DISTINCT 
                                  i.location,
                                  COUNT(*) as count,
                                  ${operacion === "compra" || operacion === "comprar" ? "MIN(i.purchase_price)" : "MIN(i.rental_price)"} as min_price,
                                  ${operacion === "compra" || operacion === "comprar" ? "MAX(i.purchase_price)" : "MAX(i.rental_price)"} as max_price
                                FROM inmueble i 
                                WHERE i.status = 'disponible'
                              `
                              const altParams: any[] = []

                              if (operacion === "compra" || operacion === "comprar") {
                                altQuery += " AND (i.operation_type = 'compra' OR i.operation_type = 'ambos')"
                                altQuery += " AND i.purchase_price IS NOT NULL"
                                if (precioMax) {
                                  altQuery += " AND i.purchase_price <= ?"
                                  altParams.push(precioMax * 1.3)
                                }
                              } else {
                                altQuery += " AND (i.operation_type = 'alquiler' OR i.operation_type = 'ambos')"
                                altQuery += " AND i.rental_price IS NOT NULL"
                                if (precioMax) {
                                  altQuery += " AND i.rental_price <= ?"
                                  altParams.push(precioMax * 1.3)
                                }
                              }

                              if (params.tipo) {
                                const tipo = params.tipo.toLowerCase()
                                altQuery += " AND LOWER(i.property_type) LIKE ?"
                                altParams.push(`%${tipo}%`)
                              }

                              altQuery += " GROUP BY i.location HAVING count >= 1 ORDER BY count DESC LIMIT 5"

                              console.log("[v0] Alternative locations query:", altQuery)
                              console.log("[v0] Alternative locations params:", altParams)

                              const [altRows] = await connection.execute(altQuery, altParams)

                              let suggestionMsg = `No encontré ${params.tipo || "propiedades"} disponibles para ${operacion} en ${params.ubicacion}`
                              if (precioMax) {
                                suggestionMsg += ` con presupuesto de $${precioMax}`
                              }
                              if (params.habitaciones) {
                                suggestionMsg += ` con ${params.habitaciones} habitaciones`
                              }
                              suggestionMsg += "."

                              if (Array.isArray(altRows) && altRows.length > 0) {
                                suggestionMsg += "\n\nTenemos opciones similares en:"
                                altRows.forEach((row: any, index: number) => {
                                  suggestionMsg += `\n${index + 1}. ${row.location}: ${row.count} ${row.count === 1 ? "propiedad" : "propiedades"} desde $${row.min_price}`
                                })
                                suggestionMsg += "\n\n¿Te interesa alguna de estas zonas?"
                              } else {
                                suggestionMsg += "\n\n¿Quieres buscar con un presupuesto diferente o en otra zona?"
                              }

                              const noResultsMsg = JSON.stringify({
                                type: "text",
                                content: suggestionMsg,
                              })
                              controller.enqueue(encoder.encode(`${noResultsMsg}\n`))
                            }

                            await connection.end()
                          } catch (dbError) {
                            console.error("[v0] Database connection or query error:", dbError)
                            const errorMsg = JSON.stringify({
                              type: "text",
                              content:
                                "\n\nDisculpa, tuve un problema conectando con la base de datos. Por favor intenta de nuevo en un momento.",
                            })
                            controller.enqueue(encoder.encode(`${errorMsg}\n`))
                          }
                        } else {
                          console.log("[v0] Missing required search parameters:", params)
                          const missingMsg = JSON.stringify({
                            type: "text",
                            content:
                              "\n\nNecesito más información para buscar. ¿Podrías decirme la operación (compra/alquiler), ubicación y presupuesto?",
                          })
                          controller.enqueue(encoder.encode(`${missingMsg}\n`))
                        }
                      }
                    }
                  }
                } catch (e) {
                  console.error("[v0] Parse error:", e)
                }
              }
            }
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
    console.error("[v0] Error in chat API:", error)

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
