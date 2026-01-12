//DemographicsMap.svelte
<script>
    import { onMount, onDestroy } from 'svelte';
    import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
    import mapboxgl from 'mapbox-gl';
    import * as turf from '@turf/turf';
    import {
        lensCenter,
        lensRadius,
        isLensActive,
        selectedFeatures,
        showParcels,
        showDensity,
        totalPopulation
    } from '$lib/stores/lensStore.js';

    export let parcelsData = null;
    export let searchLocation = null; // { lng, lat, name } from address search

    let mapContainer;
    let map;
    let mapReady = false;
    let addressMode = false; // When true, lens is disabled, showing radius rings
    let lensLocked = false; // When true, lens stays fixed until clicked again

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
            //style: 'mapbox://styles/mapbox/light-v10',
            //style: 'mapbox://styles/mapbox/navigation-night-v1',
            center: [-73.05, -36.82], // Concepción
            zoom: 13,
            antialias: true
        });

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

    function setupLayers() {
        // Parcels source (all parcels - dimmed background)
        map.addSource('parcels', {
            type: 'geojson',
            data: turf.featureCollection([])
        });

        map.addLayer({
            id: 'parcels-fill-dim',
            type: 'fill',
            source: 'parcels',
            paint: {
                'fill-color': '#F5F2F2',
                'fill-opacity': 0.2
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

        // Selected parcels (highlighted within lens)
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

        // Lens circle
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

        // Lens center point
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

        // Address search radius rings (3km, 1km, 500m - added in this order so smaller ones render on top)
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

        // Address marker
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
    }

    function loadParcelsData(data) {
        if (map && map.getSource('parcels')) {
            map.getSource('parcels').setData(data);
        }
    }

    function handleMouseMove(e) {
        if (!mapReady || addressMode || lensLocked) return; // Skip if locked

        const { lng, lat } = e.lngLat;

        // Update lens center to cursor position
        lensCenter.set({ lng, lat });
        isLensActive.set(true);

        // Update lens visualization
        updateLens(lng, lat);
    }

    function handleMouseLeave() {
        if (addressMode || lensLocked) return; // Keep lens if locked

        // Hide lens when cursor leaves map
        isLensActive.set(false);

        if (map && mapReady) {
            map.getSource('lens-circle')?.setData(turf.featureCollection([]));
            map.getSource('lens-center')?.setData(turf.featureCollection([]));
            map.getSource('parcels-selected')?.setData(turf.featureCollection([]));
        }

        selectedFeatures.set([]);
    }

    function handleMouseEnter() {
        if (addressMode || lensLocked) return; // Stay locked
        isLensActive.set(true);
    }

    function handleClick(e) {
        if (addressMode) return; // Don't lock in address mode

        if (lensLocked) {
            // Unlock - lens will follow cursor again
            lensLocked = false;
        } else {
            // Lock the lens at current position
            lensLocked = true;
            const { lng, lat } = e.lngLat;
            lensCenter.set({ lng, lat });
            updateLens(lng, lat);
        }
    }

    function updateLens(lng, lat) {
        if (!map || !mapReady) return;

        // Create lens circle
        const circle = turf.circle(
            [lng, lat],
            $lensRadius,
            { units: 'kilometers', steps: 64 }
        );

        // Update lens geometry
        map.getSource('lens-circle').setData(circle);
        map.getSource('lens-center').setData(turf.point([lng, lat]));

        // Query parcels within lens
        queryParcelsInLens(circle);
    }

    function queryParcelsInLens(lensPolygon) {
        if (!parcelsData || !parcelsData.features) {
            selectedFeatures.set([]);
            return;
        }

        const selected = parcelsData.features.filter(feature => {
            try {
                const centroid = turf.centroid(feature);
                return turf.booleanPointInPolygon(centroid, lensPolygon);
            } catch (e) {
                return false;
            }
        });

        // Update selected parcels layer
        if (map.getSource('parcels-selected')) {
            map.getSource('parcels-selected').setData(
                turf.featureCollection(selected)
            );
        }

        // Update store for sidebar
        selectedFeatures.set(selected);
    }

    export function clearLens() {
        lensLocked = false;
        handleMouseLeave();
    }

    // React to parcelsData changes
    $: if (mapReady && parcelsData && map && map.getSource('parcels')) {
        loadParcelsData(parcelsData);
    }

    // React to showParcels toggle
    $: if (mapReady && map && map.getLayer('parcels-fill-dim')) {
        map.setLayoutProperty('parcels-fill-dim', 'visibility', $showParcels ? 'visible' : 'none');
        map.setLayoutProperty('parcels-outline-dim', 'visibility', $showParcels ? 'visible' : 'none');
    }

    // React to radius changes from slider
    $: if (mapReady && $lensCenter && $lensRadius && (lensLocked || $isLensActive)) {
        updateLens($lensCenter.lng, $lensCenter.lat);
    }

    // React to lock state - change lens appearance
    $: if (mapReady && map && map.getLayer('lens-outline')) {
        map.setPaintProperty('lens-outline', 'line-color', lensLocked ? '#f5c542' : '#ffffff');
        map.setPaintProperty('lens-outline', 'line-width', lensLocked ? 3.5 : 2.5);
        map.setPaintProperty('lens-center-point', 'circle-color', lensLocked ? '#f5c542' : '#f5c542');
        map.setPaintProperty('lens-center-point', 'circle-radius', lensLocked ? 8 : 6);
    }

    // React to address search location changes
    $: if (mapReady && map && parcelsData) {
        updateAddressSearch(searchLocation);
    }

    function updateAddressSearch(location) {
        if (!map) return;

        // Clear radius rings
        const sources = ['radius-500m', 'radius-1km', 'radius-3km', 'address-marker'];
        sources.forEach(src => {
            if (map.getSource(src)) {
                map.getSource(src).setData(turf.featureCollection([]));
            }
        });

        if (!location || !parcelsData) {
            // Exit address mode - re-enable lens
            addressMode = false;
            map.getSource('parcels-selected')?.setData(turf.featureCollection([]));
            map.getSource('lens-circle')?.setData(turf.featureCollection([]));
            map.getSource('lens-center')?.setData(turf.featureCollection([]));
            selectedFeatures.set([]);
            isLensActive.set(false);
            return;
        }

        // Enter address mode - disable lens
        addressMode = true;
        isLensActive.set(false);

        // Hide the lens circle
        map.getSource('lens-circle')?.setData(turf.featureCollection([]));
        map.getSource('lens-center')?.setData(turf.featureCollection([]));

        const { lng, lat } = location;
        const point = [lng, lat];

        // Create the three radius circles
        const circle500m = turf.circle(point, 0.5, { units: 'kilometers', steps: 64 });
        const circle1km = turf.circle(point, 1, { units: 'kilometers', steps: 64 });
        const circle3km = turf.circle(point, 3, { units: 'kilometers', steps: 64 });

        // Update radius ring sources
        map.getSource('radius-500m').setData(circle500m);
        map.getSource('radius-1km').setData(circle1km);
        map.getSource('radius-3km').setData(circle3km);
        map.getSource('address-marker').setData(turf.point(point));

        // Find all manzanas within 3km
        const allSelected = parcelsData.features.filter(feature => {
            try {
                const centroid = turf.centroid(feature);
                return turf.booleanPointInPolygon(centroid, circle3km);
            } catch (e) {
                return false;
            }
        });

        // Highlight manzanas within 3km
        if (allSelected.length > 0) {
            map.getSource('parcels-selected').setData(
                turf.featureCollection(allSelected)
            );
            selectedFeatures.set(allSelected);
        }

        // Fly to the location
        map.flyTo({
            center: point,
            zoom: 14,
            duration: 1500
        });
    }

    export function clearAddressSearch() {
        addressMode = false;
    }

</script>

<div class="map-wrapper">
    <div bind:this={mapContainer} class="map-container"></div>

    <!-- Population Density Legend -->
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