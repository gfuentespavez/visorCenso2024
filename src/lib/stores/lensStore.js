import { writable, derived } from 'svelte/store';

// Import SVG icons
import bikeIcon from '$lib/assets/icons/bike-svgrepo-com.svg';
import busIcon from '$lib/assets/icons/bus-svgrepo-com.svg';
import walkIcon from '$lib/assets/icons/walk-svgrepo-com.svg';
import carIcon from '$lib/assets/icons/car-side-svgrepo-com.svg';
import womanIcon from '$lib/assets/icons/woman-svgrepo-com.svg';
import featherIcon from '$lib/assets/icons/native-american-feather-svgrepo-com.svg';
import worldIcon from '$lib/assets/icons/world-svgrepo-com.svg';
import elderlyIcon from '$lib/assets/icons/elderly-svgrepo-com.svg';
import youngIcon from '$lib/assets/icons/young-man-with-goatbeard-svgrepo-com.svg';
import babyIcon from '$lib/assets/icons/baby-11-svgrepo-com.svg';
import houseMedicalIcon from '$lib/assets/icons/house-medical-xmark-svgrepo-com.svg';
import noWifiIcon from '$lib/assets/icons/no-wifi-svgrepo-com.svg';
import chartDownIcon from '$lib/assets/icons/chart-line-down-svgrepo-com.svg';

// Lens state
export const lensCenter = writable(null); // { lng, lat }
export const lensRadius = writable(0.5); // km
export const isLensActive = writable(false);
export const isDragging = writable(false);
export const drawMode = writable(false); // true = dibujar polígono
export const drawnPolygon = writable(null); // GeoJSON del polígono dibujado

// Selected features within lens
export const selectedFeatures = writable([]);

// Active topic for sidebar visualization
export const activeTopic = writable('population'); // population, age-pyramid, employment, housing, literacy

// NEW: Selected radius ring (null, 500, 1000, 3000 meters)
export const selectedRadiusRing = writable(null);

// NEW: Visualization mode
export const visualizationMode = writable('lens'); // 'lens' or 'heatmap'

// NEW: Active heatmap variable
export const activeHeatmapVariable = writable(null);

// Available topics configuration (matching INE Censo data)
export const topics = [
    { id: 'population', label: 'Población y Género', icon: 'people' },
    { id: 'age-pyramid', label: 'Grupos de Edad', icon: 'chart' },
    { id: 'employment', label: 'Empleo', icon: 'briefcase' },
    { id: 'literacy', label: 'Alfabetización', icon: 'books' },
    { id: 'housing', label: 'Vivienda', icon: 'house' },
    { id: 'households', label: 'Hogares', icon: 'family' }
];

