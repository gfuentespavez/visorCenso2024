# Censo 2024 - Documentación Técnica

Dashboard interactivo de visualización de datos del Censo 2024 (INE Chile) para la región del Gran Concepción. Permite explorar datos demográficos, socioeconómicos y de vivienda a nivel de manzanas censales.

## Stack Tecnológico

| Tecnología | Versión | Uso |
|------------|---------|-----|
| Svelte | 5.45.6 | Framework UI reactivo |
| SvelteKit | 2.49.1 | Framework fullstack |
| Supabase | 2.90.1 | PostgreSQL + PostGIS |
| Mapbox GL | 3.17.0 | Mapas interactivos |
| Turf.js | 7.3.1 | Análisis geoespacial |

---

## Estructura de Archivos Clave

```
censo2024/
├── src/
│   ├── app.html                    # Template HTML principal
│   ├── routes/
│   │   ├── +layout.svelte          # Layout raíz
│   │   └── +page.svelte            # Página principal del dashboard
│   └── lib/
│       ├── supabaseClient.js       # Cliente Supabase
│       ├── index.js                # Exports de librería
│       ├── assets/icons/           # 35+ iconos SVG temáticos
│       ├── components/
│       │   ├── DemographicsMap.svelte      # Mapa Mapbox (~923 líneas)
│       │   ├── DemographicsSidebar.svelte  # Sidebar de estadísticas (~1166 líneas)
│       │   ├── HeatmapControls.svelte      # Controles de heatmap (~418 líneas)
│       │   └── DemographicsControls.svelte # Controles legacy (~166 líneas)
│       ├── services/
│       │   └── manzanasService.js  # Consultas a Supabase
│       └── stores/
│           └── lensStore.js        # Estado global Svelte
├── static/                         # Assets estáticos
├── .env                            # Variables de entorno
├── vite.config.js                  # Configuración Vite
├── svelte.config.js                # Configuración SvelteKit
└── package.json                    # Dependencias
```

---

## Cliente Supabase

**Archivo:** `/src/lib/supabaseClient.js`

```javascript
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)
```

---

## Servicio de Manzanas

**Archivo:** `/src/lib/services/manzanasService.js`

### Funciones Disponibles

| Función | Descripción | Patrón Supabase |
|---------|-------------|-----------------|
| `fetchAllManzanas()` | Obtiene todas las manzanas con paginación | `.from().select('*').range()` |
| `fetchManzanasInBounds(bounds)` | Consulta espacial por bounding box | `.rpc('get_manzanas_in_bounds', {...})` |
| `fetchManzanasByComuna(nombre)` | Filtra por comuna | `.from().select('*').eq('comuna', nombre)` |
| `fetchGranConcepcionManzanas()` | Filtra múltiples comunas | `.from().select('*').in('comuna', [...])` |
| `getComunasList()` | Lista de comunas únicas | `.from().select('comuna').order()` |
| `getComunaStats(comuna)` | Estadísticas agregadas | `.from().select('campos').eq()` + reduce |
| `convertToGeoJSON(rows)` | Convierte a GeoJSON | Transformación local |

### Ejemplos de Uso

```javascript
import { fetchAllManzanas, fetchManzanasByComuna } from '$lib/services/manzanasService.js';

// Cargar todas las manzanas
const geojson = await fetchAllManzanas();

// Filtrar por comuna
const concepcion = await fetchManzanasByComuna('CONCEPCIÓN');
```

---

## Stores (Estado Global)

**Archivo:** `/src/lib/stores/lensStore.js`

### Stores Writable (Estado Mutable)

| Store | Tipo | Descripción |
|-------|------|-------------|
| `lensCenter` | `{lng, lat}` | Coordenadas del lente |
| `lensRadius` | `number` | Radio en km (default 0.5) |
| `isLensActive` | `boolean` | Si el lente está visible |
| `isDragging` | `boolean` | Estado de arrastre |
| `selectedFeatures` | `array` | Manzanas seleccionadas |
| `visualizationMode` | `'lens' \| 'heatmap'` | Modo de visualización |
| `activeHeatmapVariable` | `object \| null` | Variable temática activa |
| `selectedRadiusRing` | `number \| null` | Anillo seleccionado (500, 1000, 3000m) |
| `activeTopic` | `string` | Categoría del sidebar |
| `showParcels` | `boolean` | Visibilidad de parcelas |
| `showDensity` | `boolean` | Overlay de densidad |

