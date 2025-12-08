import { streamText, tool } from "ai"
import { z } from "zod"
import { query } from "@/lib/db"

export const maxDuration = 60

function getAIModel() {
  // Prioridad: Groq (gratis) > OpenAI > AI Gateway de Vercel
  if (process.env.GROQ_API_KEY) {
    return "groq/llama-3.3-70b-versatile"
  } else if (process.env.OPENAI_API_KEY) {
    return "openai/gpt-4o-mini"
  } else {
    // Vercel AI Gateway (requiere despliegue en Vercel)
    return "openai/gpt-4o-mini"
  }
}

export async function POST(request: Request) {
  try {
    console.log("[v0] Chat API called")

    const { messages } = await request.json()
    console.log("[v0] Received messages:", messages?.length || 0)

    if (!messages || !Array.isArray(messages)) {
      throw new Error("Messages array is required")
    }

    const hasApiKey = !!(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.VERCEL)

    if (!hasApiKey) {
      console.error("[v0] ❌ NO API KEY FOUND! Please configure GROQ_API_KEY or OPENAI_API_KEY")
      throw new Error(
        "API key no configurada. Por favor configura GROQ_API_KEY o OPENAI_API_KEY en las variables de entorno.",
      )
    }

    const aiModel = getAIModel()
    console.log("[v0] Using AI model:", aiModel)

    const searchPropertiesTool = tool({
      description:
        "Busca propiedades inmobiliarias en toda Venezuela basándose en los criterios del usuario. Usa esta herramienta cuando tengas suficiente información sobre qué busca el cliente (operación, ubicación o presupuesto).",
      inputSchema: z.object({
        operationType: z.enum(["compra", "alquiler"]).optional().describe("Tipo de operación: compra o alquiler"),
        location: z
          .string()
          .optional()
          .describe(
            "Ubicación deseada en cualquier parte de Venezuela (Valencia, Caracas, Maracaibo, Barquisimeto, ciudad, estado, zona, etc.)",
          ),
        maxPrice: z.number().optional().describe("Precio máximo en USD"),
        minPrice: z.number().optional().describe("Precio mínimo en USD"),
        propertyType: z
          .string()
          .optional()
          .describe("Tipo de propiedad: apartamento, casa, local comercial, oficina, terreno, quinta"),
        bedrooms: z.number().optional().describe("Número mínimo de habitaciones"),
        bathrooms: z.number().optional().describe("Número mínimo de baños"),
      }),
      execute: async ({ operationType, location, maxPrice, minPrice, propertyType, bedrooms, bathrooms }) => {
        console.log("[v0] Executing searchProperties tool with:", {
          operationType,
          location,
          maxPrice,
          minPrice,
          propertyType,
          bedrooms,
          bathrooms,
        })

        let sqlQuery = `
          SELECT i.*, u.name as owner_name, u.phone as owner_phone
          FROM inmueble i 
          LEFT JOIN users u ON i.owner_id = u.id 
          WHERE i.status = 'disponible'
        `
        const params: any[] = []

        if (operationType) {
          if (operationType === "alquiler") {
            sqlQuery += ` AND i.operation_type IN ('alquiler', 'ambos')`
          } else if (operationType === "compra") {
            sqlQuery += ` AND i.operation_type IN ('compra', 'ambos')`
          }
        }

        if (location) {
          const locationTerms = location.split(/[,\s]+/).filter((term) => term.length > 2)
          if (locationTerms.length > 0) {
            sqlQuery += ` AND (`
            const locationConditions = locationTerms.map(() => `i.location LIKE ?`).join(" OR ")
            sqlQuery += locationConditions + `)`
            locationTerms.forEach((term) => params.push(`%${term}%`))
          }
        }

        if (maxPrice) {
          if (operationType === "alquiler") {
            sqlQuery += ` AND i.rental_price <= ?`
          } else if (operationType === "compra") {
            sqlQuery += ` AND i.purchase_price <= ?`
          } else {
            sqlQuery += ` AND (i.rental_price <= ? OR i.purchase_price <= ?)`
            params.push(maxPrice)
          }
          params.push(maxPrice)
        }

        if (minPrice) {
          if (operationType === "alquiler") {
            sqlQuery += ` AND i.rental_price >= ?`
          } else if (operationType === "compra") {
            sqlQuery += ` AND i.purchase_price >= ?`
          } else {
            sqlQuery += ` AND (i.rental_price >= ? OR i.purchase_price >= ?)`
            params.push(minPrice)
          }
          params.push(minPrice)
        }

        if (propertyType) {
          sqlQuery += ` AND i.type = ?`
          params.push(propertyType)
        }

        if (bedrooms) {
          sqlQuery += ` AND i.bedrooms >= ?`
          params.push(bedrooms)
        }

        if (bathrooms) {
          sqlQuery += ` AND i.bathrooms >= ?`
          params.push(bathrooms)
        }

        sqlQuery += ` ORDER BY i.created_at DESC LIMIT 5`

        const properties = (await query(sqlQuery, params)) as any[]
        console.log("[v0] Found properties:", properties.length)

        const propertiesWithImages = await Promise.all(
          properties.map(async (p: any) => {
            const images = (await query(
              `SELECT image_url FROM inmueble_images WHERE inmueble_id = ? ORDER BY display_order ASC LIMIT 1`,
              [p.id],
            )) as any[]

            let displayPrice = p.rental_price || p.purchase_price || p.price
            if (operationType === "alquiler" && p.rental_price) {
              displayPrice = p.rental_price
            } else if (operationType === "compra" && p.purchase_price) {
              displayPrice = p.purchase_price
            }

            return {
              id: p.id,
              title: p.title,
              location: p.location,
              price: displayPrice,
              bedrooms: p.bedrooms,
              bathrooms: p.bathrooms,
              area: p.area,
              type: p.type,
              operation_type: p.operation_type,
              image_url: images.length > 0 ? images[0].image_url : p.image_url,
            }
          }),
        )

        return {
          properties: propertiesWithImages,
          count: propertiesWithImages.length,
        }
      },
    })

    console.log("[v0] Calling AI model via Vercel AI Gateway...")

    const formattedMessages = messages.map((m: any) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content || "",
    }))

    const result = streamText({
      model: aiModel,
      messages: formattedMessages,
      system: `Eres Hogarcito, un asesor inmobiliario profesional, amigable y experto de Your Business House en Venezuela. Tu misión es ayudar a los clientes a encontrar su hogar ideal de manera eficiente y personalizada.

PERSONALIDAD:
- Profesional pero cercano, como un asesor venezolano experimentado
- Empático y atento a las necesidades del cliente
- Eficiente: haces preguntas claras y directas
- Entusiasta sobre las propiedades que ofreces

TU PROCESO DE ASESORÍA (paso a paso):

1. SALUDO Y TIPO DE OPERACIÓN
   - Saluda cordialmente si es el primer mensaje
   - Pregunta: "¿Estás buscando comprar o alquilar una propiedad?"
   - Respuestas válidas: comprar, alquilar, venta, renta, arriendo

2. UBICACIÓN
   - Pregunta: "¿En qué ciudad o zona de Venezuela te gustaría tu nueva propiedad?"
   - Acepta cualquier ciudad/zona: Caracas, Valencia, Maracaibo, Barquisimeto, etc.
   - Si mencionan una zona específica (Naguanagua, San Diego, etc.), tómala en cuenta

3. PRESUPUESTO
   - Para ALQUILER: "¿Cuál es tu presupuesto mensual para el canon de arrendamiento?"
   - Para COMPRA: "¿Cuál es tu presupuesto de compra?"
   - Acepta cantidades en USD (asumir USD si no especifican)
   - Ejemplos: "280", "$500", "1000 dólares"

4. TIPO DE INMUEBLE
   - Pregunta: "¿Qué tipo de inmueble buscas?"
   - Opciones: apartamento, casa, townhouse, local comercial, oficina, terreno, quinta
   - Si no están seguros, ofrece opciones comunes

5. CARACTERÍSTICAS (para residencial)
   - Habitaciones: "¿Cuántas habitaciones necesitas?"
   - Baños: "¿Cuántos baños prefieres?"
   - Área: "¿Tienes preferencia de metros cuadrados?"

6. BÚSQUEDA AUTOMÁTICA
   - EJECUTA searchProperties cuando tengas: operación + ubicación O presupuesto
   - Si encuentras propiedades, descríbelas brevemente y con entusiasmo
   - Menciona las características más atractivas de cada una

7. CIERRE Y SIGUIENTE PASO
   - Después de mostrar resultados: "¿Te gustaría agendar una visita para conocer alguna de estas propiedades?"
   - Ofrece contacto por WhatsApp para coordinar la cita
   - Si no hay resultados, ofrece ampliar los criterios o recibir notificaciones

REGLAS DE COMUNICACIÓN:
- Respuestas cortas y directas (máximo 2-3 líneas)
- UNA pregunta a la vez
- Usa emojis ocasionalmente para ser más cercano (🏠 🔑 ✨)
- Si el cliente cambia de idea (alquiler→compra), ajústate inmediatamente
- Sé proactivo: si detectas que tienen toda la info, busca automáticamente

INFORMACIÓN DE LA EMPRESA:
- Ubicación: CC El Añil, Valencia, Estado Carabobo, Venezuela
- Cobertura: Toda Venezuela
- Servicios: Compra, venta y alquiler en toda Venezuela con asesoría personalizada
- Instagram: @yourbusinesshouse
- WhatsApp: +58 (424) 429-1541
- Email: info@yourbusinesshouse.com

MANEJO DE OTRAS PREGUNTAS:
- Si preguntan sobre financiamiento: "Trabajamos con varias entidades financieras. ¿Te gustaría más información?"
- Si preguntan por servicios: "Ofrecemos compra, venta y alquiler en toda Venezuela con asesoría personalizada"
- Si piden contacto: Ofrece WhatsApp y redes sociales

RECUERDA: Tu objetivo es automatizar el proceso de búsqueda y llevar al cliente a agendar una visita. Sé eficiente, profesional y siempre enfocado en ayudarlos a encontrar su hogar ideal.`,
      tools: {
        searchProperties: searchPropertiesTool,
      },
      maxSteps: 5,
    })

    console.log("[v0] AI model responded, creating stream...")

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log("[v0] Starting to stream text...")
          let textChunks = 0

          for await (const chunk of result.textStream) {
            textChunks++
            console.log(`[v0] Streaming text chunk #${textChunks}:`, chunk.substring(0, 50))
            const data = JSON.stringify({ type: "text", content: chunk })
            controller.enqueue(encoder.encode(`${data}\n`))
          }

          console.log("[v0] Finished streaming text, total chunks:", textChunks)

          const response = await result.response
          if (response.messages && response.messages.length > 0) {
            for (const message of response.messages) {
              if (message.role === "assistant" && message.content) {
                for (const part of message.content) {
                  if (part.type === "tool-call" && part.toolName === "searchProperties") {
                    const toolResultMessage = response.messages.find(
                      (m: any) => m.role === "tool" && m.content?.some((c: any) => c.toolCallId === part.toolCallId),
                    )
                    if (toolResultMessage) {
                      const toolResult = toolResultMessage.content?.find((c: any) => c.toolCallId === part.toolCallId)
                      if (toolResult?.result?.properties) {
                        console.log("[v0] Sending property results:", toolResult.result.properties.length)
                        const data = JSON.stringify({ type: "properties", properties: toolResult.result.properties })
                        controller.enqueue(encoder.encode(`${data}\n`))
                      }
                    }
                  }
                }
              }
            }
          }

          console.log("[v0] Stream complete, closing")
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
    if (error instanceof Error) {
      console.error("[v0] Error name:", error.name)
      console.error("[v0] Error message:", error.message)
      console.error("[v0] Error stack:", error.stack)
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const errorMsg = error instanceof Error ? error.message : "Error desconocido"
        let userMessage = "Disculpa, hubo un problema técnico. Por favor intenta de nuevo en unos segundos."

        if (errorMsg.includes("API key")) {
          userMessage = "El chatbot no está configurado correctamente. Por favor contacta al administrador del sitio."
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
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache",
      },
    })
  }
}