// NEW: Available heatmap variables for thematic visualization
// Each variable includes compareFields: array of related fields to determine dominance
export const heatmapVariables = [
    {
        id: 'transporte_bicicleta',
        label: 'Uso de Bicicleta',
        category: 'Transporte',
        field: 'n_transporte_bicicleta',
        icon: bikeIcon,
        description: 'Manzanas donde la bicicleta es el modo de transporte dominante',
        compareFields: ['n_transporte_bicicleta', 'n_transporte_publico', 'n_transporte_camina', 'n_transporte_auto', 'n_transporte_motocicleta']
    },
    {
        id: 'transporte_publico',
        label: 'Transporte Público',
        category: 'Transporte',
        field: 'n_transporte_publico',
        icon: busIcon,
        description: 'Manzanas donde el transporte público es dominante',
        compareFields: ['n_transporte_bicicleta', 'n_transporte_publico', 'n_transporte_camina', 'n_transporte_auto', 'n_transporte_motocicleta']
    },
    {
        id: 'transporte_camina',
        label: 'Caminata',
        category: 'Transporte',
        field: 'n_transporte_camina',
        icon: walkIcon,
        description: 'Manzanas donde caminar es el modo dominante',
        compareFields: ['n_transporte_bicicleta', 'n_transporte_publico', 'n_transporte_camina', 'n_transporte_auto', 'n_transporte_motocicleta']
    },
    {
        id: 'transporte_auto',
        label: 'Automóvil Particular',
        category: 'Transporte',
        field: 'n_transporte_auto',
        icon: carIcon,
        description: 'Manzanas donde el auto es el modo dominante',
        compareFields: ['n_transporte_bicicleta', 'n_transporte_publico', 'n_transporte_camina', 'n_transporte_auto', 'n_transporte_motocicleta']
    },
    {
        id: 'jefatura_mujer',
        label: 'Jefatura Femenina',
        category: 'Hogares',
        field: 'n_jefatura_mujer',
        icon: womanIcon,
        description: 'Manzanas donde predominan hogares con jefatura femenina',
        compareFields: null // No comparison - shows where it's >50% of households
    },
    {
        id: 'pueblos_originarios',
        label: 'Pueblos Originarios',
        category: 'Identidad',
        field: 'n_pueblos_orig',
        icon: featherIcon,
        description: 'Manzanas con alta presencia de pueblos originarios',
        compareFields: null // No comparison - shows above average
    },
    {
        id: 'inmigrantes',
        label: 'Población Inmigrante',
        category: 'Identidad',
        field: 'n_inmigrantes',
        icon: worldIcon,
        description: 'Manzanas con alta presencia de población inmigrante',
        compareFields: null // No comparison - shows above average
    },
    {
        id: 'adultos_mayores',
        label: 'Adultos Mayores',
        category: 'Demografía',
        field: 'n_edad_60_mas',
        icon: elderlyIcon,
        description: 'Manzanas donde adultos mayores son el grupo etario dominante',
        compareFields: ['n_edad_0_5', 'n_edad_6_13', 'n_edad_14_17', 'n_edad_18_24', 'n_edad_25_44', 'n_edad_45_59', 'n_edad_60_mas']
    },
    {
        id: 'jovenes',
        label: 'Población Joven',
        category: 'Demografía',
        field: 'n_edad_18_24',
        icon: youngIcon,
        description: 'Manzanas donde jóvenes son el grupo etario dominante',
        compareFields: ['n_edad_0_5', 'n_edad_6_13', 'n_edad_14_17', 'n_edad_18_24', 'n_edad_25_44', 'n_edad_45_59', 'n_edad_60_mas']
    },
    {
        id: 'ninos',
        label: 'Población Infantil',
        category: 'Demografía',
        field: 'n_edad_0_5',
        icon: babyIcon,
        description: 'Manzanas donde niños 0-5 años son el grupo dominante',
        compareFields: ['n_edad_0_5', 'n_edad_6_13', 'n_edad_14_17', 'n_edad_18_24', 'n_edad_25_44', 'n_edad_45_59', 'n_edad_60_mas']
    },
    {
        id: 'hacinamiento',
        label: 'Hacinamiento',
        category: 'Vivienda',
        field: 'n_viv_hacinadas',
        icon: houseMedicalIcon,
        description: 'Manzanas con alta proporción de viviendas hacinadas',
        compareFields: null // No comparison - shows >30% of total housing
    },
    {
        id: 'sin_internet',
        label: 'Sin Conectividad',
        category: 'Conectividad',
        field: null, // calculated field
        icon: noWifiIcon,
        description: 'Manzanas donde predominan hogares sin internet',
        compareFields: null,
        calculated: true,
        calculateFn: (props) => {
            const total = props.n_hog || 0;
            const withInternet = props.n_internet || 0;
            const withoutInternet = total - withInternet;
            return withoutInternet > withInternet ? withoutInternet : 0;
        }
    },
    {
        id: 'desocupacion',
        label: 'Desocupación Alta',
        category: 'Empleo',
        field: 'n_desocupado',
        icon: chartDownIcon,
        description: 'Manzanas con tasa de desocupación superior al promedio',
        compareFields: null // No comparison - shows >15% unemployment rate
    }
];

// Derived: total population in lens or selected ring
export const totalPopulation = derived(selectedFeatures, ($features) => {
    return $features.reduce((sum, f) => sum + (f.properties?.n_per || 0), 0);
});

// Derived: gender breakdown
export const genderBreakdown = derived(selectedFeatures, ($features) => {
    const male = $features.reduce((sum, f) => sum + (f.properties?.n_hombres || 0), 0);
    const female = $features.reduce((sum, f) => sum + (f.properties?.n_mujeres || 0), 0);
    const total = male + female;
    return {
        male,
        female,
        total,
        malePercent: total > 0 ? ((male / total) * 100).toFixed(1) : 0,
        femalePercent: total > 0 ? ((female / total) * 100).toFixed(1) : 0
    };
});

