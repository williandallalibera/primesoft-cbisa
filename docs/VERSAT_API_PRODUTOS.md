# Verificação das APIs VERSAT – Produtos e Insumos (BP51, BP71, RP21, RP71)

Resumo do que foi testado em **06/03/2026** com `empresa_id=458` (Basic Auth: kauang / testeteste).

---

## Diferença BP* vs RP*

Na documentação aparecem duas famílias de recursos para produtos/insumos:

| Prefixo | Recursos testados | Descrição (doc) |
|--------|-------------------|------------------|
| **BP** | BP51 = Insumos agrícolas (listagem), BP71 = ? | Mesmo endpoint Polling/Data, nomenclatura "BP" |
| **RP** | RP21 = Insumos agrícolas, RP21+detalle = Listar detalles, RP71 = Lista de precios | Nomenclatura "RP" (possível outro módulo ou vista) |

**Nos testes com empresa_id=458:**

- **BP51** retorna dados (centenas de registros com custos, descrição, marca, etc.).
- **BP71**, **RP21** e **RP71** retornam **array vazio `[]`** para 458.
- Com **empresa_id=581**: RP21 e RP71 respondem com erro de assinatura (*"no posee un plan con acceso a la API"*), então não foi possível ver o formato dos dados de RP*.

**Hipótese:** BP e RP podem ser dois conjuntos de recursos (ex.: módulo “Productos” vs “Insumos/Recursos”), ou a empresa 458 só tem dados populados no recurso BP51. A **RP71 (lista de precios)** é a candidata natural para preço mínimo / preço final quando houver dados ou plano com acesso.

---

## 1. BP51 (listagem, sem detalle)

**URL:** `GET https://app.versat.ag/api/Polling/Data?recurso=BP51&empresa_id=458`  
**Resposta:** 200, array de insumos/productos.

**Formato da resposta com paginação:** objeto `{ TotalItems, ItemsPerPage, ActualPage, TotalPages, Items: [ ... ] }`. Sin paginación a veces devuelve array directo.

**Campos retornados por BP51 / RP21 (catálogo) – lista completa:**

| Campo | Tipo | Uso en Primesoft |
|-------|------|-------------------|
| `id` | number | `id_versat`, SKU `VERSAT-{id}` |
| `Empresa_id` | number | — |
| `Descripcion_hd_cb` | text | nombre (fallback) |
| `Nombre_comercial_txt` | text | nombre |
| `Presentacion_txt` | text | presentacion_txt (texto), contenido_empaque (número extraído), id_unidad_medida (ver variantes abajo) |
| `Fase_cultivo_txt` | text | culturas (array: soja, maiz, trigo por coincidencia). Si viene vacío, se asignan las tres culturas (uso general). |
| `Principio_activo_txt` | text | — |
| `Marca_txt` | text | fabricante |
| `Linea_txt` | text | — |
| `Empresa_txt` | text | — |
| `Voa_class` | text | — |
| `Producto_status` | text | estado (activo/inactivo) |
| `Lotes_sn` | text | — |
| `Cod_ean` | text | — |
| **Custos** | | |
| `Costo_contable_ro` | number | — |
| `Costo_compra_ro` | number | precio_compra, fallback precio_venta/final |
| `Costo_gerencial_ro` | number | fallback precio_venta/final |
| **IDs** | | |
| `Nombre_comercial_id`, `Presentacion_id`, `Principio_activo_id` | number | — |
| `Proveedor_id`, `Importador_id`, `Fabricante_id` | number | — |
| `Linea_id`, `Marca_id`, `Fase_cultivo_id`, `Localizacion_stock_id` | number | — |
| **Textos** | | |
| `Proveedor_txt`, `Entidad_fabricante_txt`, `Entidad_importador_txt` | text | — |
| `Localizacion_stock_txt`, `Fase_cultivo_txt` | text | — |
| `Caracteristicas`, `Recomendaciones`, `Beneficios`, `Naturaleza`, `Clave_integracion_hd` | text | — |
| `Aplicacion_dosis`, `Dosis`, `Nivel_tecno` | text | — |

**BP51 no trae:** preço mínimo, preço final, preço de venda (solo custos). Eso viene de BP71/RP71.

**Variantes de unidad (Presentacion_txt → id_unidad_medida):** Se reconoce L, Litro(s), KG, Kilogramo(s), ML, Mililitro(s), G, Gramo(s), Bolsa(s), Unidad(es). Estas últimas se mapean a código UN (Unidad). Códigos en Primesoft: L, KG, ML, G, UN.

