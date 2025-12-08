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
        url: "/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/favicon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
    apple: {
      url: "/apple-touch-icon.png",
      sizes: "180x180",
      type: "image/png",
    },
    shortcut: "/favicon-32x32.png",
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
