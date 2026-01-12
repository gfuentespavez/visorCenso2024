import { supabase } from '$lib/supabaseClient.js';

/**
 * Fetches all manzanas (census blocks) with their geometry and census data
 * Returns data in GeoJSON format compatible with Mapbox
 * Handles pagination to fetch all 14,511 rows
 */
export async function fetchAllManzanas() {
    let allData = [];
    let page = 0;
    const pageSize = 1000; // Supabase default limit
    let hasMore = true;

    console.log('Fetching all manzanas from database...');

    while (hasMore) {
        const { data, error } = await supabase
            .from('manzanas')
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Error fetching manzanas:', error);
            throw error;
        }

        allData = allData.concat(data);
        hasMore = data.length === pageSize;
        page++;

        console.log(`Loaded ${allData.length} manzanas...`);
    }

    console.log(`✅ Loaded all ${allData.length} manzanas`);
    return convertToGeoJSON(allData);
}

/**
 * Fetches manzanas within a specific bounding box
 * More efficient than loading all data
 * @param {Object} bounds - { minLng, minLat, maxLng, maxLat }
 */
export async function fetchManzanasInBounds(bounds) {
    // Note: This requires PostGIS ST_Intersects function
    // You may need to create a Postgres function for this
    const { data, error } = await supabase
        .rpc('get_manzanas_in_bounds', {
            min_lng: bounds.minLng,
            min_lat: bounds.minLat,
            max_lng: bounds.maxLng,
            max_lat: bounds.maxLat
        });

    if (error) {
        console.error('Error fetching manzanas in bounds:', error);
        // Fallback to fetching all if RPC doesn't exist
        return fetchAllManzanas();
    }

    return convertToGeoJSON(data);
}

/**
 * Fetches manzanas for a specific comuna
 * @param {string} comunaName - Name of the comuna
 */
export async function fetchManzanasByComuna(comunaName) {
    const { data, error } = await supabase
        .from('manzanas')
        .select('*')
        .eq('comuna', comunaName);

    if (error) {
        console.error('Error fetching manzanas by comuna:', error);
        throw error;
    }

    return convertToGeoJSON(data);
}

/**
 * Fetches only manzanas in Gran Concepción area (Concepción, Talcahuano, etc.)
 * Handles pagination to fetch all results
 */
export async function fetchGranConcepcionManzanas() {
    const comunas = [
        'CONCEPCIÓN',
        'TALCAHUANO',
        'HUALPÉN',
        'CHIGUAYANTE',
        'SAN PEDRO DE LA PAZ',
        'PENCO',
        'TOMÉ',
        'CORONEL',
        'LOTA'
    ];

    let allData = [];
    let page = 0;
    const pageSize = 1000; // Supabase default limit
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('manzanas')
            .select('*')
            .in('comuna', comunas)
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Error fetching Gran Concepción manzanas:', error);
            throw error;
        }

        allData = allData.concat(data);
        hasMore = data.length === pageSize;
        page++;

        if (hasMore) {
            console.log(`Loaded ${allData.length} manzanas so far...`);
        }
    }

    console.log(`Loaded ${allData.length} manzanas from Gran Concepción`);
    return convertToGeoJSON(allData);
}

/**
 * Convert database rows to GeoJSON FeatureCollection
 * Compatible with Mapbox and Turf.js
 */
function convertToGeoJSON(rows) {
    if (!rows || rows.length === 0) {
        return {
            type: 'FeatureCollection',
            features: []
        };
    }

    const features = rows.map(row => {
        const { geom, ...properties } = row;

        return {
            type: 'Feature',
            geometry: geom, // Already in GeoJSON format from PostGIS
            properties: properties
        };
    });

    return {
        type: 'FeatureCollection',
        features: features
    };
}

/**
 * Get list of available comunas
 */
export async function getComunasList() {
    const { data, error } = await supabase
        .from('manzanas')
        .select('comuna')
        .order('comuna');

    if (error) {
        console.error('Error fetching comunas:', error);
        return [];
    }

    // Get unique comunas
    const uniqueComunas = [...new Set(data.map(row => row.comuna))];
    return uniqueComunas;
}

/**
 * Get statistics for a comuna
 */
export async function getComunaStats(comunaName) {
    const { data, error } = await supabase
        .from('manzanas')
        .select('n_per, n_hombres, n_mujeres, n_vp')
        .eq('comuna', comunaName);

    if (error) {
        console.error('Error fetching comuna stats:', error);
        return null;
    }

    // Aggregate statistics
    const stats = {
        totalPopulation: data.reduce((sum, row) => sum + (row.n_per || 0), 0),
        totalMale: data.reduce((sum, row) => sum + (row.n_hombres || 0), 0),
        totalFemale: data.reduce((sum, row) => sum + (row.n_mujeres || 0), 0),
        totalViviendas: data.reduce((sum, row) => sum + (row.n_vp || 0), 0),
        manzanas: data.length
    };

    return stats;
}
