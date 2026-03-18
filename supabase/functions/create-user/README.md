# create-user

Edge Function que crea un usuario en Auth y en `public.usuarios` **sin cambiar la sesión** del administrador que la invoca. Solo usuarios con `perfil_acceso = 'admin'` pueden llamarla.

## Despliegue

```bash
supabase functions deploy create-user
```

Al invocar desde el front con `supabase.functions.invoke('create-user', { body: { ... } })`, se envía automáticamente el JWT del usuario actual; la función verifica que sea admin antes de crear el nuevo usuario.

## Body esperado

- `email` (string, obligatorio)
- `password` (string, obligatorio)
- `nombre` (string)
- `perfil_acceso` (string: admin | rtv | cliente)
- `ci`, `telefono`, `estado` (opcionales)
