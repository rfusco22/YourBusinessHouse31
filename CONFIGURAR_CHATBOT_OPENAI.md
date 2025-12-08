# Configuración del Chatbot con OpenAI

El chatbot "Hogarcito" usa OpenAI (GPT-4o-mini) a través del Vercel AI Gateway.

## Opción 1: Usar Vercel AI Gateway (RECOMENDADO - MÁS FÁCIL)

El código ya está configurado para usar el AI Gateway de Vercel, que es GRATIS y no requiere configuración adicional en cPanel.

**¿Qué hacer?**
1. Despliega tu proyecto en Vercel (no en cPanel para esta opción)
2. El AI Gateway de Vercel maneja automáticamente las API keys
3. El chatbot funcionará sin necesidad de configurar nada más

## Opción 2: Usar OpenAI directamente (Para cPanel)

Si despliegas en cPanel, necesitas tu propia API key de OpenAI.

### Paso 1: Obtener API Key de OpenAI

1. Ve a https://platform.openai.com/
2. Crea una cuenta o inicia sesión
3. Ve a https://platform.openai.com/api-keys
4. Haz clic en "Create new secret key"
5. Copia la key (empieza con `sk-...`)
6. **IMPORTANTE**: Guárdala en un lugar seguro, no podrás verla de nuevo

### Paso 2: Agregar créditos a tu cuenta

1. Ve a https://platform.openai.com/settings/organization/billing/overview
2. Agrega un método de pago
3. Compra créditos (mínimo $5 USD)
4. GPT-4o-mini es muy económico: ~$0.15 por cada 1M de tokens de entrada

### Paso 3: Configurar en cPanel

Agrega esta variable de entorno en tu cPanel:

\`\`\`
OPENAI_API_KEY=sk-tu-api-key-aqui
\`\`\`

**En cPanel:**
1. Ve a tu panel de cPanel
2. Busca "Variables de entorno" o edita el archivo `.env`
3. Agrega la línea de arriba con tu API key real

## Opción 3: Usar Groq (GRATIS y RÁPIDO)

Groq es gratis y muy rápido, perfecto para producción.

### Paso 1: Obtener API Key de Groq

1. Ve a https://console.groq.com/
2. Crea una cuenta gratis
3. Ve a https://console.groq.com/keys
4. Crea una nueva API key
5. Copia la key (empieza con `gsk_...`)

### Paso 2: Configurar en cPanel

Agrega esta variable de entorno:

\`\`\`
GROQ_API_KEY=gsk-tu-api-key-aqui
\`\`\`

### Paso 3: Cambiar el modelo en el código

En `app/api/chat/route.ts`, cambia la línea 121:

**DE:**
\`\`\`typescript
model: "openai/gpt-4o-mini",
\`\`\`

**A:**
\`\`\`typescript
model: "groq/llama-3.3-70b-versatile",
\`\`\`

## Verificar que funcione

1. Abre tu sitio web
2. Haz clic en el botón del chatbot
3. Escribe "Hola"
4. Si responde, está funcionando correctamente

## Costos aproximados

- **Vercel AI Gateway**: Gratis (si despliegas en Vercel)
- **OpenAI GPT-4o-mini**: ~$0.15 por 1M tokens entrada, ~$0.60 por 1M tokens salida
  - Un chat típico usa ~1,000 tokens = $0.0015 USD
  - Con $5 USD puedes tener ~3,000 conversaciones
- **Groq**: Completamente GRATIS (con límites generosos)
  - 30 requests por minuto
  - 14,400 tokens por minuto

## Recomendación Final

Para cPanel, usa **Groq** porque:
- Es completamente gratis
- Es muy rápido
- Fácil de configurar
- Llama 3.3 70B es excelente para español

Para Vercel, usa el **AI Gateway** porque:
- No necesitas configurar nada
- Es gratis
- Automático
