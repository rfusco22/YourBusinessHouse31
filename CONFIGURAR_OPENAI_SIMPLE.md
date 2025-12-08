# Configuración de OpenAI para el Chatbot Hogarcito

## Paso 1: Obtener API Key de OpenAI

1. Ve a [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Inicia sesión o crea una cuenta
3. Haz clic en "Create new secret key"
4. Copia la clave (comienza con `sk-...`)
5. **IMPORTANTE**: Guarda esta clave en un lugar seguro, solo se muestra una vez

## Paso 2: Configurar la Variable de Entorno

### En cPanel:

1. Ve al administrador de archivos de cPanel
2. Busca el archivo `.env` o `.env.local` en la raíz de tu proyecto
3. Agrega esta línea:
   \`\`\`
   OPENAI_API_KEY=tu-clave-aqui
   \`\`\`
4. Guarda el archivo
5. Reinicia tu aplicación Node.js desde el panel de cPanel

### En Vercel:

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Agrega:
   - Name: `OPENAI_API_KEY`
   - Value: tu clave de OpenAI
4. Haz clic en "Save"
5. Redeploya tu proyecto

### En Railway:

1. Ve a tu proyecto en Railway
2. Variables tab
3. Agrega:
   - `OPENAI_API_KEY` = tu clave de OpenAI
4. Railway reiniciará automáticamente

## Paso 3: Verificar que Funcione

1. Abre el chatbot en tu sitio web
2. Escribe "Hola"
3. Deberías recibir una respuesta del asistente Hogarcito

## Costo de OpenAI

- **GPT-3.5-turbo**: ~$0.002 por 1,000 tokens (muy económico)
- Un mensaje típico usa ~100-200 tokens
- 1,000 mensajes = aprox $0.40 USD

## Solución de Problemas

Si el chatbot sigue sin funcionar:

1. Verifica que la API key sea correcta (empieza con `sk-`)
2. Asegúrate de que la variable se llame exactamente `OPENAI_API_KEY`
3. Reinicia tu servidor/aplicación después de agregar la variable
4. Revisa que tengas créditos en tu cuenta de OpenAI
5. Verifica la consola del navegador (F12) para ver errores específicos

## Alternativa Gratuita: Groq

Si prefieres una opción gratuita, puedes usar Groq en lugar de OpenAI. Lee el archivo `CONFIGURAR_CHATBOT_OPENAI.md` para más detalles.
