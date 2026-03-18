# agente-ia

Chat con OpenAI usando contexto del banco (clientes activos, propuestas del día, vouchers, evaluaciones). La API key se lee de **Ajustes → Integraciones** (campo OpenAI Secret Key) en la tabla `integraciones`.

## Despliegue

```bash
supabase functions deploy agente-ia
```

## Configuración

1. En el front: **Ajustes** → **Integraciones** → pegar la **OpenAI Secret Key** (sk-...) y guardar.
2. La función lee `api_openai` de la tabla `integraciones` y usa ese valor para llamar a la API de OpenAI.
3. Cada mensaje del usuario se enriquece con datos actuales del sistema (conteos, totales) y se envían a `gpt-4o-mini` para generar la respuesta.

## Uso

El front envía `{ message, chatId, history }`. La función devuelve `{ response }` con el texto del asistente.
