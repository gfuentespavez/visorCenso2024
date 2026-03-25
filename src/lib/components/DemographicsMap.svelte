<script>
    import { onMount } from 'svelte';
    import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
    import mapboxgl from 'mapbox-gl';
    import MapboxDraw from '@mapbox/mapbox-gl-draw';
    import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
    import * as turf from '@turf/turf';
    import {
        lensCenter,
        lensRadius,
        isLensActive,
        selectedFeatures,
        selectedRadiusRing,
        visualizationMode,
        activeHeatmapVariable,
        drawMode,
        drawnPolygon
    } from '$lib/stores/lensStore.js';

    export let parcelsData = null;
    export let searchLocation = null; // { lng, lat, name, type, bounds } from address search

    let mapContainer;
    let map;
    let draw; // MapboxDraw instance
    let mapReady = false;
    let addressMode = false; // When true, lens is disabled, showing radius rings
    let lensLocked = false; // When true, lens stays fixed until clicked again
    let selectedRing = null; // 'r500', 'r1k', or 'r3k'
    let prevDrawMode = false; // Track previous draw mode state to detect transitions
    let prevSearchLocation = null; // Track previous search location to detect changes
    let modalData = null; // Feature data for click modal

    // Age field config for tooltip/modal
    const ageConfig = [
        { field: 'n_edad_0_5', label: '0-5' },
        { field: 'n_edad_6_13', label: '6-13' },
        { field: 'n_edad_14_17', label: '14-17' },
        { field: 'n_edad_18_24', label: '18-24' },
        { field: 'n_edad_25_44', label: '25-44' },
        { field: 'n_edad_45_59', label: '45-59' },
        { field: 'n_edad_60_mas', label: '60+' }
    ];

    // Throttle function for performance
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    onMount(async () => {
        mapboxgl.accessToken = PUBLIC_MAPBOX_TOKEN;

        map = new mapboxgl.Map({
            container: mapContainer,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [-73.05, -36.82], // Concepción
            zoom: 13,
            antialias: true
        });

        // Inicializar Mapbox Draw
        draw = new MapboxDraw({
            displayControlsDefault: false,
            controls: {},
            styles: [
                // Estilo para polígonos
                {
                    'id': 'gl-draw-polygon-fill',
                    'type': 'fill',
                    'filter': ['all', ['==', '$type', 'Polygon']],
                    'paint': {
                        'fill-color': '#f5c542',
                        'fill-opacity': 0.2
                    }
                },
                {
                    'id': 'gl-draw-polygon-stroke',
                    'type': 'line',
                    'filter': ['all', ['==', '$type', 'Polygon']],
                    'paint': {
                        'line-color': '#f5c542',
                        'line-width': 3
                    }
                },
                // Estilo para vértices
                {
                    'id': 'gl-draw-polygon-and-line-vertex-active',
                    'type': 'circle',
                    'filter': ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
                    'paint': {
                        'circle-radius': 6,
                        'circle-color': '#f5c542'
                    }
                }
            ]
        });

        map.addControl(draw);

        // Eventos de dibujo
        map.on('draw.create', handleDrawCreate);
        map.on('draw.update', handleDrawUpdate);
        map.on('draw.delete', handleDrawDelete);

        map.on('load', () => {
            setupLayers();
            if (parcelsData) {
                loadParcelsData(parcelsData);
            }
            mapReady = true;

            // Activate lens by default (cursor-following mode)
            isLensActive.set(true);

            // Click on heatmap manzanas for modal (no hover tooltips)
            map.on('click', 'heatmap-fill', handleManzanaClick);
            map.on('click', 'parcels-fill-selected', handleManzanaClick);
        });

        // Mouse move - lens follows cursor
        map.on('mousemove', throttle(handleMouseMove, 16));

        // Mouse leave - hide lens when cursor leaves map
        map.on('mouseleave', handleMouseLeave);

        // Mouse enter - show lens when cursor enters map
        map.on('mouseenter', handleMouseEnter);

        // Click to lock/unlock lens
        map.on('click', handleClick);

        // ESC to clear lens selection or close modal
        function handleKeyDown(e) {
            if (e.key !== 'Escape') return;
            if (modalData) { closeModal(); return; }
            if (lensLocked) clearLensSelection();
        }
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            if (map) map.remove();
            window.removeEventListener('keydown', handleKeyDown);
        };
    });

    // === MODAL HANDLERS ===
    function handleManzanaClick(e) {
        if (!e.features || e.features.length === 0) return;
        if ($visualizationMode !== 'heatmap') return; // Only open modal in heatmap mode
        e.originalEvent.stopPropagation();
        modalData = e.features[0].properties;
    }

    function closeModal() {
        modalData = null;
    }

    function clearLensSelection() {
        lensLocked = false;
        isLensActive.set(false);
        selectedFeatures.set([]);
        clearLensVisuals();
    }

    function getAgeGroups(props) {
        const totalPop = props.n_per || 0;
        return ageConfig.map(g => ({
            label: g.label,
            count: props[g.field] || 0,
            pct: totalPop > 0 ? ((props[g.field] || 0) / totalPop * 100).toFixed(1) : '0.0'
        })).sort((a, b) => b.count - a.count);
    }

    // NUEVAS FUNCIONES para manejo de dibujo
    function handleDrawCreate(e) {
        const feature = e.features[0];
        drawnPolygon.set(feature);
        selectFeaturesInPolygon(feature);
    }

    function handleDrawUpdate(e) {
        const feature = e.features[0];
        drawnPolygon.set(feature);
        selectFeaturesInPolygon(feature);
    }

    function handleDrawDelete() {
        drawnPolygon.set(null);
        selectedFeatures.set([]);
        updateLensLayer([]);
    }

    function selectFeaturesInPolygon(polygon) {
        if (!parcelsData) return;

        const selected = parcelsData.features.filter(feature => {
            try {
                return turf.booleanPointInPolygon(
                    turf.centroid(feature),
                    polygon
                );
            } catch (e) {
                return false;
            }
        });

        selectedFeatures.set(selected);
        updateLensLayer(selected);
    }

    function updateLensLayer(features) {
        if (map && map.getSource('parcels-selected')) {
            map.getSource('parcels-selected').setData(
                turf.featureCollection(features)
            );
        }
    }

    function setupLayers() {
        // === HEATMAP LAYER (for thematic visualization) ===
        map.addSource('heatmap-parcels', {
            type: 'geojson',
            data: turf.featureCollection([])
        });

        map.addLayer({
            id: 'heatmap-fill',
            type: 'fill',
            source: 'heatmap-parcels',
            paint: {
                'fill-color': '#ff6b6b', // Solid red color for dominant areas
                'fill-opacity': 0.75
            },
            layout: {
                'visibility': 'none'
            }
        });

        map.addLayer({
            id: 'heatmap-outline',
            type: 'line',
            source: 'heatmap-parcels',
            paint: {
                'line-color': '#ff4757',
                'line-width': 1,
                'line-opacity': 0.9
            },
            layout: {
                'visibility': 'none'
            }
        });

        // === PARCELS SOURCE (all parcels - dimmed background) ===
        map.addSource('parcels', {
            type: 'geojson',
            data: turf.featureCollection([])
        });

        map.addLayer({
            id: 'parcels-fill-dim',
            type: 'fill',
            source: 'parcels',
            paint: {
                'fill-color': '#213C51',
                'fill-opacity': 0.3
            }
        });

        map.addLayer({
            id: 'parcels-outline-dim',
            type: 'line',
            source: 'parcels',
            paint: {
                'line-color': '#000000',
                'line-width': 0.1,
                'line-opacity': 0.3
            }
        });

        // === SELECTED PARCELS (highlighted within lens) ===
        map.addSource('parcels-selected', {
            type: 'geojson',
            data: turf.featureCollection([])
        });

        map.addLayer({
            id: 'parcels-fill-selected',
            type: 'fill',
            source: 'parcels-selected',
            paint: {
                'fill-color': [
                    'interpolate',
                    ['linear'],
                    ['get', 'n_per'], // population field from INE
                    0, '#ffffcc',
                    50, '#ffeda0',
                    100, '#fed976',
                    200, '#feb24c',
                    400, '#fd8d3c',
                    800, '#f03b20'
                ],
                'fill-opacity': 0.85
            }
        });

        map.addLayer({
            id: 'parcels-outline-selected',
            type: 'line',
            source: 'parcels-selected',
            paint: {
                'line-color': '#000000',
                'line-width': 0.5,
                'line-opacity': 0.6
            }
        });

        // === LENS CIRCLE (glassmorphism — matching .glass-card) ===
        map.addSource('lens-circle', {
            type: 'geojson',
            data: turf.featureCollection([])
        });

        // Layer 1: Outer dark shadow — box-shadow: 0 8px 32px rgba(0,0,0,0.1)
        map.addLayer({
            id: 'lens-shadow',
            type: 'line',
            source: 'lens-circle',
            paint: {
                'line-color': '#000000',
                'line-width': 24,
                'line-opacity': 0.1,
                'line-blur': 20,
                'line-offset': 4
            }
        });

        // Layer 2: Glass fill — background: rgba(255,255,255,0.28)
        map.addLayer({
            id: 'lens-fill',
            type: 'fill',
            source: 'lens-circle',
            paint: {
                'fill-color': '#ffffff',
                'fill-opacity': 0.15
            }
        });

        // Layer 3: Inset inner glow — inset 0 0 26px 13px rgba(255,255,255,1.3)
        map.addLayer({
            id: 'lens-inner-glow',
            type: 'line',
            source: 'lens-circle',
            paint: {
                'line-color': '#ffffff',
                'line-width': 20,
                'line-opacity': 0.12,
                'line-blur': 16,
                'line-offset': -10
            }
        });

        // Layer 4: Inset top highlight — inset 0 1px 0 rgba(255,255,255,0.5)
        map.addLayer({
            id: 'lens-highlight',
            type: 'line',
            source: 'lens-circle',
            paint: {
                'line-color': '#ffffff',
                'line-width': 1,
                'line-opacity': 0.5,
                'line-offset': -1
            }
        });

        // Layer 5: Main border — border: 1px solid rgba(255,255,255,0.3)
        map.addLayer({
            id: 'lens-outline',
            type: 'line',
            source: 'lens-circle',
            paint: {
                'line-color': '#ffffff',
                'line-width': 1,
                'line-opacity': 0.3
            }
        });

        // Layer 6: Top edge shine — ::before gradient
        map.addLayer({
            id: 'lens-edge-shine',
            type: 'line',
            source: 'lens-circle',
            paint: {
                'line-color': '#ffffff',
                'line-width': 2,
                'line-opacity': 0.35,
                'line-blur': 1,
                'line-offset': 1
            }
        });

        // === LENS CENTER POINT ===
        map.addSource('lens-center', {
            type: 'geojson',
            data: turf.featureCollection([])
        });

        // Center point soft glow
        map.addLayer({
            id: 'lens-center-glow',
            type: 'circle',
            source: 'lens-center',
            paint: {
                'circle-radius': 16,
                'circle-color': '#f5c542',
                'circle-opacity': 0.12,
                'circle-blur': 1
            }
        });

        // Center point
        map.addLayer({
            id: 'lens-center-point',
            type: 'circle',
            source: 'lens-center',
            paint: {
                'circle-radius': 4,
                'circle-color': '#f5c542',
                'circle-stroke-width': 1.5,
                'circle-stroke-color': 'rgba(255,255,255,0.6)'
            }
        });

        // === ADDRESS SEARCH RADIUS RINGS (3km, 1km, 500m) ===
        // 3km ring
        map.addSource('radius-3km', {
            type: 'geojson',
            data: turf.featureCollection([])
        });

        map.addLayer({
            id: 'radius-3km-fill',
            type: 'fill',
            source: 'radius-3km',
            paint: {
                'fill-color': '#48dbfb',
                'fill-opacity': 0.08
            }
        });

        map.addLayer({
            id: 'radius-3km-line',
            type: 'line',
            source: 'radius-3km',
            paint: {
                'line-color': '#48dbfb',
                'line-width': 2,
                'line-opacity': 0.8
            }
        });

        // 1km ring
        map.addSource('radius-1km', {
            type: 'geojson',
            data: turf.featureCollection([])
        });

        map.addLayer({
            id: 'radius-1km-fill',
            type: 'fill',
            source: 'radius-1km',
            paint: {
                'fill-color': '#feca57',
                'fill-opacity': 0.1
            }
        });

        map.addLayer({
            id: 'radius-1km-line',
            type: 'line',
            source: 'radius-1km',
            paint: {
                'line-color': '#feca57',
                'line-width': 2,
                'line-opacity': 0.9
            }
        });

        // 500m ring
        map.addSource('radius-500m', {
            type: 'geojson',
            data: turf.featureCollection([])
        });

        map.addLayer({
            id: 'radius-500m-fill',
            type: 'fill',
            source: 'radius-500m',
            paint: {
                'fill-color': '#ff6b6b',
                'fill-opacity': 0.12
            }
        });

        map.addLayer({
            id: 'radius-500m-line',
            type: 'line',
            source: 'radius-500m',
            paint: {
                'line-color': '#ff6b6b',
                'line-width': 2.5,
                'line-opacity': 1
            }
        });

        // === ADDRESS MARKER ===
        map.addSource('address-marker', {
            type: 'geojson',
            data: turf.featureCollection([])
        });

        map.addLayer({
            id: 'address-marker-point',
            type: 'circle',
            source: 'address-marker',
            paint: {
                'circle-radius': 10,
                'circle-color': '#ff6b6b',
                'circle-stroke-width': 4,
                'circle-stroke-color': '#ffffff'
            }
        });

        // === CLICKABLE RADIUS RINGS EVENT LISTENERS ===
        setupRingInteractions();
    }

    function setupRingInteractions() {
        // 500m ring
        map.on('click', 'radius-500m-fill', (e) => {
            e.originalEvent.stopPropagation();
            handleRingClick('r500');
        });
        map.on('mouseenter', 'radius-500m-fill', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'radius-500m-fill', () => {
            map.getCanvas().style.cursor = '';
        });

        // 1km ring
        map.on('click', 'radius-1km-fill', (e) => {
            e.originalEvent.stopPropagation();
            handleRingClick('r1k');
        });
        map.on('mouseenter', 'radius-1km-fill', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'radius-1km-fill', () => {
            map.getCanvas().style.cursor = '';
        });

        // 3km ring
        map.on('click', 'radius-3km-fill', (e) => {
            e.originalEvent.stopPropagation();
            handleRingClick('r3k');
        });
        map.on('mouseenter', 'radius-3km-fill', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'radius-3km-fill', () => {
            map.getCanvas().style.cursor = '';
        });
    }

    function handleRingClick(ring) {
        if (!addressMode || !searchLocation) {
            console.log('Ring click ignored: not in address mode');
            return;
        }

        console.log(`Ring clicked: ${ring}, current: ${selectedRing}`);

        // Toggle selection: if clicking the same ring, deselect it
        selectedRing = selectedRing === ring ? null : ring;
        selectedRadiusRing.set(selectedRing);

        console.log(`New selected ring: ${selectedRing}`);

        // Use VISIBILITY instead of opacity for dramatic effect
        try {
            if (selectedRing === null) {
                // Show all rings
                map.setLayoutProperty('radius-500m-fill', 'visibility', 'visible');
                map.setLayoutProperty('radius-500m-line', 'visibility', 'visible');
                map.setLayoutProperty('radius-1km-fill', 'visibility', 'visible');
                map.setLayoutProperty('radius-1km-line', 'visibility', 'visible');
                map.setLayoutProperty('radius-3km-fill', 'visibility', 'visible');
                map.setLayoutProperty('radius-3km-line', 'visibility', 'visible');

                // Reset line widths
                map.setPaintProperty('radius-500m-line', 'line-width', 2.5);
                map.setPaintProperty('radius-1km-line', 'line-width', 2);
                map.setPaintProperty('radius-3km-line', 'line-width', 2);

                console.log('All rings visible');
            } else if (selectedRing === 'r500') {
                // Show only 500m
                map.setLayoutProperty('radius-500m-fill', 'visibility', 'visible');
                map.setLayoutProperty('radius-500m-line', 'visibility', 'visible');
                map.setLayoutProperty('radius-1km-fill', 'visibility', 'none');
                map.setLayoutProperty('radius-1km-line', 'visibility', 'none');
                map.setLayoutProperty('radius-3km-fill', 'visibility', 'none');
                map.setLayoutProperty('radius-3km-line', 'visibility', 'none');

                map.setPaintProperty('radius-500m-line', 'line-width', 3.5);

                console.log('Only 500m visible');
            } else if (selectedRing === 'r1k') {
                // Show only 1km (and 500m for context)
                map.setLayoutProperty('radius-500m-fill', 'visibility', 'visible');
                map.setLayoutProperty('radius-500m-line', 'visibility', 'visible');
                map.setLayoutProperty('radius-1km-fill', 'visibility', 'visible');
                map.setLayoutProperty('radius-1km-line', 'visibility', 'visible');
                map.setLayoutProperty('radius-3km-fill', 'visibility', 'none');
                map.setLayoutProperty('radius-3km-line', 'visibility', 'none');

                map.setPaintProperty('radius-500m-line', 'line-width', 1.5);
                map.setPaintProperty('radius-1km-line', 'line-width', 3.5);

                console.log('500m + 1km visible');
            } else if (selectedRing === 'r3k') {
                // Show all (3km selected means show full context)
                map.setLayoutProperty('radius-500m-fill', 'visibility', 'visible');
                map.setLayoutProperty('radius-500m-line', 'visibility', 'visible');
                map.setLayoutProperty('radius-1km-fill', 'visibility', 'visible');
                map.setLayoutProperty('radius-1km-line', 'visibility', 'visible');
                map.setLayoutProperty('radius-3km-fill', 'visibility', 'visible');
                map.setLayoutProperty('radius-3km-line', 'visibility', 'visible');

                map.setPaintProperty('radius-500m-line', 'line-width', 1.5);
                map.setPaintProperty('radius-1km-line', 'line-width', 1.5);
                map.setPaintProperty('radius-3km-line', 'line-width', 3.5);

                console.log('All rings visible, 3km highlighted');
            }
        } catch (e) {
            console.error('Error setting ring visibility:', e);
        }

        // Update selected features based on ring
        updateFeaturesForRing();
    }

    function updateFeaturesForRing() {
        if (!addressMode || !searchLocation || !parcelsData) {
            console.log('UpdateFeaturesForRing: conditions not met');
            return;
        }

        const { lng, lat } = searchLocation;
        const point = [lng, lat];

        // Determine radius based on selected ring (default to 3km if none selected)
        const radius = selectedRing === 'r500' ? 0.5 :
            selectedRing === 'r1k' ? 1 :
                selectedRing === 'r3k' ? 3 : 3;

        console.log(`Updating features for radius: ${radius}km`);

        const circle = turf.circle(point, radius, { units: 'kilometers', steps: 64 });

        // Filter features within selected radius
        const selected = parcelsData.features.filter(feature => {
            try {
                const centroid = turf.centroid(feature);
                return turf.booleanPointInPolygon(centroid, circle);
            } catch (e) {
                return false;
            }
        });

        console.log(`Found ${selected.length} features within ${radius}km`);

        // Update selected features and map display
        if (selected.length > 0) {
            map.getSource('parcels-selected').setData(
                turf.featureCollection(selected)
            );
            selectedFeatures.set(selected);
        } else {
            // If no features, clear selection
            map.getSource('parcels-selected').setData(turf.featureCollection([]));
            selectedFeatures.set([]);
        }
    }

    function loadParcelsData(data) {
        if (map && map.getSource('parcels')) {
            map.getSource('parcels').setData(data);
        }
    }

    function handleMouseMove(e) {
        if (!mapReady || addressMode || lensLocked || $visualizationMode === 'heatmap' || $drawMode) return;

        const { lng, lat } = e.lngLat;

        // Update lens center to cursor position
        lensCenter.set({ lng, lat });
        isLensActive.set(true);

        updateLens(lng, lat);
    }

    function handleMouseLeave() {
        if (!lensLocked && $visualizationMode !== 'heatmap' && !$drawMode) {
            isLensActive.set(false);
            clearLensVisuals();
        }
    }

    function handleMouseEnter() {
        if (!addressMode && !lensLocked && $visualizationMode !== 'heatmap' && !$drawMode) {
            isLensActive.set(true);
        }
    }

    function handleClick(e) {
        // Ignore clicks on radius rings (they have their own handlers)
        if (addressMode) return;

        if ($visualizationMode === 'heatmap') return;

        if ($drawMode) return; // Ignore clicks in draw mode

        if (lensLocked) {
            // Second click — clear selection and unlock
            clearLensSelection();
        } else {
            // First click — lock lens at current position
            lensLocked = true;
            const { lng, lat } = e.lngLat;
            lensCenter.set({ lng, lat });
            updateLens(lng, lat);
        }
    }

    function updateLens(lng, lat) {
        if (!mapReady || !parcelsData) return;

        const point = [lng, lat];
        // Create circle for lens
        const circle = turf.circle(point, $lensRadius, { units: 'kilometers', steps: 64 });

        // Update lens circle visualization
        map.getSource('lens-circle').setData(circle);
        map.getSource('lens-center').setData(turf.point(point));

        // Find all manzanas within lens
        const selected = parcelsData.features.filter(feature => {
            try {
                const centroid = turf.centroid(feature);
                return turf.booleanPointInPolygon(centroid, circle);
            } catch (e) {
                return false;
            }
        });

        // Update highlighted parcels
        if (selected.length > 0) {
            map.getSource('parcels-selected').setData(
                turf.featureCollection(selected)
            );
            selectedFeatures.set(selected);
        } else {
            map.getSource('parcels-selected').setData(turf.featureCollection([]));
            selectedFeatures.set([]);
        }
    }

    function clearLensVisuals() {
        if (map && map.getSource('lens-circle')) {
            map.getSource('lens-circle').setData(turf.featureCollection([]));
            map.getSource('lens-center').setData(turf.featureCollection([]));
            map.getSource('parcels-selected').setData(turf.featureCollection([]));
        }
    }

    // Public method to clear lens (called from parent)
    export function clearLens() {
        lensLocked = false;
        isLensActive.set(false);
        clearLensVisuals();
        selectedFeatures.set([]);
    }

    // React to parcels data changes
    $: if (mapReady && map && parcelsData) {
        loadParcelsData(parcelsData);
    }

    // React to radius changes from slider
    $: if (mapReady && $lensCenter && $lensRadius && (lensLocked || $isLensActive) && !$drawMode) {
        updateLens($lensCenter.lng, $lensCenter.lat);
    }

    // React to lock state - shift glassmorphism tint to gold when locked
    $: if (mapReady && map && map.getLayer('lens-outline')) {
        const c = lensLocked ? '#f5c542' : '#ffffff';
        // Fill tint
        map.setPaintProperty('lens-fill', 'fill-color', c);
        map.setPaintProperty('lens-fill', 'fill-opacity', lensLocked ? 0.18 : 0.15);
        // Border
        map.setPaintProperty('lens-outline', 'line-color', c);
        map.setPaintProperty('lens-outline', 'line-opacity', lensLocked ? 0.5 : 0.3);
        // Inner glow
        map.setPaintProperty('lens-inner-glow', 'line-color', c);
        map.setPaintProperty('lens-inner-glow', 'line-opacity', lensLocked ? 0.18 : 0.12);
        // Highlight
        map.setPaintProperty('lens-highlight', 'line-color', c);
        map.setPaintProperty('lens-highlight', 'line-opacity', lensLocked ? 0.6 : 0.5);
        // Edge shine
        map.setPaintProperty('lens-edge-shine', 'line-color', c);
        map.setPaintProperty('lens-edge-shine', 'line-opacity', lensLocked ? 0.5 : 0.35);
        // Shadow intensify
        map.setPaintProperty('lens-shadow', 'line-opacity', lensLocked ? 0.15 : 0.1);
        // Center
        map.setPaintProperty('lens-center-glow', 'circle-opacity', lensLocked ? 0.2 : 0.12);
        map.setPaintProperty('lens-center-point', 'circle-radius', lensLocked ? 5 : 4);
    }

    // React to address search location changes - only when searchLocation actually changes
    $: if (mapReady && map && parcelsData && $visualizationMode !== 'heatmap') {
        // Only call updateAddressSearch when searchLocation actually changed
        if (searchLocation !== prevSearchLocation) {
            prevSearchLocation = searchLocation;
            updateAddressSearch(searchLocation);
        }
    }

    // React to visualization mode changes
    $: if (mapReady && map && parcelsData) {
        updateVisualizationMode($visualizationMode, $activeHeatmapVariable);
    }

    // NUEVA REACCIÓN: Cambios en drawMode
    $: if (map && draw && mapReady) {
        // Only run cleanup when transitioning from draw mode to normal mode
        const wasInDrawMode = prevDrawMode;
        prevDrawMode = $drawMode;

        if ($drawMode) {
            // Activar modo de dibujo
            draw.changeMode('draw_polygon');
            // Ocultar todas las capas del lente
            ['lens-shadow', 'lens-fill', 'lens-inner-glow', 'lens-highlight', 'lens-outline', 'lens-edge-shine', 'lens-center-point', 'lens-center-glow'].forEach(id => {
                if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
            });
            // Limpiar lente
            clearLensVisuals();
            lensLocked = false;
        } else if (wasInDrawMode) {
            // Only clean up when actually exiting draw mode (not on every reactive run)
            draw.changeMode('simple_select');
            draw.deleteAll();
            drawnPolygon.set(null);
            // Mostrar todas las capas del lente
            ['lens-shadow', 'lens-fill', 'lens-inner-glow', 'lens-highlight', 'lens-outline', 'lens-edge-shine', 'lens-center-point', 'lens-center-glow'].forEach(id => {
                if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
            });
            // Limpiar selección only when exiting draw mode
            selectedFeatures.set([]);
            updateLensLayer([]);
            // Reactivar lente si no está en address mode
            if (!addressMode) {
                isLensActive.set(true);
            }
        }
    }

    function updateVisualizationMode(mode, variable) {
        if (!map || !parcelsData) return;

        if (mode === 'heatmap' && variable) {
            // Hide lens and address mode
            addressMode = false;
            lensLocked = false;
            isLensActive.set(false);
            selectedRing = null;
            selectedRadiusRing.set(null);

            // Clear all interactive elements
            map.getSource('lens-circle')?.setData(turf.featureCollection([]));
            map.getSource('lens-center')?.setData(turf.featureCollection([]));
            map.getSource('parcels-selected')?.setData(turf.featureCollection([]));

            // Clear radius rings
            ['radius-500m', 'radius-1km', 'radius-3km', 'address-marker'].forEach(src => {
                map.getSource(src)?.setData(turf.featureCollection([]));
            });

            // Show heatmap layers
            map.setLayoutProperty('heatmap-fill', 'visibility', 'visible');
            map.setLayoutProperty('heatmap-outline', 'visibility', 'visible');

            // Dim background parcels
            map.setPaintProperty('parcels-fill-dim', 'fill-opacity', 0.1);
            map.setPaintProperty('parcels-outline-dim', 'line-opacity', 0.1);

            // Process data for heatmap
            processHeatmapData(variable);
        } else {
            // Hide heatmap
            if (map.getLayer('heatmap-fill')) {
                map.setLayoutProperty('heatmap-fill', 'visibility', 'none');
                map.setLayoutProperty('heatmap-outline', 'visibility', 'none');
            }

            // Restore normal opacity
            map.setPaintProperty('parcels-fill-dim', 'fill-opacity', 0.3);
            map.setPaintProperty('parcels-outline-dim', 'line-opacity', 0.3);

            // Clear heatmap data
            map.getSource('heatmap-parcels')?.setData(turf.featureCollection([]));
        }
    }

    function processHeatmapData(variable) {
        if (!parcelsData || !variable) return;

        console.log(`Processing heatmap for: ${variable.label}`);

        // Route to specialized processors based on vizType
        if (variable.vizType === 'age_gap') {
            processAgeGapHeatmap(variable);
            return;
        }
        if (variable.vizType === 'gradient') {
            processGradientHeatmap(variable);
            return;
        }
        if (variable.vizType === 'heating_gap') {
            processHeatingGapHeatmap(variable);
            return;
        }

        // Reset to default solid color for standard variables
        map.setPaintProperty('heatmap-fill', 'fill-color', '#ff6b6b');
        map.setPaintProperty('heatmap-fill', 'fill-opacity', 0.75);
        map.setLayoutProperty('heatmap-outline', 'visibility', 'visible');

        // Determine which manzanas have this variable as dominant
        const dominantFeatures = parcelsData.features
            .map(f => {
                const props = f.properties;
                let isDominant = false;
                let value = 0;

                // Handle calculated fields
                if (variable.calculated && variable.calculateFn) {
                    value = variable.calculateFn(props);
                    isDominant = value > 0;
                }
                // Variables with comparison groups (e.g., transport modes, age groups)
                else if (variable.compareFields && variable.compareFields.length > 0) {
                    // Get all values from the comparison group
                    const values = variable.compareFields.map(field => ({
                        field,
                        value: props[field] || 0
                    }));

                    // Find the maximum value in the group
                    const maxValue = Math.max(...values.map(v => v.value));

                    // Check if our variable has the max value and it's > 0
                    const ourValue = props[variable.field] || 0;
                    isDominant = ourValue > 0 && ourValue === maxValue;
                    value = ourValue;
                }
                // Variables without comparison (show if above threshold)
                else {
                    const rawValue = props[variable.field] || 0;

                    // Different thresholds based on variable type
                    if (variable.id === 'jefatura_mujer') {
                        // Show if >50% of households have female heads
                        const totalHogares = props.n_hog || 0;
                        isDominant = totalHogares > 0 && (rawValue / totalHogares) > 0.5;
                        value = rawValue;
                    }
                    else if (variable.id === 'hacinamiento') {
                        // Show if >30% of housing is overcrowded
                        const totalViviendas = props.n_vp || 0;
                        isDominant = totalViviendas > 0 && (rawValue / totalViviendas) > 0.3;
                        value = rawValue;
                    }
                    else if (variable.id === 'desocupacion') {
                        // Show if unemployment rate >15%
                        const totalLabor = (props.n_ocupado || 0) + (props.n_desocupado || 0);
                        isDominant = totalLabor > 0 && (rawValue / totalLabor) > 0.15;
                        value = rawValue;
                    }
                    else {
                        // For identity variables (inmigrantes, pueblos originarios)
                        // Show if >20% of population
                        const totalPop = props.n_per || 0;
                        isDominant = totalPop > 0 && (rawValue / totalPop) > 0.2;
                        value = rawValue;
                    }
                }

                if (!isDominant) return null;

                // Return feature with normalized intensity based on absolute value
                return {
                    ...f,
                    properties: {
                        ...props,
                        value: 0.7, // Fixed intensity for all dominant areas
                        rawValue: value
                    }
                };
            })
            .filter(f => f !== null);

        if (dominantFeatures.length > 0) {
            map.getSource('heatmap-parcels').setData(
                turf.featureCollection(dominantFeatures)
            );
            console.log(`Heatmap: ${dominantFeatures.length} manzanas where "${variable.label}" is dominant`);
        } else {
            map.getSource('heatmap-parcels').setData(turf.featureCollection([]));
            console.log(`Heatmap: No manzanas found where "${variable.label}" is dominant`);
        }
    }

    function processAgeGapHeatmap(variable) {
        const ageFields = variable.ageFields;

        // Hide outline for this visualization
        map.setLayoutProperty('heatmap-outline', 'visibility', 'none');

        const features = parcelsData.features
            .map(f => {
                const props = f.properties;
                const totalPop = props.n_per || 0;
                if (totalPop === 0) return null;

                // Get percentages for each age group with their indices
                const groups = ageFields.map((field, idx) => ({
                    pct: (props[field] || 0) / totalPop * 100,
                    idx
                }));

                // Sort descending by percentage
                const sorted = [...groups].sort((a, b) => b.pct - a.pct);
                const dominant = sorted[0];
                const second = sorted[1];

                if (!second || dominant.pct === 0) return null;

                const gap = dominant.pct - second.pct;

                // Direction: is the second-place group older or younger than dominant?
                // Positive direction = second group is older, negative = younger
                const direction = second.idx > dominant.idx ? 'older' : 'younger';

                // Gap tier: 1 = ≤5%, 2 = 5-10%, 3 = >10%
                let tier;
                if (gap <= 5) tier = 1;
                else if (gap <= 10) tier = 2;
                else tier = 3;

                // Encode: positive = runner-up is older, negative = runner-up is younger
                const gapCode = direction === 'older' ? tier : -tier;

                return {
                    ...f,
                    properties: {
                        ...props,
                        gap_code: gapCode,
                        gap_value: Math.round(gap),
                        dominant_group: variable.ageLabels[dominant.idx],
                        second_group: variable.ageLabels[second.idx]
                    }
                };
            })
            .filter(f => f !== null);

        // Data-driven paint: warm = runner-up is older, cool = runner-up is younger
        map.setPaintProperty('heatmap-fill', 'fill-color', [
            'match',
            ['get', 'gap_code'],
            // Runner-up is OLDER (warm amber tones)
            1, '#ffe0b2',   // ≤5% gap - light amber
            2, '#ffb74d',   // 5-10% gap - medium amber
            3, '#e65100',   // >10% gap - deep amber
            // Runner-up is YOUNGER (cool blue tones)
            -1, '#bbdefb',  // ≤5% gap - light blue
            -2, '#42a5f5',  // 5-10% gap - medium blue
            -3, '#1565c0',  // >10% gap - deep blue
            '#9e9e9e'       // fallback - neutral
        ]);
        map.setPaintProperty('heatmap-fill', 'fill-opacity', 0.8);

        map.getSource('heatmap-parcels').setData(turf.featureCollection(features));
        console.log(`Age gap heatmap: ${features.length} manzanas`);
    }

    function processHeatingGapHeatmap(variable) {
        map.setLayoutProperty('heatmap-outline', 'visibility', 'none');

        const fields = variable.heatingFields;
        const labels = variable.heatingLabels;

        const features = parcelsData.features
            .map(f => {
                const props = f.properties;

                const groups = fields.map((field, idx) => ({
                    count: props[field] || 0,
                    idx
                }));

                const total = groups.reduce((sum, g) => sum + g.count, 0);
                if (total === 0) return null;

                const sorted = [...groups].sort((a, b) => b.count - a.count);
                const dominant = sorted[0];
                const second = sorted[1];

                if (dominant.count === 0) return null;

                const gap = (dominant.count - (second?.count || 0)) / total * 100;

                // Gap tier: 1 = ≤5%, 2 = 5-10%, 3 = >10%
                let tier;
                if (gap <= 5) tier = 1;
                else if (gap <= 10) tier = 2;
                else tier = 3;

                // Encode: dominant source index (0-3) * 10 + tier (1-3)
                const heatCode = dominant.idx * 10 + tier;

                return {
                    ...f,
                    properties: {
                        ...props,
                        heat_code: heatCode,
                        gap_value: Math.round(gap),
                        dominant_heating: labels[dominant.idx],
                        second_heating: labels[second?.idx ?? 0]
                    }
                };
            })
            .filter(f => f !== null);

        // 4 sources × 3 tiers = 12 colors
        // Leña: browns | Gas: oranges | Parafina: blues | Electricidad: yellows
        map.setPaintProperty('heatmap-fill', 'fill-color', [
            'match', ['get', 'heat_code'],
            // Leña (idx 0)
            1,  '#D7A876',  // ≤5%
            2,  '#A0522D',  // 5-10%
            3,  '#5C2300',  // >10%
            // Gas (idx 1)
            11, '#FFCC80',  // ≤5%
            12, '#FF9800',  // 5-10%
            13, '#E65100',  // >10%
            // Parafina (idx 2)
            21, '#90CAF9',  // ≤5%
            22, '#2196F3',  // 5-10%
            23, '#0D47A1',  // >10%
            // Electricidad (idx 3)
            31, '#FFF176',  // ≤5%
            32, '#FFD600',  // 5-10%
            33, '#F57F17',  // >10%
            '#9e9e9e'
        ]);
        map.setPaintProperty('heatmap-fill', 'fill-opacity', 0.85);

        map.getSource('heatmap-parcels').setData(turf.featureCollection(features));
        console.log(`Heating gap heatmap: ${features.length} manzanas`);
    }

    function processGradientHeatmap(_variable) {
        // Hide outline for this visualization
        map.setLayoutProperty('heatmap-outline', 'visibility', 'none');

        // Filter manzanas with valid prom_edad
        const features = parcelsData.features
            .filter(f => {
                const age = f.properties?.prom_edad;
                return age != null && age > 0;
            })
            .map(f => ({
                ...f,
                properties: {
                    ...f.properties,
                    prom_edad_val: f.properties.prom_edad
                }
            }));

        // Set gradient paint: blue (young) → yellow (mid) → red (old)
        map.setPaintProperty('heatmap-fill', 'fill-color', [
            'interpolate',
            ['linear'],
            ['get', 'prom_edad_val'],
            15, '#00b894',   // young - green
            25, '#00cec9',   // young-mid - teal
            35, '#fdcb6e',   // mid - yellow
            45, '#e17055',   // mid-old - orange
            55, '#d63031',   // old - red
            70, '#6c5ce7'    // very old - purple
        ]);
        map.setPaintProperty('heatmap-fill', 'fill-opacity', 0.8);

        map.getSource('heatmap-parcels').setData(turf.featureCollection(features));
        console.log(`Average age gradient: ${features.length} manzanas displayed`);
    }

    function updateAddressSearch(location) {
        if (!map) return;

        console.log('=== updateAddressSearch called ===');
        console.log('Location:', location);
        console.log('parcelsData:', parcelsData ? `${parcelsData.features.length} features` : 'null');

        // Clear radius rings
        const sources = ['radius-500m', 'radius-1km', 'radius-3km', 'address-marker'];
        sources.forEach(src => {
            if (map.getSource(src)) {
                map.getSource(src).setData(turf.featureCollection([]));
            }
        });

        if (!location || !parcelsData) {
            console.log('Clearing address mode (no location or no data)');
            // Exit address mode - re-enable lens
            addressMode = false;
            selectedRing = null;
            selectedRadiusRing.set(null);
            map.getSource('parcels-selected')?.setData(turf.featureCollection([]));
            map.getSource('lens-circle')?.setData(turf.featureCollection([]));
            map.getSource('lens-center')?.setData(turf.featureCollection([]));
            selectedFeatures.set([]);
            isLensActive.set(false);
            return;
        }

        // Enter address mode - disable lens
        addressMode = true;
        lensLocked = false;
        isLensActive.set(false);

        console.log('Entering address mode');

        // Hide the lens circle
        map.getSource('lens-circle')?.setData(turf.featureCollection([]));
        map.getSource('lens-center')?.setData(turf.featureCollection([]));

        const { lng, lat, type, bounds } = location;
        const point = [lng, lat];

        console.log(`Type: ${type}, Point: [${lng}, ${lat}]`);
        if (bounds) console.log('Bounds:', bounds);

        // Only create radius circles for ADDRESS mode, not for COMUNA/MULTI-COMUNA mode
        if (type !== 'comuna' && type !== 'multi-comuna') {
            console.log('Creating radius circles for address search');

            // Create the three radius circles
            const circle500m = turf.circle(point, 0.5, { units: 'kilometers', steps: 64 });
            const circle1km = turf.circle(point, 1, { units: 'kilometers', steps: 64 });
            const circle3km = turf.circle(point, 3, { units: 'kilometers', steps: 64 });

            // Update radius ring sources
            map.getSource('radius-500m').setData(circle500m);
            map.getSource('radius-1km').setData(circle1km);
            map.getSource('radius-3km').setData(circle3km);
            map.getSource('address-marker').setData(turf.point(point));

            // Reset selection state and styles
            selectedRing = null;
            selectedRadiusRing.set(null);

            // Reset visibility and line widths to default
            map.setLayoutProperty('radius-500m-fill', 'visibility', 'visible');
            map.setLayoutProperty('radius-500m-line', 'visibility', 'visible');
            map.setLayoutProperty('radius-1km-fill', 'visibility', 'visible');
            map.setLayoutProperty('radius-1km-line', 'visibility', 'visible');
            map.setLayoutProperty('radius-3km-fill', 'visibility', 'visible');
            map.setLayoutProperty('radius-3km-line', 'visibility', 'visible');

            map.setPaintProperty('radius-500m-line', 'line-width', 2.5);
            map.setPaintProperty('radius-1km-line', 'line-width', 2);
            map.setPaintProperty('radius-3km-line', 'line-width', 2);

            console.log('Radios created with default styles');
        } else {
            console.log('COMUNA/MULTI-COMUNA mode: hiding radius circles');

            // Hide all radius circles and marker for comuna mode
            map.getSource('radius-500m').setData(turf.featureCollection([]));
            map.getSource('radius-1km').setData(turf.featureCollection([]));
            map.getSource('radius-3km').setData(turf.featureCollection([]));
            map.getSource('address-marker').setData(turf.featureCollection([]));

            // Reset ring selection
            selectedRing = null;
            selectedRadiusRing.set(null);
        }

        // Find all manzanas within area
        let allSelected;

        if (type === 'multi-comuna' && location.names) {
            console.log('=== MULTI-COMUNA MODE ===');
            console.log(`Filtering by comunas: ${location.names.join(', ')}`);
            const namesLower = location.names.map(n => n.toLowerCase().trim());
            allSelected = parcelsData.features.filter(feature => {
                const comunaName = feature.properties?.comuna;
                return comunaName && namesLower.includes(comunaName.toLowerCase().trim());
            });
            console.log(`Found ${allSelected.length} features across ${location.names.length} comunas`);
        } else if (type === 'comuna' && location.name) {
            console.log('=== COMUNA MODE ===');
            console.log(`Filtering by comuna name: "${location.name}"`);

            // Filter by comuna field in properties
            allSelected = parcelsData.features.filter(feature => {
                const comunaName = feature.properties?.comuna;
                // Case insensitive comparison and handle variations
                return comunaName && comunaName.toLowerCase().trim() === location.name.toLowerCase().trim();
            });

            console.log(`Found ${allSelected.length} features in comuna "${location.name}"`);

            // Debug: show unique comunas in results
            if (allSelected.length > 0) {
                const uniqueComunas = [...new Set(allSelected.map(f => f.properties?.comuna))];
                console.log('Comunas found:', uniqueComunas);
            } else {
                // If no match, show available comunas for debugging
                console.warn(`No features found for comuna "${location.name}"`);
                const availableComunas = [...new Set(parcelsData.features.map(f => f.properties?.comuna))].filter(Boolean).slice(0, 10);
                console.log('Available comunas (first 10):', availableComunas);
            }
        } else {
            console.log('=== ADDRESS MODE ===');
            // For address search, use 3km radius
            const circle3km = turf.circle(point, 3, { units: 'kilometers', steps: 64 });
            allSelected = parcelsData.features.filter(feature => {
                try {
                    const centroid = turf.centroid(feature);
                    return turf.booleanPointInPolygon(centroid, circle3km);
                } catch (e) {
                    return false;
                }
            });

            console.log(`Found ${allSelected.length} features within 3km`);
        }

        // Highlight manzanas
        if (allSelected.length > 0) {
            console.log('Setting parcels-selected with features');
            map.getSource('parcels-selected').setData(
                turf.featureCollection(allSelected)
            );
            selectedFeatures.set(allSelected);
            console.log('✅ selectedFeatures.set() called with', allSelected.length, 'features');
        } else {
            console.log('⚠️ No features found, clearing selection');
            map.getSource('parcels-selected').setData(turf.featureCollection([]));
            selectedFeatures.set([]);
        }

        // Fly to the location
        if ((type === 'comuna' || type === 'multi-comuna') && bounds) {
            console.log('Flying to bounds');
            map.fitBounds(bounds, { padding: 50, duration: 1500 });
        } else {
            console.log('Flying to address point');
            map.flyTo({
                center: point,
                zoom: 14,
                duration: 1500
            });
        }

        console.log('=== updateAddressSearch complete ===');
    }

    export function clearAddressSearch() {
        addressMode = false;
        selectedRing = null;
        selectedRadiusRing.set(null);
    }

