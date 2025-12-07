# Configuración del Chatbot Hogarcito

Hogarcito es tu agente inmobiliario virtual inteligente que automatiza el proceso de búsqueda de propiedades.

## Opción 1: Usar OpenAI (Por defecto - Sin configuración)

El chatbot usa **OpenAI GPT-4o-mini** por defecto, que funciona automáticamente a través del Vercel AI Gateway sin necesidad de configurar una API key.

**No necesitas hacer nada adicional** - el chatbot funcionará inmediatamente después del deploy en Railway.

---

## Opción 2: Cambiar a Google Gemini (Opcional)

Si prefieres usar Google Gemini en lugar de OpenAI, sigue estos pasos:

### 1. Obtener API Key de Google AI Studio

1. Ve a [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Inicia sesión con tu cuenta de Google
3. Haz clic en "Create API Key" o "Get API Key"
4. Copia la API key generada

### 2. Configurar en Railway

1. Ve a tu proyecto en Railway
2. Selecciona tu servicio
3. Ve a la pestaña **Variables**
4. Agrega una nueva variable:
   - **Nombre**: `GOOGLE_GENERATIVE_AI_API_KEY`
   - **Valor**: Tu API key de Google AI Studio
5. Guarda los cambios
6. Railway redesplegará automáticamente tu aplicación

### 3. Verificar

Una vez configurada la variable `GOOGLE_GENERATIVE_AI_API_KEY`, el chatbot automáticamente cambiará a usar **Google Gemini 2.0 Flash Experimental** en lugar de OpenAI.

---

## Modelos Disponibles

- **OpenAI GPT-4o-mini** (Por defecto): Rápido, económico, sin configuración, funciona inmediatamente
- **Google Gemini 2.0 Flash Experimental**: Requiere API key, muy rápido, excelente en español, gratuito durante período experimental

---

## Cómo Funciona el Agente de IA

Una vez en funcionamiento, Hogarcito podrá:

### Conversación Natural
- Hablar como un humano venezolano cercano y profesional
- Entender el contexto y mantener la conversación fluida
- Adaptarse a cambios de intención del usuario

### Filtrado Progresivo
El agente hará preguntas estratégicas una a la vez:

1. **Tipo de operación**: ¿Comprar o alquilar?
2. **Ubicación**: ¿En qué parte de Venezuela?
3. **Presupuesto**: Tope de canon (alquiler) o inversión (compra)
4. **Tipo de propiedad**: Apartamento, casa, local, etc.
5. **Detalles**: Habitaciones, baños, etc.

### Búsqueda Automática
- Ejecuta búsquedas en la base de datos cuando tiene suficiente información
- Refina resultados según los criterios del usuario
- Si el usuario cambia de alquiler a compra, hace nueva búsqueda automáticamente

### Automatización del Proceso
- Presenta propiedades que coinciden con los criterios
- Ofrece agendar citas con asesores
- Proporciona enlaces directos a WhatsApp

### Responde Preguntas Generales
- Información de la empresa
- Redes sociales
- Cobertura de servicio
- Cualquier duda sobre inmobiliaria

---

## Ejemplo de Conversación

\`\`\`
Usuario: Hola, busco un apartamento
Hogarcito: ¡Hola! Con gusto te ayudo a encontrar tu próximo hogar. ¿Estás buscando comprar o alquilar?

Usuario: Alquilar
Hogarcito: Perfecto. ¿En qué parte de Venezuela te gustaría vivir?

Usuario: Valencia, Carabobo
Hogarcito: ¡Excelente elección! ¿Cuál es tu tope de canon mensual?

Usuario: 280
Hogarcito: Entendido, $280 USD. ¿Cuántas habitaciones necesitas?

Usuario: 2 habitaciones
Hogarcito: [Busca automáticamente] He encontrado 3 apartamentos en alquiler en Valencia con 2 habitaciones por hasta $280. [Muestra propiedades] ¿Te gustaría que agende una cita con un asesor para visitarlos?
\`\`\`

---

## Verificar que Funciona

1. Abre el chatbot en tu sitio web (botón flotante en la esquina inferior derecha)
2. Escribe "Hola"
3. Si ves una respuesta personalizada (no un mensaje de error), está funcionando correctamente
4. Prueba escribir "busco alquilar en Valencia" para ver la búsqueda automática

---

## Ventajas de Cada Modelo

### OpenAI GPT-4o-mini (Por defecto)
- Sin configuración necesaria
- Funciona inmediatamente
- Confiable y estable
- Excelente comprensión del español

### Google Gemini 2.0 Flash (Opcional)
- Más rápido en respuestas
- Mejor optimizado para español
- Cuota gratuita más generosa
- Actualmente experimental y gratuito

---

## Costos

- **OpenAI GPT-4o-mini**: Incluido en el plan de Vercel AI Gateway
- **Google Gemini**: Ofrece una cuota gratuita muy generosa, actualmente el modelo Flash Experimental es gratuito

---

## Solución de Problemas

### El chatbot no responde o muestra error "Cannot read properties of undefined"

**Solución:**
1. Asegúrate de que tu proyecto esté desplegado en Vercel o tenga acceso al Vercel AI Gateway
2. Si estás en Railway y el error persiste, necesitas configurar una API key:
   - Para OpenAI: Agrega `OPENAI_API_KEY` en las variables de Railway
   - Para Gemini: Agrega `GOOGLE_GENERATIVE_AI_API_KEY` en las variables de Railway
3. Verifica que la base de datos esté conectada correctamente
4. Revisa los logs de Railway para ver errores específicos

### Respuestas lentas

1. Si usas OpenAI, considera cambiar a Gemini (más rápido)
2. Verifica la conexión de Railway
3. Revisa que no haya problemas de red

### Error de API Key

1. Verifica que la variable de entorno esté configurada correctamente en Railway
2. Para Gemini: Asegúrate de que el API key tenga permisos activos en Google AI Studio
3. Para OpenAI: Verifica que el API key sea válido en platform.openai.com
4. Prueba generar una nueva API key

---

## Cambios Técnicos Recientes

- **Corregido el error "Cannot read properties of undefined (reading 'map')"** que causaba que el chatbot no respondiera
- Eliminado el uso de `convertToModelMessages` que causaba problemas de formato
- Ahora usa directamente los SDKs `@ai-sdk/openai` y `@ai-sdk/google`
- Mejor validación de mensajes antes de procesarlos
- Manejo de errores mejorado para mostrar mensajes útiles al usuario
- Sistema de detección automática de modelo según variables de entorno disponibles