### Stores Derived (Calculados Automáticamente)

| Store | Datos | Campos Usados |
|-------|-------|---------------|
| `totalPopulation` | Población total | `n_per` |
| `genderBreakdown` | Género con % | `n_hombres`, `n_mujeres` |
| `ageGroupsData` | 7 grupos etarios | `n_edad_0_5` ... `n_edad_60_mas` |
| `employmentData` | Empleo con % | `n_ocupado`, `n_desocupado`, `n_fuera_fuerza_trabajo` |
| `literacyData` | Alfabetización | `n_analfabet`, `n_per` |
| `housingData` | Tipos de vivienda | `n_tipo_viv_*`, `n_vp_*` |
| `avgAge` | Edad promedio | `prom_edad` |
| `householdData` | Composición hogares | `n_hog_*`, `n_jefatura_mujer` |

### Ejemplo de Uso

```javascript
import { selectedFeatures, totalPopulation, genderBreakdown } from '$lib/stores/lensStore.js';

// Suscribirse a cambios
totalPopulation.subscribe(value => {
    console.log('Población:', value);
});

// En componente Svelte
$: console.log($genderBreakdown.malePercent);
```

---

## Esquema de Base de Datos

### Tabla: `manzanas`

#### Geometría e Identificación
```sql
geom              -- PostGIS geometry (polygon)
comuna            -- VARCHAR - Nombre de comuna
```

#### Demografía Básica
```sql
n_per             -- INT - Población total
n_hombres         -- INT - Hombres
n_mujeres         -- INT - Mujeres
prom_edad         -- FLOAT - Edad promedio
```

#### Grupos de Edad
```sql
n_edad_0_5        -- INT - 0 a 5 años
n_edad_6_13       -- INT - 6 a 13 años
n_edad_14_17      -- INT - 14 a 17 años
n_edad_18_24      -- INT - 18 a 24 años
n_edad_25_44      -- INT - 25 a 44 años
n_edad_45_59      -- INT - 45 a 59 años
n_edad_60_mas     -- INT - 60 años y más
```

#### Empleo
```sql
n_ocupado                -- INT - Ocupados
n_desocupado             -- INT - Desocupados
n_fuera_fuerza_trabajo   -- INT - Fuera de fuerza laboral
```

#### Vivienda
```sql
n_vp                     -- INT - Total viviendas particulares
n_vp_ocupada             -- INT - Viviendas ocupadas
n_vp_desocupada          -- INT - Viviendas desocupadas
n_tipo_viv_casa          -- INT - Casas
n_tipo_viv_depto         -- INT - Departamentos
n_tipo_viv_mediagua      -- INT - Mediaguas
n_tipo_viv_otro          -- INT - Otro tipo
n_viv_hacinadas          -- INT - Viviendas hacinadas
```

#### Tenencia
```sql
n_tenencia_propia_pagada        -- INT - Propia pagada
n_tenencia_propia_pagandose     -- INT - Propia pagándose
n_tenencia_arrendada_contrato   -- INT - Arrendada con contrato
n_tenencia_cedida_familiar      -- INT - Cedida por familiar
```

#### Hogares
```sql
n_hog                    -- INT - Total hogares
n_hog_unipersonales      -- INT - Hogares unipersonales
n_hog_menores            -- INT - Hogares con menores
n_hog_60                 -- INT - Hogares con adultos mayores
n_jefatura_mujer         -- INT - Hogares con jefatura femenina
```

#### Transporte
```sql
n_transporte_auto        -- INT - Automóvil particular
n_transporte_publico     -- INT - Transporte público
n_transporte_camina      -- INT - Caminata
n_transporte_bicicleta   -- INT - Bicicleta
n_transporte_motocicleta -- INT - Motocicleta
```

