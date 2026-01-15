<script>
    import { onMount, onDestroy } from 'svelte';
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
        showParcels,
        showDensity,
        totalPopulation,
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
        });

        // Mouse move - lens follows cursor
        map.on('mousemove', throttle(handleMouseMove, 16));

        // Mouse leave - hide lens when cursor leaves map
        map.on('mouseleave', handleMouseLeave);

        // Mouse enter - show lens when cursor enters map
        map.on('mouseenter', handleMouseEnter);

        // Click to lock/unlock lens
        map.on('click', handleClick);

        return () => {
            if (map) map.remove();
        };
    });

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

        // === LENS CIRCLE ===
        map.addSource('lens-circle', {
            type: 'geojson',
            data: turf.featureCollection([])
        });

        map.addLayer({
            id: 'lens-fill',
            type: 'fill',
            source: 'lens-circle',
            paint: {
                'fill-color': '#000000',
                'fill-opacity': 0.0 // Invisible fill, just for interaction
            }
        });

        map.addLayer({
            id: 'lens-outline',
            type: 'line',
            source: 'lens-circle',
            paint: {
                'line-color': '#ffffff',
                'line-width': 2.5,
                'line-opacity': 0.9
            }
        });

        // === LENS CENTER POINT ===
        map.addSource('lens-center', {
            type: 'geojson',
            data: turf.featureCollection([])
        });

        map.addLayer({
            id: 'lens-center-point',
            type: 'circle',
            source: 'lens-center',
            paint: {
                'circle-radius': 6,
                'circle-color': '#f5c542',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
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

        // Toggle lens lock state
        lensLocked = !lensLocked;

        if (lensLocked) {
            // Lock lens at current position
            const { lng, lat } = e.lngLat;
            lensCenter.set({ lng, lat });
            updateLens(lng, lat);
        } else {
            // Unlock lens - will follow cursor again
            isLensActive.set(true);
        }
    }

    function updateLens(lng, lat) {
        if (!mapReady || !parcelsData) return;

        const point = [lng, lat];
        const radiusKm = $lensRadius;

        // Create circle for lens
        const circle = turf.circle(point, radiusKm, { units: 'kilometers', steps: 64 });

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

    // React to lock state - change lens appearance
    $: if (mapReady && map && map.getLayer('lens-outline')) {
        map.setPaintProperty('lens-outline', 'line-color', lensLocked ? '#f5c542' : '#ffffff');
        map.setPaintProperty('lens-outline', 'line-width', lensLocked ? 3.5 : 2.5);
        map.setPaintProperty('lens-center-point', 'circle-color', lensLocked ? '#f5c542' : '#f5c542');
        map.setPaintProperty('lens-center-point', 'circle-radius', lensLocked ? 8 : 6);
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
            // Ocultar el lente
            if (map.getLayer('lens-outline')) {
                map.setLayoutProperty('lens-outline', 'visibility', 'none');
            }
            if (map.getLayer('lens-center-point')) {
                map.setLayoutProperty('lens-center-point', 'visibility', 'none');
            }
            // Limpiar lente
            clearLensVisuals();
            lensLocked = false;
        } else if (wasInDrawMode) {
            // Only clean up when actually exiting draw mode (not on every reactive run)
            draw.changeMode('simple_select');
            draw.deleteAll();
            drawnPolygon.set(null);
            // Mostrar el lente
            if (map.getLayer('lens-outline')) {
                map.setLayoutProperty('lens-outline', 'visibility', 'visible');
            }
            if (map.getLayer('lens-center-point')) {
                map.setLayoutProperty('lens-center-point', 'visibility', 'visible');
            }
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

        // Only create radius circles for ADDRESS mode, not for COMUNA mode
        if (type !== 'comuna') {
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
            console.log('COMUNA mode: hiding radius circles');

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

        if (type === 'comuna' && location.name) {
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
        if (type === 'comuna' && bounds) {
            console.log('Flying to comuna bounds');
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
        cursor: crosshair !important;
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
</style>