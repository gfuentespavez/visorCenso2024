<script>
    import { onMount } from 'svelte';
    import DemographicsMap from '$lib/components/DemographicsMap.svelte';
    import DemographicsSidebar from '$lib/components/DemographicsSidebar.svelte';
    import DemographicsControls from '$lib/components/DemographicsControls.svelte';
    import HeatmapControls from '$lib/components/HeatmapControls.svelte';
    import { fetchAllManzanas } from '$lib/services/manzanasService.js';
    import { selectedFeatures, showParcels } from '$lib/stores/lensStore.js';
    import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
    import 'mapbox-gl/dist/mapbox-gl.css';

    let mapComponent;
    let parcelsData = null;
    let loading = true;
    let error = null;
    let searchLocation = null;

    // Search state
    let searchQuery = '';
    let suggestions = [];
    let showDropdown = false;
    let searchLoading = false;
    let selectedAddress = null;
    let selectedComuna = null;
    let debounceTimer;
    let showComunasDropdown = false;

    // Comunas (14 total)
    const comunas = [
        { name: 'Concepción', bounds: [[-73.08, -36.88], [-73.01, -36.79]] },
        { name: 'Talcahuano', bounds: [[-73.14, -36.76], [-73.08, -36.69]] },
        { name: 'Hualpén', bounds: [[-73.17, -36.81], [-73.13, -36.75]] },
        { name: 'Chiguayante', bounds: [[-73.05, -36.95], [-72.98, -36.90]] },
        { name: 'San Pedro de la Paz', bounds: [[-73.13, -37.00], [-73.05, -36.82]] },
        { name: 'Penco', bounds: [[-73.00, -36.75], [-72.93, -36.70]] },
        { name: 'Tomé', bounds: [[-72.99, -36.65], [-72.92, -36.58]] },
        { name: 'Coronel', bounds: [[-73.18, -37.05], [-73.10, -36.98]] },
        { name: 'Lota', bounds: [[-73.18, -37.12], [-73.13, -37.06]] },
        { name: 'Hualqui', bounds: [[-72.98, -37.00], [-72.90, -36.92]] },
        { name: 'Santa Juana', bounds: [[-72.98, -37.20], [-72.88, -37.12]] },
        { name: 'Florida', bounds: [[-72.70, -36.85], [-72.60, -36.75]] },
        { name: 'Arauco', bounds: [[-73.35, -37.30], [-73.25, -37.20]] },
        { name: 'Laja', bounds: [[-72.75, -37.35], [-72.65, -37.25]] }
    ];

    onMount(async () => {
        await loadParcelsData();
    });

    async function loadParcelsData() {
        loading = true;
        try {
            console.log('Loading manzanas from Supabase...');
            parcelsData = await fetchAllManzanas();
            console.log(`Loaded ${parcelsData.features.length} manzanas censales`);
        } catch (e) {
            console.error('Error loading manzanas:', e);
            error = e.message;
        }
        loading = false;
    }

    // Search functions
    async function searchAddress(query) {
        if (query.length < 3) {
            suggestions = [];
            return;
        }

        searchLoading = true;
        try {
            const bbox = '-73.3,-37.1,-72.8,-36.6';
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${PUBLIC_MAPBOX_TOKEN}&country=cl&bbox=${bbox}&limit=5&language=es`
            );
            const data = await response.json();
            suggestions = data.features || [];
        } catch (e) {
            console.error('Geocoding error:', e);
            suggestions = [];
        }
        searchLoading = false;
    }

    function handleSearchInput() {
        showDropdown = true;
        showComunasDropdown = false;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            searchAddress(searchQuery);
        }, 300);
    }

    function selectAddress(feature) {
        selectedAddress = feature;
        selectedComuna = null;
        searchQuery = feature.place_name;
        showDropdown = false;
        showComunasDropdown = false;
        suggestions = [];

        searchLocation = {
            type: 'address',
            lng: feature.center[0],
            lat: feature.center[1],
            name: feature.place_name
        };
    }

    function toggleComunasDropdown() {
        showComunasDropdown = !showComunasDropdown;
        showDropdown = false;
    }

    function selectComuna(comuna) {
        selectedComuna = comuna;
        selectedAddress = null;
        searchQuery = '';
        showDropdown = false;
        showComunasDropdown = false;

        const [[minLng, minLat], [maxLng, maxLat]] = comuna.bounds;
        const centerLng = (minLng + maxLng) / 2;
        const centerLat = (minLat + maxLat) / 2;

        searchLocation = {
            type: 'comuna',
            lng: centerLng,
            lat: centerLat,
            name: comuna.name,
            bounds: comuna.bounds
        };
    }

    function clearSelection() {
        selectedAddress = null;
        selectedComuna = null;
        searchQuery = '';
        searchLocation = null;
        if (mapComponent) {
            mapComponent.clearAddressSearch();
        }
    }

    function toggleParcels() {
        showParcels.update(v => !v);
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

    <!-- Left sidebar - single column -->
    <div class="left-panel">
        <DemographicsSidebar>
            <!-- Slot para barra de búsqueda (slot 3) -->
            <div slot="search" class="search-section">
                <div class="search-box" class:active={showDropdown}>
                    <span class="search-icon">🔍</span>
                    <input
                            type="text"
                            bind:value={searchQuery}
                            on:input={handleSearchInput}
                            placeholder="Buscar dirección en Gran Concepción"
                    />
                    {#if searchLoading}
                        <div class="loading-spinner"></div>
                    {:else if searchQuery}
                        <button class="clear-btn" on:click={() => { searchQuery = ''; suggestions = []; }}>
                            ✕
                        </button>
                    {/if}
                </div>

                {#if showDropdown && suggestions.length > 0}
                    <ul class="dropdown">
                        {#each suggestions as suggestion}
                            <li>
                                <button class="dropdown-item" on:click={() => selectAddress(suggestion)}>
                                    <span class="suggestion-icon">📍</span>
                                    <span class="suggestion-text">{suggestion.place_name}</span>
                                </button>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </div>

            <!-- Slot para comunas (slot 4) -->
            <div slot="comunas" class="comunas-section">
                <button class="comunas-toggle" on:click={toggleComunasDropdown}>
                    <span class="toggle-icon">🏘️</span>
                    <span class="toggle-label">Seleccionar Comuna</span>
                    <span class="chevron">{showComunasDropdown ? '▼' : '▶'}</span>
                </button>

                {#if showComunasDropdown}
                    <div class="comunas-grid">
                        {#each comunas as comuna}
                            <button
                                    class="comuna-btn"
                                    class:selected={selectedComuna?.name === comuna.name}
                                    on:click={() => selectComuna(comuna)}
                            >
                                {comuna.name}
                            </button>
                        {/each}
                    </div>
                {/if}

                {#if selectedComuna}
                    <div class="selected-badge">
                        <span class="badge-icon">🏘️</span>
                        <span class="badge-text">{selectedComuna.name}</span>
                        <button class="badge-clear" on:click={clearSelection}>✕</button>
                    </div>
                {/if}
            </div>

            <!-- Slot para heatmap controls (slot 5) -->
            <div slot="heatmap" class="heatmap-wrapper">
                <HeatmapControls />
            </div>

            <!-- Slot para lens controls (slot 6) -->
            <div slot="lens-control" class="controls-wrapper">
                <DemographicsControls />
            </div>
        </DemographicsSidebar>
    </div>

    <!-- Top right action buttons -->
    <div class="top-actions">
        <button class="action-btn" on:click={clearSelection} disabled={!selectedAddress && !selectedComuna}>
            <span class="btn-icon">🗑️</span>
            <span class="btn-label">Borrar Selección</span>
        </button>
        <button class="action-btn" on:click={toggleParcels}>
            <span class="btn-icon">{$showParcels ? '👁️' : '👁️‍🗨️'}</span>
            <span class="btn-label">{$showParcels ? 'Ocultar' : 'Mostrar'} Manzanas</span>
        </button>
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
    :global(html),
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

    /* Left panel */
    .left-panel {
        position: absolute;
        top: 16px;
        left: 20px;
        z-index: 100;
        max-height: calc(100vh - 32px);
    }

    /* Search section */
    .search-section {
        position: relative;
        width: 100%;
        max-width: 100%;
    }

    .search-box {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(12px);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        transition: all 0.2s ease;
        max-width: 100%;
        box-sizing: border-box;
    }

    .search-box:focus-within,
    .search-box.active {
        border-color: rgba(255, 204, 5, 0.5);
        background: rgba(255, 255, 255, 0.08);
    }

    .search-icon {
        font-size: 1.1rem;
    }

    .search-box input {
        flex: 1;
        background: none;
        border: none;
        outline: none;
        color: #fff;
        font-size: 0.9rem;
    }

    .search-box input::placeholder {
        color: rgba(255, 255, 255, 0.4);
    }

    .loading-spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255,255,255,0.2);
        border-top-color: #ffcc05;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .clear-btn {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
        padding: 4px;
        font-size: 1rem;
        transition: color 0.2s ease;
    }

    .clear-btn:hover {
        color: #fff;
    }

    .dropdown {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        background: rgba(15, 40, 84, 0.98);
        backdrop-filter: blur(12px);
        border-radius: 12px;
        padding: 8px;
        list-style: none;
        max-height: 300px;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        z-index: 1000;
    }

    .dropdown-item {
        width: 100%;
        padding: 12px;
        background: none;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 12px;
        text-align: left;
        color: #fff;
        transition: background 0.2s ease;
    }

    .dropdown-item:hover {
        background: rgba(255, 204, 5, 0.1);
    }

    .suggestion-icon {
        font-size: 1.1rem;
    }

    .suggestion-text {
        flex: 1;
        font-size: 0.85rem;
        line-height: 1.3;
    }

    /* Comunas section */
    .comunas-section {
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
    }

    .comunas-toggle {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        color: #fff;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .comunas-toggle:hover {
        background: rgba(255, 204, 5, 0.1);
        border-color: rgba(255, 204, 5, 0.3);
    }

    .toggle-icon {
        font-size: 1.1rem;
    }

    .toggle-label {
        flex: 1;
        text-align: left;
        font-size: 0.9rem;
        font-weight: 500;
    }

    .chevron {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.5);
    }

    .comunas-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin-top: 8px;
    }

    .comuna-btn {
        padding: 10px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: rgba(255, 255, 255, 0.8);
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .comuna-btn:hover {
        background: rgba(255, 204, 5, 0.1);
        border-color: rgba(255, 204, 5, 0.3);
        color: #fff;
    }

    .comuna-btn.selected {
        background: #ffcc05;
        border-color: #ffcc05;
        color: #0F2854;
        font-weight: 600;
    }

    .selected-badge {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        background: rgba(255, 204, 5, 0.15);
        border: 1px solid rgba(255, 204, 5, 0.3);
        border-radius: 10px;
        margin-top: 8px;
    }

    .badge-icon {
        font-size: 1rem;
    }

    .badge-text {
        flex: 1;
        color: #ffcc05;
        font-size: 0.85rem;
        font-weight: 600;
    }

    .badge-clear {
        background: none;
        border: none;
        color: rgba(255, 204, 5, 0.7);
        cursor: pointer;
        padding: 4px;
        font-size: 0.9rem;
        transition: color 0.2s ease;
    }

    .badge-clear:hover {
        color: #ffcc05;
    }

    /* Heatmap wrapper - force max width */
    .heatmap-wrapper {
        max-width: 100%;
        overflow: hidden;
    }

    .heatmap-wrapper :global(*) {
        max-width: 100% !important;
        box-sizing: border-box !important;
    }

    /* Controls wrapper (lens slider + draw button) */
    .controls-wrapper {
        max-width: 100%;
        overflow: hidden;
    }

    .controls-wrapper :global(*) {
        max-width: 100% !important;
        box-sizing: border-box !important;
    }

    /* Top actions */
    .top-actions {
        position: absolute;
        top: 20px;
        right: 20px;
        display: flex;
        gap: 12px;
        z-index: 100;
    }

    .action-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        background: #ffcc05;
        border: none;
        border-radius: 10px;
        color: #0F2854;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(255, 204, 5, 0.3);
    }

    .action-btn:hover:not(:disabled) {
        background: #ffd633;
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(255, 204, 5, 0.4);
    }

    .action-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .btn-icon {
        font-size: 1rem;
    }

    .btn-label {
        font-size: 0.85rem;
    }

    /* Logo */
    .logo {
        position: absolute;
        bottom: 20px;
        right: 20px;
        z-index: 100;
    }

    .logo img {
        height: 50px;
    }

    /* Loading */
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
        border-top-color: #ffcc05;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    .loading-overlay p {
        margin-top: 16px;
        color: #888;
    }

    /* Error toast */
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

    /* Scrollbar */
    .dropdown::-webkit-scrollbar {
        width: 6px;
    }

    .dropdown::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
    }

    .dropdown::-webkit-scrollbar-thumb {
        background: rgba(255, 204, 5, 0.3);
        border-radius: 3px;
    }

    .dropdown::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 204, 5, 0.5);
    }
</style>