#### Conectividad
```sql
n_internet               -- INT - Hogares con internet
n_serv_tel_movil         -- INT - Hogares con teléfono móvil
n_serv_compu             -- INT - Hogares con computador
```

#### Calefacción
```sql
n_comb_calefaccion_lena         -- INT - Calefacción a leña
n_comb_calefaccion_gas          -- INT - Calefacción a gas
n_comb_calefaccion_electricidad -- INT - Calefacción eléctrica
```

#### Identidad y Educación
```sql
n_pueblos_orig           -- INT - Pueblos originarios
n_inmigrantes            -- INT - Inmigrantes
n_analfabet              -- INT - Analfabetos
```

#### Discapacidad
```sql
n_discapacidad           -- INT - Personas con discapacidad
n_dificultad_ver         -- INT - Dificultad para ver
n_dificultad_mover       -- INT - Dificultad para moverse
```

---

## Patrones de Consulta Supabase

### 1. Consulta Básica con Filtro
```javascript
const { data, error } = await supabase
    .from('manzanas')
    .select('*')
    .eq('comuna', 'CONCEPCIÓN');
```

### 2. Consulta con Múltiples Valores (IN)
```javascript
const { data, error } = await supabase
    .from('manzanas')
    .select('*')
    .in('comuna', ['CONCEPCIÓN', 'TALCAHUANO', 'HUALPÉN']);
```

### 3. Paginación (para datasets grandes)
```javascript
let allData = [];
let page = 0;
const pageSize = 1000;
let hasMore = true;

while (hasMore) {
    const { data, error } = await supabase
        .from('manzanas')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;

    allData = allData.concat(data);
    hasMore = data.length === pageSize;
    page++;
}
```

### 4. Consulta RPC (Funciones PostgreSQL/PostGIS)
```javascript
const { data, error } = await supabase
    .rpc('get_manzanas_in_bounds', {
        min_lng: -73.1,
        min_lat: -36.9,
        max_lng: -73.0,
        max_lat: -36.8
    });
```

### 5. Selección de Campos Específicos
```javascript
const { data } = await supabase
    .from('manzanas')
    .select('n_per, n_hombres, n_mujeres, n_vp')
    .eq('comuna', comunaName);
```

### 6. Consulta con Filtros Múltiples
```javascript
const { data } = await supabase
    .from('manzanas')
    .select('*')
    .eq('comuna', 'CONCEPCIÓN')
    .gte('n_per', 100)
    .lte('n_per', 500);
```

### 7. Ordenamiento
```javascript
const { data } = await supabase
    .from('manzanas')
    .select('comuna, n_per')
    .order('n_per', { ascending: false })
    .limit(10);
```

---

## Guía para Escalar el Código

### Agregar Nueva Consulta en manzanasService.js

```javascript
/**
 * Busca manzanas con filtros personalizados
 * @param {Object} filters - Filtros a aplicar
 */
export async function fetchManzanasByFilter(filters) {
    let query = supabase.from('manzanas').select('*');

    if (filters.comuna) {
        query = query.eq('comuna', filters.comuna);
    }
    if (filters.minPopulation) {
        query = query.gte('n_per', filters.minPopulation);
    }
    if (filters.maxPopulation) {
        query = query.lte('n_per', filters.maxPopulation);
    }
    if (filters.hasInternet !== undefined) {
        query = filters.hasInternet
            ? query.gt('n_internet', 0)
            : query.eq('n_internet', 0);
    }

    const { data, error } = await query;
    if (error) throw error;
    return convertToGeoJSON(data);
}
```

### Agregar Nuevo Store Derivado en lensStore.js

