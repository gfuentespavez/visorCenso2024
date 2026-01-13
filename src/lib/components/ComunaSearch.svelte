<script>
    import { createEventDispatcher } from 'svelte';
    import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';

    const dispatch = createEventDispatcher();

    // Gran Concepción comunas + provincias cercanas
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

    let searchQuery = '';
    let suggestions = [];
    let showDropdown = false;
    let loading = false;
    let selectedAddress = null;
    let selectedComuna = null;
    let debounceTimer;
    let showComunas = false;

    async function searchAddress(query) {
        if (query.length < 3) {
            suggestions = [];
            return;
        }

        loading = true;
        try {
            // Mapbox Geocoding API - biased to Gran Concepción area
            const bbox = '-73.3,-37.1,-72.8,-36.6'; // Bounding box for Gran Concepción
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${PUBLIC_MAPBOX_TOKEN}&country=cl&bbox=${bbox}&limit=5&language=es`
            );
            const data = await response.json();
            suggestions = data.features || [];
        } catch (e) {
            console.error('Geocoding error:', e);
            suggestions = [];
        }
        loading = false;
    }

    function handleInput() {
        showDropdown = true;
        showComunas = false;
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
        showComunas = false;
        suggestions = [];

        dispatch('select', {
            type: 'address',
            lng: feature.center[0],
            lat: feature.center[1],
            name: feature.place_name
        });
    }

    function selectComuna(comuna) {
        selectedComuna = comuna;
        selectedAddress = null;
        searchQuery = '';
        showDropdown = false;
        showComunas = false;

        // Calculate center of comuna bounds
        const [[minLng, minLat], [maxLng, maxLat]] = comuna.bounds;
        const centerLng = (minLng + maxLng) / 2;
        const centerLat = (minLat + maxLat) / 2;

        dispatch('select', {
            type: 'comuna',
            lng: centerLng,
            lat: centerLat,
            name: comuna.name,
            bounds: comuna.bounds
        });
    }

    function clearSelection() {
        selectedAddress = null;
        selectedComuna = null;
        searchQuery = '';
        suggestions = [];
        showComunas = false;
        dispatch('clear');
    }

    function handleFocus() {
        if (suggestions.length > 0) {
            showDropdown = true;
        }
    }

    function handleBlur() {
        setTimeout(() => {
            showDropdown = false;
            showComunas = false;
        }, 200);
    }

    function toggleComunas() {
        showComunas = !showComunas;
        showDropdown = false;
    }
</script>

<div class="search-container">
    <div class="search-wrapper">
        <div class="search-box" class:active={selectedAddress || selectedComuna}>
            <span class="search-icon">🔍</span>
            <input
                    type="text"
                    placeholder="Buscar dirección en Gran Concepción..."
                    bind:value={searchQuery}
                    on:focus={handleFocus}
                    on:blur={handleBlur}
                    on:input={handleInput}
            />
            {#if loading}
                <span class="loading-spinner"></span>
            {:else if selectedAddress || selectedComuna}
                <button class="clear-btn" on:click={clearSelection} title="Limpiar">
                    ✕
                </button>
            {/if}
        </div>

        <button class="comunas-btn" on:click={toggleComunas} title="Seleccionar comuna">
            <span class="icon">🏘️</span>
            <span class="label">Comunas</span>
        </button>
    </div>

    {#if showDropdown && suggestions.length > 0}
        <ul class="dropdown">
            {#each suggestions as suggestion}
                <li>
                    <button
                            class="dropdown-item"
                            on:mousedown={() => selectAddress(suggestion)}
                    >
                        <span class="suggestion-icon">📍</span>
                        <div class="suggestion-text">
                            <span class="suggestion-name">{suggestion.text}</span>
                            <span class="suggestion-context">{suggestion.place_name.replace(suggestion.text + ', ', '')}</span>
                        </div>
                    </button>
                </li>
            {/each}
        </ul>
    {/if}

    {#if showComunas}
        <div class="comunas-dropdown">
            <div class="comunas-header">Comunas Gran Concepción</div>
            <div class="comunas-grid">
                {#each comunas as comuna}
                    <button
                            class="comuna-btn"
                            class:selected={selectedComuna?.name === comuna.name}
                            on:mousedown={() => selectComuna(comuna)}
                    >
                        {comuna.name}
                    </button>
                {/each}
            </div>
        </div>
    {/if}

    {#if selectedAddress}
        <div class="selected-info">
            <div class="info-badge">
                <span class="badge-icon">📍</span>
                <span class="badge-text">{selectedAddress.text}</span>
            </div>
            <div class="radius-indicators">
                <span class="radius-dot r-500">500m</span>
                <span class="radius-dot r-1k">1km</span>
                <span class="radius-dot r-3k">3km</span>
            </div>
        </div>
    {:else if selectedComuna}
        <div class="selected-info">
            <div class="info-badge comuna">
                <span class="badge-icon">🏘️</span>
                <span class="badge-text">{selectedComuna.name}</span>
            </div>
            <!-- No radius indicators for comuna mode -->
        </div>
    {/if}
</div>

<style>
    .search-container {
        width: 360px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        position: relative;
    }

    .search-wrapper {
        display: flex;
        gap: 8px;
    }

    .search-box {
        flex: 1;
        display: flex;
        align-items: center;
        background: rgba(15, 20, 30, 0.95);
        backdrop-filter: blur(12px);
        border-radius: 10px;
        padding: 10px 14px;
        gap: 10px;
        border: 1.5px solid rgba(255, 255, 255, 0.1);
        transition: all 0.2s ease;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    }

    .search-box:focus-within {
        border-color: rgba(74, 158, 255, 0.5);
        box-shadow: 0 4px 20px rgba(74, 158, 255, 0.2);
    }

    .search-box.active {
        border-color: #4a9eff;
        background: rgba(20, 28, 42, 0.98);
    }

    .search-icon {
        font-size: 16px;
        opacity: 0.6;
        flex-shrink: 0;
    }

    input {
        flex: 1;
        background: none;
        border: none;
        outline: none;
        color: #fff;
        font-size: 0.875rem;
        min-width: 0;
    }

    input::placeholder {
        color: #666;
    }

    .loading-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.2);
        border-top-color: #4a9eff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        flex-shrink: 0;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .clear-btn {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        padding: 0;
        color: #999;
        font-size: 14px;
        flex-shrink: 0;
    }

    .clear-btn:hover {
        background: rgba(255, 107, 107, 0.3);
        color: #ff6b6b;
    }

    .comunas-btn {
        background: rgba(15, 20, 30, 0.95);
        backdrop-filter: blur(12px);
        border: 1.5px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 10px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
        color: #aaa;
        font-size: 0.875rem;
        white-space: nowrap;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    }

    .comunas-btn:hover {
        border-color: rgba(74, 158, 255, 0.5);
        background: rgba(20, 28, 42, 0.98);
        color: #4a9eff;
    }

    .comunas-btn .icon {
        font-size: 16px;
    }

    .dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 4px;
        background: rgba(15, 20, 30, 0.98);
        backdrop-filter: blur(16px);
        border-radius: 10px;
        padding: 6px;
        list-style: none;
        max-height: 280px;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
        z-index: 1000;
    }

    .dropdown-item {
        width: 100%;
        padding: 10px 12px;
        background: none;
        border: none;
        border-radius: 6px;
        color: #ccc;
        font-size: 0.875rem;
        text-align: left;
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .dropdown-item:hover {
        background: rgba(74, 158, 255, 0.15);
        color: #fff;
    }

    .suggestion-icon {
        font-size: 14px;
        opacity: 0.7;
        flex-shrink: 0;
    }

    .suggestion-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    .suggestion-name {
        color: #fff;
        font-weight: 500;
    }

    .suggestion-context {
        color: #888;
        font-size: 0.75rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .comunas-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 4px;
        background: rgba(15, 20, 30, 0.98);
        backdrop-filter: blur(16px);
        border-radius: 10px;
        padding: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
        z-index: 1000;
    }

    .comunas-header {
        padding: 8px 12px;
        color: #888;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        margin-bottom: 8px;
    }

    .comunas-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
    }

    .comuna-btn {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        padding: 10px 12px;
        color: #ccc;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .comuna-btn:hover {
        background: rgba(74, 158, 255, 0.15);
        border-color: rgba(74, 158, 255, 0.4);
        color: #fff;
    }

    .comuna-btn.selected {
        background: rgba(74, 158, 255, 0.25);
        border-color: #4a9eff;
        color: #4a9eff;
        font-weight: 600;
    }

    .selected-info {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .info-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: rgba(74, 158, 255, 0.15);
        border: 1px solid rgba(74, 158, 255, 0.3);
        border-radius: 8px;
        font-size: 0.875rem;
        color: #4a9eff;
    }

    .info-badge.comuna {
        background: rgba(139, 92, 246, 0.15);
        border-color: rgba(139, 92, 246, 0.3);
        color: #a78bfa;
    }

    .badge-icon {
        font-size: 14px;
    }

    .badge-text {
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .radius-indicators {
        display: flex;
        gap: 10px;
        padding: 8px 12px;
        background: rgba(15, 20, 30, 0.95);
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .radius-dot {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        color: #aaa;
        padding: 4px 8px;
        border-radius: 4px;
        transition: all 0.2s ease;
    }

    .radius-dot::before {
        content: '';
        width: 8px;
        height: 8px;
        border-radius: 50%;
        border: 2px solid;
    }

    .radius-dot.r-500::before {
        border-color: #ff6b6b;
        background: rgba(255, 107, 107, 0.3);
    }

    .radius-dot.r-1k::before {
        border-color: #feca57;
        background: rgba(254, 202, 87, 0.3);
    }

    .radius-dot.r-3k::before {
        border-color: #48dbfb;
        background: rgba(72, 219, 251, 0.3);
    }

    /* Scrollbar */
    .dropdown::-webkit-scrollbar,
    .comunas-dropdown::-webkit-scrollbar {
        width: 6px;
    }

    .dropdown::-webkit-scrollbar-track,
    .comunas-dropdown::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
    }

    .dropdown::-webkit-scrollbar-thumb,
    .comunas-dropdown::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
    }

    .dropdown::-webkit-scrollbar-thumb:hover,
    .comunas-dropdown::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
    }
</style>