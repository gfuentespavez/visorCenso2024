import { writable, derived } from 'svelte/store';

// Lens state
export const lensCenter = writable(null); // { lng, lat }
export const lensRadius = writable(0.5); // km
export const isLensActive = writable(false);
export const isDragging = writable(false);

// Selected features within lens
export const selectedFeatures = writable([]);

// Active topic for sidebar visualization
export const activeTopic = writable('population'); // population, age-pyramid, employment, housing, literacy

// Available topics configuration (matching INE Censo data)
export const topics = [
    { id: 'population', label: 'Población y Género', icon: 'people' },
    { id: 'age-pyramid', label: 'Grupos de Edad', icon: 'chart' },
    { id: 'employment', label: 'Empleo', icon: 'briefcase' },
    { id: 'literacy', label: 'Alfabetización', icon: 'books' },
    { id: 'housing', label: 'Vivienda', icon: 'house' },
    { id: 'households', label: 'Hogares', icon: 'family' }
];

// Derived: total population in lens
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