**Cultura por defecto:** Si VERSAT no envía Fase_cultivo_txt o no coincide con soja/maiz/trigo, el producto se asigna a las tres culturas (soja, maíz, trigo) para que aparezca en Siembra y Aplicación en cualquier zafra. En Monitoreo, los productos con `culturas` vacío también se consideran "para todas las culturas" y se muestran en los filtros.

**Atributos críticos para cálculos y lançamentos:** contenido_empaque, precio_venta/precio_final, culturas, id_unidad_medida. Propuestas y Monitoreo (Siembra, Aplicación, RTE) dependen de ellos; cualquier edición manual de productos VERSAT debe respetar estos campos.

**BP71 / RP71 (lista de precios)** – campos esperados:

| Campo | Tipo | Uso |
|-------|------|-----|
| `Producto_id` | number | vincula al `id` de BP51 |
| `P_normal` | number | precio_venta, precio_final |
| `P_minimo` | number | precio_minimo |

---

## 2. BP51 com parâmetro `detalle`

**URLs testadas:**  
`recurso=BP51&empresa_id=458&detalle=1`, `detalle=278091`, `detalle=detalle`, `detalle=Precios`, etc.

**Resultados:**

- `detalle` vazio ou omitido: igual à listagem BP51 (array de productos).
- `detalle=1` ou valor numérico: erro *"La tarea de API GET está en proceso... aguarde algunos instantes!"* (chamada assíncrona em processamento).
- Outros valores (`detalle`, `Detalle`, `Precios`, `ListaPrecios`): erro *"No existe una Clase detalle con el nombre 'X' vinculada al recurso 'BP51'. Consulte la documentación (versat.docs.apiary.io)"*.

**Conclusão:** O valor correto de `detalle` para BP51 deve ser um **nome de classe** documentado na Apiary (ex.: lista de vistas/detalhes). Sem a doc aberta não foi possível descobrir o nome exato. Pode ser que uma dessas classes traga preços (mínimo/final).

---

## 3. BP71

**URL:** `GET https://app.versat.ag/api/Polling/Data?recurso=BP71&empresa_id=458`  
**Resposta:** 200 com corpo `[]` (array vazio).

Com `empresa_id=581`: erro de assinatura – *"La suscripción ... no posee un plan con acceso a la API"*.

**Conclusão:** BP71 é um recurso válido (a API responde), mas para empresa 458 não há registros retornados; para 581 o plano da empresa não inclui acesso à API. O significado do recurso BP71 (ex.: preços, listas de preço, outro catálogo) deve ser conferido na documentação VERSAT.

---

## 4. RP21 – Insumos agrícolas (listagem)

**URL:** `GET https://app.versat.ag/api/Polling/Data?recurso=RP21&empresa_id=458`  
**Resposta:** 200 com corpo `[]`. Com empresa 581: erro de assinatura. RP21 é análogo ao BP51 na doc; para 458 não há registros.

## 5. RP21 + detalle – Listar detalles

Testado `detalle=Detalle`: erro "No existe una Clase detalle... vinculada al recurso 'RP21'". Nome da clase na Apiary.

## 6. RP71 – Lista de precios

**URL:** `GET .../recurso=RP71&empresa_id=458`  
**Resposta:** 200 com `[]`. Com 581: erro de assinatura. RP71 = lista de precios (candidata para precio mínimo/final quando houver dados).

---

## Resumo para integração

| API | Descrição (doc) | empresa_id=458 | Preço mín./final |
|-----|------------------|----------------|------------------|
| **BP51** (sem detalle) | Insumos agrícolas | OK – catálogo | Não |
| BP51 (com detalle=?) | Detalle BP51 | Nome clase Apiary “classe detalle” | A confirmar |
| **BP71** | ? | `[]` | A confirmar |
| **RP21** | Insumos agrícolas | `[]` | A confirmar |
| RP21 + detalle | Listar detalles | Nome clase Apiary | A confirmar |
| **RP71** | Lista de precios | `[]` | Candidata principal |

**Recomendações:** (1) Usar **BP51** para sync (única com dados para 458). (2) Apiary: consultar clases detalle de BP51 e RP21. (3) VERSAT: confirmar diferença BP vs RP; acesso a RP71 (lista de precios) para preço mín./final.
