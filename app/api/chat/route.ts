import {
  convertToModelMessages,
  type InferUITools,
  stepCountIs,
  streamText,
  tool,
  type UIDataTypes,
  type UIMessage,
  validateUIMessages,
} from "ai"
import { z } from "zod"
import mysql from "mysql2/promise"

export const maxDuration = 60

interface Message {
  role: string
  content: string
}

const searchPropertiesTool = tool({
  description:
    "Busca propiedades inmobiliarias en Venezuela cuando el usuario especifica operación (alquiler/compra), ubicación y presupuesto",
  inputSchema: z.object({
    operacion: z.enum(["alquiler", "compra"]).describe("Tipo de operación: alquiler o compra"),
    ubicacion: z.string().describe("Ciudad o zona donde buscar (ej: 'Prebo Valencia', 'Caracas', 'Maracaibo')"),
    precio_min: z.number().optional().describe("Precio mínimo en USD"),
    precio_max: z.number().describe("Precio máximo en USD"),
    tipo: z.string().optional().describe("Tipo de inmueble: apartamento, casa, local, terreno"),
    habitaciones: z.number().optional().describe("Número mínimo de habitaciones"),
  }),
  async *execute({ operacion, ubicacion, precio_min, precio_max, tipo, habitaciones }) {
    yield { state: "loading" as const }

    try {
      const connection = await mysql.createConnection(process.env.DATABASE_URL!)

      let query = `
        SELECT i.*, 
               (SELECT image_url FROM inmueble_images WHERE inmueble_id = i.id LIMIT 1) as image_url
        FROM inmueble i 
        WHERE i.status = 'disponible'
      `
      const params: any[] = []

      // Filtro por operación
      if (operacion === "compra") {
        query += " AND (i.operation_type = 'compra' OR i.operation_type = 'ambos')"
      } else if (operacion === "alquiler") {
        query += " AND (i.operation_type = 'alquiler' OR i.operation_type = 'ambos')"
      }

      // Filtro por ubicación
      query += " AND i.location LIKE ?"
      params.push(`%${ubicacion}%`)

      // Filtro por precio
      if (operacion === "compra") {
        query += " AND i.purchase_price IS NOT NULL AND i.purchase_price <= ?"
        params.push(precio_max)
        if (precio_min) {
          query += " AND i.purchase_price >= ?"
          params.push(precio_min)
        }
      } else {
        query += " AND i.rental_price IS NOT NULL AND i.rental_price <= ?"
        params.push(precio_max)
        if (precio_min) {
          query += " AND i.rental_price >= ?"
          params.push(precio_min)
        }
      }

      // Filtro por tipo
      if (tipo) {
        query += " AND LOWER(i.property_type) LIKE ?"
        params.push(`%${tipo.toLowerCase()}%`)
      }

      // Filtro por habitaciones
      if (habitaciones) {
        query += " AND i.bedrooms >= ?"
        params.push(habitaciones)
      }

      query += " LIMIT 10"

      const [rows] = await connection.execute(query, params)
      await connection.end()

      const properties = Array.isArray(rows)
        ? rows.map((row: any) => ({
            id: row.id,
            title: row.title,
            location: row.location,
            price: operacion === "compra" ? row.purchase_price : row.rental_price,
            bedrooms: row.bedrooms,
            bathrooms: row.bathrooms,
            area: row.area,
            image_url: row.image_url,
          }))
        : []

      yield {
        state: "ready" as const,
        properties,
        count: properties.length,
      }
    } catch (error) {
      console.error("Error buscando propiedades:", error)
      yield {
        state: "error" as const,
        error: "No pude buscar en este momento. Intenta de nuevo.",
      }
    }
  },
})

const tools = {
  searchProperties: searchPropertiesTool,
} as const

export type ChatMessage = UIMessage<never, UIDataTypes, InferUITools<typeof tools>>

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const messages = await validateUIMessages<ChatMessage>({
      messages: body.messages,
      tools,
    })

    const systemMessage = `Eres Hogarcito, un asesor inmobiliario profesional y amigable de Your Business House en Venezuela.

CAPACIDADES:
1. Buscar propiedades en venta y alquiler en toda Venezuela
2. Responder preguntas sobre el proceso de compra/alquiler
3. Dar información de contacto y redes sociales
4. Asistencia general sobre bienes raíces

PROCESO DE BÚSQUEDA DE PROPIEDADES:
1. Pregunta si buscan comprar o alquilar
2. Pregunta en qué ciudad o zona
3. Pregunta el presupuesto (precio máximo)
4. Opcionalmente pregunta tipo de inmueble y número de habitaciones
5. Cuando tengas operación + ubicación + presupuesto máximo, USA LA HERRAMIENTA searchProperties

CONTACTO:
- WhatsApp: +58 (424) 429-1541
- Redes sociales: Menciona que pueden seguirlos en redes (sin especificar URLs)

ESTILO:
- Respuestas cortas y directas (máximo 2-3 líneas)
- Una pregunta a la vez
- Amigable pero profesional
- NO menciones la herramienta ni el proceso técnico al usuario`

    const result = streamText({
      model: "gpt-3.5-turbo",
      system: systemMessage,
      messages: convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(10),
      temperature: 0.7,
      maxOutputTokens: 500,
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("Error en chat API:", error)

    return new Response(
      JSON.stringify({
        error: "Hubo un problema. Por favor intenta de nuevo.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}