```javascript
// Datos de transporte agregados
export const transportData = derived(selectedFeatures, ($features) => {
    const auto = $features.reduce((sum, f) => sum + (f.properties?.n_transporte_auto || 0), 0);
    const publico = $features.reduce((sum, f) => sum + (f.properties?.n_transporte_publico || 0), 0);
    const bicicleta = $features.reduce((sum, f) => sum + (f.properties?.n_transporte_bicicleta || 0), 0);
    const camina = $features.reduce((sum, f) => sum + (f.properties?.n_transporte_camina || 0), 0);
    const moto = $features.reduce((sum, f) => sum + (f.properties?.n_transporte_motocicleta || 0), 0);
    const total = auto + publico + bicicleta + camina + moto;

    return {
        auto,
        publico,
        bicicleta,
        camina,
        moto,
        total,
        autoPercent: total > 0 ? ((auto / total) * 100).toFixed(1) : 0,
        publicoPercent: total > 0 ? ((publico / total) * 100).toFixed(1) : 0,
        // ... más porcentajes
    };
});
```

### Agregar Nueva Variable de Heatmap

```javascript
// En el array heatmapVariables de lensStore.js:
{
    id: 'mi_nueva_variable',
    label: 'Mi Nueva Variable',
    category: 'Mi Categoría',
    field: 'n_campo_en_db',
    icon: miIconoImportado,
    description: 'Descripción de qué muestra esta variable',
    compareFields: null // o array de campos para lógica de dominancia
    // Si es campo calculado:
    // calculated: true,
    // calculateFn: (props) => { return valorCalculado; }
}
```

### Crear Nueva Función RPC en Supabase

```sql
-- Ejemplo: función para obtener manzanas en un radio
CREATE OR REPLACE FUNCTION get_manzanas_in_radius(
    center_lng FLOAT,
    center_lat FLOAT,
    radius_km FLOAT
)
RETURNS SETOF manzanas AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM manzanas
    WHERE ST_DWithin(
        geom::geography,
        ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
        radius_km * 1000
    );
END;
$$ LANGUAGE plpgsql;
```

Uso desde el cliente:
```javascript
const { data, error } = await supabase
    .rpc('get_manzanas_in_radius', {
        center_lng: -73.05,
        center_lat: -36.82,
        radius_km: 2
    });
```

---

## Variables de Entorno

Crear archivo `.env` en la raíz:

```bash
PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoiZ2VybWFuZnVlbnRlcyI...
```

---

## Comunas Disponibles

| Comuna | Región |
|--------|--------|
| CONCEPCIÓN | Gran Concepción |
| TALCAHUANO | Gran Concepción |
| HUALPÉN | Gran Concepción |
| CHIGUAYANTE | Gran Concepción |
| SAN PEDRO DE LA PAZ | Gran Concepción |
| PENCO | Gran Concepción |
| TOMÉ | Gran Concepción |
| CORONEL | Gran Concepción |
| LOTA | Gran Concepción |
| HUALQUI | Provincia Concepción |
| SANTA JUANA | Provincia Concepción |
| FLORIDA | Provincia Concepción |
| YUMBEL | Provincia Biobío |
| CABRERO | Provincia Biobío |

**Total de manzanas:** ~14,511

---

## Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Build de producción
npm run build

# Preview del build
npm run preview

# Formatear código
npm run format

# Lint
npm run lint
```

---

## Componentes Principales

### DemographicsMap.svelte
- Inicializa mapa Mapbox con estilo oscuro
- Crea múltiples capas (parcelas, lente, heatmap, anillos de radio)
- Implementa lente interactivo que sigue el cursor
- Soporta 3 modos de visualización: lens, address, heatmap
- Selección de features con Turf.js (intersección espacial)
- Métodos públicos: `clearLens()`, `clearAddressSearch()`

### DemographicsSidebar.svelte
- Muestra estadísticas de manzanas seleccionadas
- Secciones expandibles: Demografía, Socioeconómico, Vivienda, Transporte, Calefacción
- Gráficos de barras y pirámide de edad
- Pills de temas para cambiar visualización

### HeatmapControls.svelte
- Toggle entre modo Lens y Heatmap
- Panel de 14 variables temáticas agrupadas por categoría
- Leyenda explicativa de la visualización

---

## Licencia

Proyecto privado - City Lab Biobío