</script>

<div class="map-wrapper">
    <div bind:this={mapContainer} class="map-container"></div>

    <!-- Population Density Legend (only visible in lens/address mode) -->
    {#if $visualizationMode !== 'heatmap'}
        <div class="map-legend">
            <div class="legend-title">Población por Manzana</div>
            <div class="legend-scale">
                <div class="legend-gradient"></div>
                <div class="legend-labels">
                    <span>0</span>
                    <span>200</span>
                    <span>400</span>
                    <span>600</span>
                    <span>800+</span>
                </div>
            </div>
        </div>
    {/if}

    <!-- Manzana Detail Modal -->
    {#if modalData}
        <div class="modal-overlay" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()} role="dialog" tabindex="-1">
            <div class="modal-content" on:click|stopPropagation role="document">
                <div class="modal-header">
                    <div>
                        <h2>{modalData.comuna || 'Manzana'}</h2>
                        <span class="modal-subtitle">Distrito: {modalData.distrito || '—'} | Zona: {modalData.cod_zona || '—'}</span>
                    </div>
                    <button class="modal-close" on:click={closeModal}>✕</button>
                </div>

                <div class="modal-body">
                    <!-- Quick stats row -->
                    <div class="modal-stats">
                        <div class="modal-stat">
                            <span class="stat-value">{modalData.n_per || 0}</span>
                            <span class="stat-label">Población</span>
                        </div>
                        <div class="modal-stat">
                            <span class="stat-value">{(modalData.prom_edad || 0).toFixed(1)}</span>
                            <span class="stat-label">Edad Prom.</span>
                        </div>
                        <div class="modal-stat">
                            <span class="stat-value">{modalData.n_hog || 0}</span>
                            <span class="stat-label">Hogares</span>
                        </div>
                        <div class="modal-stat">
                            <span class="stat-value">{modalData.n_vp || 0}</span>
                            <span class="stat-label">Viviendas</span>
                        </div>
                    </div>

                    <!-- Age groups -->
                    <div class="modal-section">
                        <h3>Grupos Etarios</h3>
                        <div class="modal-bars">
                            {#each getAgeGroups(modalData) as group}
                                <div class="modal-bar-row">
                                    <span class="bar-label">{group.label}</span>
                                    <div class="bar-track">
                                        <div class="bar-fill" style="width: {group.pct}%; background: {group === getAgeGroups(modalData)[0] ? '#f5c542' : 'rgba(255,255,255,0.3)'}"></div>
                                    </div>
                                    <span class="bar-value">{group.count} ({group.pct}%)</span>
                                </div>
                            {/each}
                        </div>
                    </div>

                    <!-- Gender -->
                    <div class="modal-section">
                        <h3>Género</h3>
                        <div class="modal-gender">
                            <div class="gender-item">
                                <span class="gender-val">{modalData.n_hombres || 0}</span>
                                <span class="gender-lbl">Hombres</span>
                            </div>
                            <div class="gender-bar-track">
                                {#if (modalData.n_per || 0) > 0}
                                    <div class="gender-bar male" style="width: {((modalData.n_hombres || 0) / modalData.n_per * 100).toFixed(1)}%"></div>
                                    <div class="gender-bar female" style="width: {((modalData.n_mujeres || 0) / modalData.n_per * 100).toFixed(1)}%"></div>
                                {/if}
                            </div>
                            <div class="gender-item right">
                                <span class="gender-val">{modalData.n_mujeres || 0}</span>
                                <span class="gender-lbl">Mujeres</span>
                            </div>
                        </div>
                    </div>

                    <!-- Employment -->
                    <div class="modal-section">
                        <h3>Empleo</h3>
                        <div class="modal-stats compact">
                            <div class="modal-stat small">
                                <span class="stat-value ok">{modalData.n_ocupado || 0}</span>
                                <span class="stat-label">Ocupados</span>
                            </div>
                            <div class="modal-stat small">
                                <span class="stat-value warn">{modalData.n_desocupado || 0}</span>
                                <span class="stat-label">Desocupados</span>
                            </div>
                            <div class="modal-stat small">
                                <span class="stat-value">{modalData.n_fuera_fuerza_trabajo || 0}</span>
                                <span class="stat-label">Inactivos</span>
                            </div>
                        </div>
                    </div>

                    <!-- Housing -->
                    <div class="modal-section">
                        <h3>Vivienda</h3>
                        <div class="modal-stats compact">
                            <div class="modal-stat small">
                                <span class="stat-value">{modalData.n_tipo_viv_casa || 0}</span>
                                <span class="stat-label">Casas</span>
                            </div>
                            <div class="modal-stat small">
                                <span class="stat-value">{modalData.n_tipo_viv_depto || 0}</span>
                                <span class="stat-label">Deptos</span>
                            </div>
                            <div class="modal-stat small">
                                <span class="stat-value">{modalData.n_vp_ocupada || 0}</span>
                                <span class="stat-label">Ocupadas</span>
                            </div>
                            <div class="modal-stat small">
                                <span class="stat-value">{modalData.n_vp_desocupada || 0}</span>
                                <span class="stat-label">Desocupadas</span>
                            </div>
                        </div>
                    </div>

                    <!-- Identity -->
                    <div class="modal-section">
                        <h3>Identidad y Conectividad</h3>
                        <div class="modal-stats compact">
                            <div class="modal-stat small">
                                <span class="stat-value">{modalData.n_inmigrantes || 0}</span>
                                <span class="stat-label">Inmigrantes</span>
                            </div>
                            <div class="modal-stat small">
                                <span class="stat-value">{modalData.n_pueblos_orig || 0}</span>
                                <span class="stat-label">Pueblos Orig.</span>
                            </div>
                            <div class="modal-stat small">
                                <span class="stat-value">{modalData.n_internet || 0}</span>
                                <span class="stat-label">C/ Internet</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    .map-wrapper {
        width: 100%;
        height: 100%;
        position: relative;
    }

    .map-container {
        width: 100%;
        height: 100%;
    }

    :global(.mapboxgl-canvas) {
        cursor: crosshair;
    }

    .map-legend {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(20, 25, 35, 0.95);
        backdrop-filter: blur(10px);
        padding: 10px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        z-index: 10;
    }

    .legend-title {
        color: #fff;
        font-size: 0.65rem;
        font-weight: 600;
        margin-bottom: 8px;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .legend-scale {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 240px;
    }

    .legend-gradient {
        height: 10px;
        background: linear-gradient(to right,
        #ffffcc 0%,
        #ffeda0 10%,
        #fed976 20%,
        #feb24c 40%,
        #fd8d3c 60%,
        #f03b20 100%
        );
        border-radius: 5px;
        border: 1px solid rgba(255,255,255,0.2);
    }

    .legend-labels {
        display: flex;
        justify-content: space-between;
        color: #aaa;
        font-size: 0.65rem;
        padding: 0 2px;
    }

    /* === MODAL STYLES === */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        z-index: 9000;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .modal-content {
        background: rgba(20, 25, 35, 0.97);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        width: 480px;
        max-width: 90vw;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
    }

    .modal-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        padding: 20px 24px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .modal-header h2 {
        margin: 0;
        color: #fff;
        font-size: 1.1rem;
        font-weight: 700;
    }

    .modal-subtitle {
        color: #888;
        font-size: 0.7rem;
        margin-top: 2px;
        display: block;
    }

    .modal-close {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: #aaa;
        font-size: 1rem;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
        flex-shrink: 0;
    }

    .modal-close:hover {
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
    }

    .modal-body {
        padding: 16px 24px 24px;
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .modal-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
    }

    .modal-stats.compact {
        grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
        gap: 8px;
    }

    .modal-stat {
        text-align: center;
        padding: 12px 8px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .modal-stat.small {
        padding: 8px 6px;
    }

    .stat-value {
        display: block;
        font-size: 1.3rem;
        font-weight: 700;
        color: #fff;
        margin-bottom: 2px;
    }

    .modal-stat.small .stat-value {
        font-size: 1rem;
    }

    .stat-value.ok {
        color: #4ade80;
    }

    .stat-value.warn {
        color: #ef4444;
    }

    .stat-label {
        font-size: 0.65rem;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }

    .modal-section h3 {
        margin: 0 0 10px;
        color: #f5c542;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .modal-bars {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .modal-bar-row {
        display: grid;
        grid-template-columns: 40px 1fr 80px;
        align-items: center;
        gap: 10px;
    }

    .bar-label {
        font-size: 0.75rem;
        color: #aaa;
    }

    .bar-track {
        height: 8px;
        background: rgba(255, 255, 255, 0.08);
        border-radius: 4px;
        overflow: hidden;
    }

    .bar-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s ease;
    }

    .bar-value {
        font-size: 0.7rem;
        color: #ccc;
        text-align: right;
    }

    .modal-gender {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 12px;
    }

    .gender-item {
        text-align: center;
    }

    .gender-item.right {
        text-align: center;
    }

    .gender-val {
        display: block;
        font-size: 1rem;
        font-weight: 700;
        color: #fff;
    }

    .gender-lbl {
        font-size: 0.65rem;
        color: #888;
    }

    .gender-bar-track {
        display: flex;
        height: 10px;
        border-radius: 5px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.05);
    }

    .gender-bar.male {
        background: #42a5f5;
    }

    .gender-bar.female {
        background: #ec407a;
    }

    /* Modal scrollbar */
    .modal-content::-webkit-scrollbar {
        width: 6px;
    }

    .modal-content::-webkit-scrollbar-track {
        background: transparent;
    }

    .modal-content::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 3px;
    }
</style>