import { query } from "@/lib/db"

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
3. Pregunta: "¿Cuál es tu presupuesto máximo?" (solo un número)
4. Si no mencionó el tipo: "¿Qué tipo de inmueble? (casa, apartamento, local, terreno)"
5. Si no mencionó habitaciones para apartamento/casa: "¿Cuántas habitaciones necesitas?"

IMPORTANTE: 
- El presupuesto que dice el usuario es el precio_max
- NO inventes precio_min

Cuando tengas operación + ubicación + presupuesto + tipo, usa este formato EXACTO:

[BUSCAR_PROPIEDADES]operacion:alquiler|ubicacion:prebo|precio_max:1000|tipo:apartamento|habitaciones:4[/BUSCAR_PROPIEDADES]

REGLAS:
- Respuestas cortas (máximo 2 líneas)
- UNA pregunta a la vez
- Después de [BUSCAR_PROPIEDADES]...[/BUSCAR_PROPIEDADES] NO escribas nada más
- NO menciones WhatsApp

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
      console.error("[v0] OpenAI API error:", errorData)
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
                  }
                } catch (e) {
                  // Skip parse errors
                }
              }
            }
          }

          console.log("[v0] Full GPT response:", fullResponse)

          const searchMatch = fullResponse.match(/\[BUSCAR_PROPIEDADES\]([\s\S]*?)\[\/BUSCAR_PROPIEDADES\]/i)

          if (searchMatch && !hasSearched) {
            hasSearched = true
            const searchContent = searchMatch[1].trim()
            console.log("[v0] Search content found:", searchContent)

            // Send searching message
            const searchingMsg = JSON.stringify({
              type: "text",
              content: "Buscando opciones disponibles...\n\n",
            })
            controller.enqueue(encoder.encode(`${searchingMsg}\n`))

            // Parse parameters
            const params: Record<string, string> = {}
            const paramParts = searchContent.split("|")

            for (const part of paramParts) {
              const colonIndex = part.indexOf(":")
              if (colonIndex > -1) {
                const key = part.substring(0, colonIndex).trim().toLowerCase()
                const value = part.substring(colonIndex + 1).trim()
                if (key && value) {
                  params[key] = value
                }
              }
            }

            console.log("[v0] Parsed params:", JSON.stringify(params))

            try {
              const operacion = (params.operacion || "alquiler").toLowerCase()
              const ubicacion = (params.ubicacion || "").toLowerCase()
              const precioMax = params.precio_max ? Number.parseInt(params.precio_max) : null
              const tipo = (params.tipo || "").toLowerCase()
              const habitaciones = params.habitaciones ? Number.parseInt(params.habitaciones) : null

              console.log("[v0] Search criteria:", { operacion, ubicacion, precioMax, tipo, habitaciones })

              let sql = `
                SELECT i.id, i.title, i.location, i.bedrooms, i.bathrooms, i.area, i.type,
                       i.rental_price, i.purchase_price, i.operation_type,
                       (SELECT image_url FROM inmueble_images WHERE inmueble_id = i.id ORDER BY display_order LIMIT 1) as image_url
                FROM inmueble i 
                WHERE i.status = 'disponible'
              `
              const queryParams: any[] = []

              // Operation type filter
              if (operacion.includes("compr") || operacion === "compra" || operacion === "venta") {
                sql += ` AND (i.operation_type = 'compra' OR i.operation_type = 'venta' OR i.operation_type = 'ambos')`
              } else {
                sql += ` AND (i.operation_type = 'alquiler' OR i.operation_type = 'ambos')`
              }

              if (ubicacion) {
                sql += ` AND (LOWER(i.location) LIKE ? OR LOWER(i.city) LIKE ? OR LOWER(i.state) LIKE ?)`
                queryParams.push(`%${ubicacion}%`, `%${ubicacion}%`, `%${ubicacion}%`)
              }

              // Price filter based on operation type
              if (precioMax) {
                if (operacion.includes("compr") || operacion === "compra" || operacion === "venta") {
                  sql += ` AND i.purchase_price <= ?`
                } else {
                  sql += ` AND i.rental_price <= ?`
                }
                queryParams.push(precioMax)
              }

              if (tipo) {
                sql += ` AND LOWER(i.type) LIKE ?`
                queryParams.push(`%${tipo}%`)
              }

              // Bedrooms filter - at least this many
              if (habitaciones) {
                sql += ` AND i.bedrooms >= ?`
                queryParams.push(habitaciones)
              }

              sql += ` ORDER BY i.created_at DESC LIMIT 10`

              console.log("[v0] Executing SQL:", sql)
              console.log("[v0] Query params:", queryParams)

              const properties = (await query(sql, queryParams)) as any[]

              console.log("[v0] Found properties:", properties.length)
              if (properties.length > 0) {
                console.log("[v0] First property:", JSON.stringify(properties[0]))
              }

              if (properties.length > 0) {
                // Format properties for display
                const isCompra = operacion.includes("compr") || operacion === "compra" || operacion === "venta"

                const propertiesToSend = properties.map((p: any) => ({
                  id: p.id,
                  title: p.title,
                  location: p.location,
                  price: isCompra ? p.purchase_price : p.rental_price,
                  bedrooms: p.bedrooms,
                  bathrooms: p.bathrooms,
                  area: p.area,
                  type: p.type,
                  image_url: p.image_url,
                }))

                console.log("[v0] Sending properties to client:", propertiesToSend.length)

                // Send properties data
                const propertiesData = JSON.stringify({
                  type: "properties",
                  properties: propertiesToSend,
                })
                controller.enqueue(encoder.encode(`${propertiesData}\n`))

                // Success message
                const successMsg = JSON.stringify({
                  type: "text",
                  content: `Encontre ${properties.length} ${properties.length === 1 ? "propiedad que coincide" : "propiedades que coinciden"} con tu busqueda. Te gustaría mas información de alguna?`,
                })
                controller.enqueue(encoder.encode(`${successMsg}\n`))
              } else {
                console.log("[v0] No properties found, searching alternatives...")

                const isCompra = operacion.includes("compr") || operacion === "compra" || operacion === "venta"

                let altSql = `
                  SELECT 
                    location,
                    COUNT(*) as count,
                    ${isCompra ? "MIN(purchase_price)" : "MIN(rental_price)"} as min_price,
                    ${isCompra ? "MAX(purchase_price)" : "MAX(rental_price)"} as max_price
                  FROM inmueble 
                  WHERE status = 'disponible'
                `
                const altParams: any[] = []

                if (isCompra) {
                  altSql += ` AND (operation_type = 'compra' OR operation_type = 'venta' OR operation_type = 'ambos')`
                  altSql += ` AND purchase_price IS NOT NULL`
                  if (precioMax) {
                    altSql += ` AND purchase_price <= ?`
                    altParams.push(precioMax * 1.5)
                  }
                } else {
                  altSql += ` AND (operation_type = 'alquiler' OR operation_type = 'ambos')`
                  altSql += ` AND rental_price IS NOT NULL`
                  if (precioMax) {
                    altSql += ` AND rental_price <= ?`
                    altParams.push(precioMax * 1.5)
                  }
                }

                if (tipo) {
                  altSql += ` AND LOWER(type) LIKE ?`
                  altParams.push(`%${tipo}%`)
                }

                altSql += ` GROUP BY location HAVING count >= 1 ORDER BY count DESC LIMIT 5`

                const alternatives = (await query(altSql, altParams)) as any[]

                let noResultsMsg = `No encontre ${tipo || "propiedades"} en ${params.ubicacion || "esa zona"}`
                if (precioMax) noResultsMsg += ` hasta $${precioMax.toLocaleString()}`
                if (habitaciones) noResultsMsg += ` con ${habitaciones}+ habitaciones`
                noResultsMsg += "."

                if (alternatives.length > 0) {
                  noResultsMsg += "\n\nPero tengo opciones similares en estas zonas:\n"
                  alternatives.forEach((alt: any, i: number) => {
                    noResultsMsg += `\n${i + 1}. ${alt.location}: ${alt.count} ${alt.count === 1 ? "propiedad" : "propiedades"} desde $${Number(alt.min_price).toLocaleString()}`
                  })
                  noResultsMsg += "\n\nTe interesa alguna de estas zonas?"
                } else {
                  noResultsMsg += "\n\nQuieres intentar con un presupuesto diferente o en otra zona?"
                }

                const notFoundMsg = JSON.stringify({
                  type: "text",
                  content: noResultsMsg,
                })
                controller.enqueue(encoder.encode(`${notFoundMsg}\n`))
              }
            } catch (dbError) {
              console.error("[v0] Database error:", dbError)
              const errorMsg = JSON.stringify({
                type: "text",
                content: "Hubo un problema técnico buscando propiedades. Por favor intenta de nuevo.",
              })
              controller.enqueue(encoder.encode(`${errorMsg}\n`))
            }
          } else {
            const cleanedResponse = fullResponse
              .replace(/\[BUSCAR_PROPIEDADES\][\s\S]*?\[\/BUSCAR_PROPIEDADES\]/gi, "")
              .trim()

            if (cleanedResponse) {
              const data = JSON.stringify({ type: "text", content: cleanedResponse })
              controller.enqueue(encoder.encode(`${data}\n`))
            }
          }

          controller.close()
        } catch (error) {
          console.error("[v0] Stream error:", error)
          const errorMsg = JSON.stringify({
            type: "text",
            content: "Disculpa, tuve un problema. Podrías intentarlo de nuevo?",
          })
          controller.enqueue(encoder.encode(`${errorMsg}\n`))
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
