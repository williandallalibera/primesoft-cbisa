# versat-sync-products

Edge Function que sincroniza productos e precios desde VERSAT hacia la tabla `productos`. Después del upsert, opcionalmente aplica un CSV de complemento desde Storage para rellenar categoría, contenido_empaque, culturas y unidad_medida cuando falten.

- **Catálogo:** Prueba BP51 (Insumos); si viene vacío usa RP21 (catálogo CRM). Mismo esquema de campos.
- **Precios:** Usa BP71 y RP71 (lista de precios); se combinan por `Producto_id`.
- **Config:** Lee `integraciones.versat_base_url`, `versat_empresa_id`, `versat_user`, `versat_password`.
- **Upsert:** Por `id_versat`. SKU = `VERSAT-{id}`.
- **Complemento:** Si existe el archivo `productos_complemento.csv` en el bucket Storage `empresa`, se descarga, se hace match por `sku` o `id_versat` y se actualizan solo los campos vacíos (id_categoria, contenido_empaque, id_unidad_medida, culturas). Ver formato abajo.

## CSV complemento (Storage)

- **Ruta:** bucket `empresa`, archivo `productos_complemento.csv`.
- **Encoding:** UTF-8 (con o sin BOM).
- **Separador:** `,` o `;` (se detecta por la primera fila).
- **Cabecera (primera fila):**

| Columna | Uso |
|--------|-----|
| `sku` o `id_versat` | Obligatorio. Match con el producto (ej. `VERSAT-12345` o `12345`). |
| `categoria` | Opcional. Código de categorias_producto (ej. herbicidas, fertilizantes). |
| `contenido_empaque` | Opcional. Número (ej. 1, 20, 5.5). |
| `unidad_medida` | Opcional. Código de unidades_medida: L, KG, ML, G, UN. |
| `culturas` | Opcional. Códigos separados por `;` o `,` (ej. soja;maiz). |

Solo se rellenan campos que en el producto están vacíos. Si el archivo no existe en Storage, la sync sigue sin error y se omite el complemento.

## Despliegue

```bash
supabase functions deploy versat-sync-products
```

## Cron

Ver `supabase/migrations/20260315110000_cron_versat_sync.sql` (2x/día).

## Prueba manual

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/versat-sync-products" \
  -H "Authorization: Bearer <SUPABASE_ANON_OR_SERVICE_ROLE_KEY>"
```
