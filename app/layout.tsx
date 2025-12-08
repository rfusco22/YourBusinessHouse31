import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { ChatbotWrapper } from "@/components/chatbot-wrapper"
import { Providers } from "./providers"

export const metadata: Metadata = {
  title: "Your Business House - Agencia Inmobiliaria Premium",
  description: "Descubre propiedades de lujo cuidadosamente seleccionadas. Tu hogar perfecto te espera.",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/logo.png",
        type: "image/png",
        sizes: "any",
      },
    ],
    apple: {
      url: "/logo.png",
      type: "image/png",
    },
    shortcut: "/logo.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <Providers>
          {children}
          <ChatbotWrapper />
        </Providers>
      </body>
    </html>
  )
}
