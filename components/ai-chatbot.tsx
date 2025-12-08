"use client"
import { useState, useRef, useEffect } from "react"
import type React from "react"
import { Button } from "@/components/ui/button"
import { X, MessageCircle, Send, Loader2 } from "lucide-react"

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  toolInvocations?: any[]
}

export function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "¡Hola! 👋 Soy Hogarcito, tu agente inmobiliario. Estoy aquí para ayudarte a encontrar tu próximo hogar en cualquier parte de Venezuela. ¿Estás buscando comprar o alquilar?",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [properties, setProperties] = useState<any[]>([])
  const [selectedPropertyForWhatsApp, setSelectedPropertyForWhatsApp] = useState<any>(null)
  const [hasShownQuickReplies, setHasShownQuickReplies] = useState(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!isOpen) return

    const eventSource = new EventSource("/api/events")

    eventSource.addEventListener("property_created", (e) => {
      const data = JSON.parse(e.data)
      console.log("[v0] New property created:", data)
      // Si hay una búsqueda activa, podríamos mostrar una notificación
    })

    return () => {
      eventSource.close()
    }
  }, [isOpen])

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim()) return

    const newUserMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userMessage,
    }

    setMessages((prev) => [...prev, newUserMessage])
    setInput("")
    setIsLoading(true)
    setHasShownQuickReplies(true)

    setProperties([])

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, newUserMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error(`Error del servidor (${response.status})`)
      }

      if (!response.body) {
        throw new Error("No se recibió respuesta del servidor")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ""

      const assistantMessageId = `assistant-${Date.now()}`
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
        },
      ])

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n").filter((line) => line.trim())

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line)

            if (parsed.type === "text" && parsed.content) {
              const cleanContent = parsed.content.replace(
                /\[BUSCAR_PROPIEDADES\][\s\S]*?\[\/BUSCAR_PROPIEDADES\]/gi,
                "",
              )

              if (cleanContent.trim()) {
                accumulatedContent += cleanContent
                setMessages((prev) =>
                  prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, content: accumulatedContent } : msg)),
                )
              }
            } else if (parsed.type === "properties" && Array.isArray(parsed.properties)) {
              setProperties(parsed.properties)
            }
          } catch (e) {
            // Skip unparseable lines
          }
        }
      }

      setIsLoading(false)
    } catch (error) {
      console.error("[v0] Error sending message:", error)

      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `Disculpa, hubo un problema. Por favor intenta de nuevo.`,
        },
      ])
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handlePropertyClick = (propertyId: number) => {
    window.open(`/propiedades/${propertyId}`, "_blank")
  }

  const handleWhatsAppContact = (property?: any) => {
    const propertyToUse = property || selectedPropertyForWhatsApp || properties[0]
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://yourbusinesshouse.com"

    let message = "Hola, me gustaría agendar una visita para ver una propiedad."

    if (propertyToUse) {
      const propertyUrl = `${baseUrl}/propiedades/${propertyToUse.id}`
      message = `Hola, me gustaría agendar una visita para ver la propiedad: ${propertyToUse.title}\n\n${propertyUrl}`
    }

    window.open(`https://wa.me/584244291541?text=${encodeURIComponent(message)}`, "_blank")
  }

  const handleQuickReply = (text: string) => {
    sendMessage(text)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-primary via-accent to-primary text-primary-foreground shadow-2xl hover:shadow-primary/50 transition-all duration-300 hover:scale-110 active:scale-95 group overflow-hidden"
        aria-label="Abrir chatbot"
      >
        <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="absolute inset-2 rounded-full border-2 border-primary-foreground/30 animate-pulse group-hover:border-primary-foreground/50"></div>
        <div className="relative z-10 transition-transform duration-300 group-hover:scale-110">
          {isOpen ? <X className="w-7 h-7" /> : <MessageCircle className="w-7 h-7" />}
        </div>
      </button>

      {isOpen && (
        <div className="fixed bottom-16 sm:bottom-24 right-4 sm:right-6 z-40 w-[calc(100vw-2rem)] sm:w-[calc(100vw-3rem)] lg:w-[420px] max-w-[calc(100vw-2rem)] h-[70vh] sm:h-[60vh] lg:h-[600px] max-h-[600px] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-400 bg-background">
          <div className="relative bg-gradient-to-r from-primary via-accent to-primary p-3 sm:p-5 overflow-hidden">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-2 left-2 w-20 h-20 bg-white/10 rounded-full blur-xl animate-pulse"></div>
              <div
                className="absolute bottom-2 right-2 w-16 h-16 bg-accent/20 rounded-full blur-lg animate-pulse"
                style={{ animationDelay: "1s" }}
              ></div>
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/90 flex items-center justify-center text-xl sm:text-2xl shadow-md flex-shrink-0">
                  🏠
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-primary-foreground font-heading truncate">
                    Hogarcito
                  </h3>
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <span className="inline-block w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-300 animate-pulse flex-shrink-0"></span>
                    <p className="text-xs text-primary-foreground/90 whitespace-nowrap">En línea</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-primary-foreground/85 line-clamp-2">
                Tu Agente Inmobiliario
              </p>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-3 right-3 sm:top-5 sm:right-5 z-20 text-primary-foreground/80 hover:text-primary-foreground transition-colors p-1 hover:bg-white/20 rounded-full"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5 sm:w-5 sm:h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3 bg-gradient-to-b from-background via-background to-accent/5 scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent">
            {messages.map((msg, idx) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-2xl rounded-br-sm shadow-lg"
                      : "bg-card text-foreground border border-border/50 rounded-2xl rounded-bl-sm shadow-sm"
                  } px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm`}
                >
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>

                  {idx === 0 && msg.role === "assistant" && !hasShownQuickReplies && (
                    <div className="flex gap-2 mt-2 sm:mt-3 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 text-xs sm:text-sm py-1 sm:py-2"
                        onClick={() => handleQuickReply("alquilar")}
                      >
                        alquilar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 text-xs sm:text-sm py-1 sm:py-2"
                        onClick={() => handleQuickReply("comprar")}
                      >
                        comprar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {properties.length > 0 && (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {properties.map((property: any) => (
                  <div
                    key={property.id}
                    className="bg-card rounded-lg p-3 border border-border/50 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <p className="font-semibold text-xs sm:text-sm mb-1 line-clamp-2">{property.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{property.location}</p>
                    <p className="text-sm sm:text-base font-bold text-primary mt-1">
                      ${Number(property.price).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      {property.bedrooms} hab • {property.bathrooms} baños • {property.area}m²
                    </p>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handlePropertyClick(property.id)}
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs bg-primary/5 hover:bg-primary/10 border-primary/20"
                      >
                        Ver detalles
                      </Button>
                      <Button
                        onClick={() => handleWhatsAppContact(property)}
                        size="sm"
                        className="bg-[#25D366] hover:bg-[#20BA5A] text-white text-xs"
                      >
                        <WhatsAppIcon />
                      </Button>
                    </div>
                  </div>
                ))}

                <Button
                  onClick={() => handleWhatsAppContact()}
                  className="w-full mt-2 bg-[#25D366] hover:bg-[#20BA5A] text-white text-xs sm:text-sm py-2 sm:py-2.5"
                  size="sm"
                >
                  <WhatsAppIcon />
                  <span className="ml-2">Agendar visita por WhatsApp</span>
                </Button>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-card border border-border/50 rounded-2xl rounded-bl-sm shadow-sm">
                  <div
                    className="w-2.5 h-2.5 rounded-full bg-primary/60 animate-bounce"
                    style={{ animationDelay: "0s" }}
                  ></div>
                  <div
                    className="w-2.5 h-2.5 rounded-full bg-primary/60 animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="w-2.5 h-2.5 rounded-full bg-primary/60 animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="flex-shrink-0 border-t border-border/30 p-2 sm:p-3 bg-background/95 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="flex gap-2 items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu mensaje..."
                disabled={isLoading}
                className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm rounded-full bg-white dark:bg-slate-800 border border-primary/20 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-foreground/40 disabled:opacity-50"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isLoading}
                className="px-2 sm:px-3 py-2 sm:py-2.5 h-auto bg-gradient-to-r from-primary to-accent hover:shadow-lg transition-all rounded-full flex items-center justify-center gap-1 sm:gap-2 flex-shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="w-3 sm:w-4 h-3 sm:h-4 animate-spin" />
                ) : (
                  <Send className="w-3 sm:w-4 h-3 sm:h-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