// Derived: age groups data (using INE age brackets)
export const ageGroupsData = derived(selectedFeatures, ($features) => {
    const groups = [
        { key: 'n_edad_0_5', label: '0-5' },
        { key: 'n_edad_6_13', label: '6-13' },
        { key: 'n_edad_14_17', label: '14-17' },
        { key: 'n_edad_18_24', label: '18-24' },
        { key: 'n_edad_25_44', label: '25-44' },
        { key: 'n_edad_45_59', label: '45-59' },
        { key: 'n_edad_60_mas', label: '60+' }
    ];

    return groups.map(g => ({
        label: g.label,
        count: $features.reduce((sum, f) => sum + (f.properties?.[g.key] || 0), 0)
    }));
});

// Derived: employment data
export const employmentData = derived(selectedFeatures, ($features) => {
    const employed = $features.reduce((sum, f) => sum + (f.properties?.n_ocupado || 0), 0);
    const unemployed = $features.reduce((sum, f) => sum + (f.properties?.n_desocupado || 0), 0);
    const inactive = $features.reduce((sum, f) => sum + (f.properties?.n_fuera_fuerza_trabajo || 0), 0);
    const total = employed + unemployed + inactive;
    return {
        employed,
        unemployed,
        inactive,
        total,
        employedPercent: total > 0 ? ((employed / total) * 100).toFixed(1) : 0,
        unemployedPercent: total > 0 ? ((unemployed / total) * 100).toFixed(1) : 0,
        inactivePercent: total > 0 ? ((inactive / total) * 100).toFixed(1) : 0
    };
});

// Derived: education/literacy
export const literacyData = derived(selectedFeatures, ($features) => {
    const illiterate = $features.reduce((sum, f) => sum + (f.properties?.n_analfabet || 0), 0);
    const totalPop = $features.reduce((sum, f) => sum + (f.properties?.n_per || 0), 0);
    const literate = totalPop - illiterate;
    return {
        literate,
        illiterate,
        total: totalPop,
        literatePercent: totalPop > 0 ? ((literate / totalPop) * 100).toFixed(1) : 0,
        illiteratePercent: totalPop > 0 ? ((illiterate / totalPop) * 100).toFixed(1) : 0
    };
});

// Derived: housing type
export const housingData = derived(selectedFeatures, ($features) => {
    return {
        casa: $features.reduce((sum, f) => sum + (f.properties?.n_tipo_viv_casa || 0), 0),
        depto: $features.reduce((sum, f) => sum + (f.properties?.n_tipo_viv_depto || 0), 0),
        mediagua: $features.reduce((sum, f) => sum + (f.properties?.n_tipo_viv_mediagua || 0), 0),
        otro: $features.reduce((sum, f) => sum + (f.properties?.n_tipo_viv_otro || 0), 0),
        totalViv: $features.reduce((sum, f) => sum + (f.properties?.n_vp || 0), 0),
        ocupadas: $features.reduce((sum, f) => sum + (f.properties?.n_vp_ocupada || 0), 0),
        desocupadas: $features.reduce((sum, f) => sum + (f.properties?.n_vp_desocupada || 0), 0)
    };
});

// Derived: average age
export const avgAge = derived(selectedFeatures, ($features) => {
    const ages = $features.filter(f => f.properties?.prom_edad > 0);
    if (ages.length === 0) return 0;
    const sum = ages.reduce((s, f) => s + f.properties.prom_edad, 0);
    return (sum / ages.length).toFixed(1);
});

// Derived: households
export const householdData = derived(selectedFeatures, ($features) => {
    return {
        total: $features.reduce((sum, f) => sum + (f.properties?.n_hog || 0), 0),
        unipersonal: $features.reduce((sum, f) => sum + (f.properties?.n_hog_unipersonales || 0), 0),
        conMenores: $features.reduce((sum, f) => sum + (f.properties?.n_hog_menores || 0), 0),
        adultoMayor: $features.reduce((sum, f) => sum + (f.properties?.n_hog_60 || 0), 0),
        jefaturaMujer: $features.reduce((sum, f) => sum + (f.properties?.n_jefatura_mujer || 0), 0)
    };
});

// Map visibility toggles
export const showParcels = writable(true);
export const showDensity = writable(false);