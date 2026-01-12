<script>
    import { onMount } from 'svelte';
    import DemographicsMap from '$lib/components/DemographicsMap.svelte';
    import DemographicsSidebar from '$lib/components/DemographicsSidebar.svelte';
    import DemographicsControls from '$lib/components/DemographicsControls.svelte';
    import ComunaSearch from '$lib/components/ComunaSearch.svelte';
    import { fetchGranConcepcionManzanas, fetchAllManzanas } from '$lib/services/manzanasService.js';
    import 'mapbox-gl/dist/mapbox-gl.css';

    let mapComponent;
    let parcelsData = null;
    let loading = true;
    let error = null;
    let searchLocation = null;

    onMount(async () => {
        await loadParcelsData();
    });

    async function loadParcelsData() {
        loading = true;

        try {
            // Load manzanas from Supabase
            // Use fetchGranConcepcionManzanas() for faster loading (only Gran Concepción area)
            // Use fetchAllManzanas() to load all 14,511 manzanas from Biobío region
            console.log('Loading manzanas from Supabase...');
            parcelsData = await fetchAllManzanas();
            console.log(`Loaded ${parcelsData.features.length} manzanas censales from Supabase`);
        } catch (e) {
            console.error('Error loading manzanas:', e);
            error = e.message;

            // Fallback to static GeoJSON if Supabase fails
            try {
                console.log('Falling back to static GeoJSON...');
                const response = await fetch('/data/parcels.geojson');
                if (response.ok) {
                    parcelsData = await response.json();
                    console.log(`Loaded ${parcelsData.features.length} manzanas from static file`);
                }
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
            }
        }

        loading = false;
    }

    function handleClear() {
        if (mapComponent) {
            mapComponent.clearLens();
        }
    }

    function handleAddressSelect(event) {
        searchLocation = event.detail;
    }

    function handleAddressClear() {
        searchLocation = null;
    }
</script>

<svelte:head>
    <title>Datos censales - Gran Concepción</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
</svelte:head>

<div class="dashboard">
    {#if loading}
        <div class="loading-overlay">
            <div class="spinner"></div>
            <p>Cargando datos del Censo 2024</p>
        </div>
    {/if}

    <DemographicsMap
            bind:this={mapComponent}
            {parcelsData}
            {searchLocation}
    />

    <!-- Left panel stack -->
    <div class="left-panel">
        <DemographicsSidebar />

        <ComunaSearch
                on:select={handleAddressSelect}
                on:clear={handleAddressClear}
        />

        <DemographicsControls on:clear={handleClear} />
    </div>

    <!-- Logo bottom right -->
    <div class="logo">
        <img src="https://d26q11cgz8q0ri.cloudfront.net/2025/09/25000650/LOGO-CLBB-ORIGINAL-BLANCO-APAISADO.png" alt="City Lab Biobío" />
    </div>

    {#if error}
        <div class="error-toast">
            <span>⚠️ Using demo data: {error}</span>
        </div>
    {/if}
</div>

<style>
    :global(body) {
        margin: 0;
        padding: 0;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        background: #0a0a0a;
    }

    .dashboard {
        width: 100vw;
        height: 100vh;
        position: relative;
    }

    .left-panel {
        position: absolute;
        top: 20px;
        left: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        z-index: 100;
        max-height: calc(100vh - 40px);
    }

    .logo {
        position: absolute;
        bottom: 20px;
        right: 20px;
        z-index: 100;
    }

    .logo img {
        height: 50px;
    }

    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(10, 10, 10, 0.95);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    }

    .spinner {
        width: 48px;
        height: 48px;
        border: 4px solid rgba(255,255,255,0.1);
        border-top-color: #4a9eff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .loading-overlay p {
        margin-top: 16px;
        color: #888;
    }

    .error-toast {
        position: absolute;
        top: 20px;
        right: 100px;
        background: rgba(255, 107, 107, 0.9);
        color: #fff;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 0.875rem;
        z-index: 200;
    }
</style>