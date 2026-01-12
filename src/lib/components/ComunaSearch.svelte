<script>
    import { createEventDispatcher } from 'svelte';
    import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
    import pinIcon from '$lib/assets/icons/pin.svg';
    import closeIcon from '$lib/assets/icons/close.svg';

    const dispatch = createEventDispatcher();

    let searchQuery = '';
    let suggestions = [];
    let showDropdown = false;
    let loading = false;
    let selectedAddress = null;
    let debounceTimer;

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
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            searchAddress(searchQuery);
        }, 300);
    }

    function selectAddress(feature) {
        selectedAddress = feature;
        searchQuery = feature.place_name;
        showDropdown = false;
        suggestions = [];

        dispatch('select', {
            lng: feature.center[0],
            lat: feature.center[1],
            name: feature.place_name
        });
    }

    function clearSelection() {
        selectedAddress = null;
        searchQuery = '';
        suggestions = [];
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
        }, 200);
    }
</script>

<div class="search-container">
    <div class="search-box" class:active={selectedAddress}>
        <span class="search-icon">
            <img src={pinIcon} alt="pin" />
        </span>
        <input
                type="text"
                placeholder="Buscar dirección..."
                bind:value={searchQuery}
                on:focus={handleFocus}
                on:blur={handleBlur}
                on:input={handleInput}
        />
        {#if loading}
            <span class="loading-spinner"></span>
        {:else if selectedAddress}
            <button class="clear-btn" on:click={clearSelection}>
                <img src={closeIcon} alt="close" />
            </button>
        {/if}
    </div>

    {#if showDropdown && suggestions.length > 0}
        <ul class="dropdown">
            {#each suggestions as suggestion}
                <li>
                    <button
                            class="dropdown-item"
                            on:mousedown={() => selectAddress(suggestion)}
                    >
                        <span class="suggestion-name">{suggestion.text}</span>
                        <span class="suggestion-context">{suggestion.place_name.replace(suggestion.text + ', ', '')}</span>
                    </button>
                </li>
            {/each}
        </ul>
    {/if}

    {#if selectedAddress}
        <div class="radius-legend">
            <div class="legend-item">
                <span class="ring ring-500m"></span>
                <span>500m</span>
            </div>
            <div class="legend-item">
                <span class="ring ring-1km"></span>
                <span>1 km</span>
            </div>
            <div class="legend-item">
                <span class="ring ring-3km"></span>
                <span>3 km</span>
            </div>
        </div>
    {/if}
</div>

<style>
    .search-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .search-box {
        display: flex;
        align-items: center;
        background: rgba(20, 25, 35, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        padding: 12px 16px;
        gap: 12px;
        border: 2px solid transparent;
        transition: border-color 0.2s ease;
    }

    .search-box:focus-within {
        border-color: rgba(255, 255, 255, 0.2);
    }

    .search-box.active {
        border-color: #f5c542;
    }

    .search-icon {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .search-icon img {
        width: 18px;
        height: 18px;
        filter: invert(1);
    }

    input {
        flex: 1;
        background: none;
        border: none;
        outline: none;
        color: #fff;
        font-size: 0.9rem;
        min-width: 0;
    }

    input::placeholder {
        color: #666;
    }

    .loading-spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255,255,255,0.2);
        border-top-color: #f5c542;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .clear-btn {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        padding: 0;
    }

    .clear-btn:hover {
        background: rgba(255, 255, 255, 0.2);
    }

    .clear-btn img {
        width: 14px;
        height: 14px;
        filter: invert(0.6);
    }

    .clear-btn:hover img {
        filter: invert(1);
    }

    .dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 8px;
        background: rgba(20, 25, 35, 0.98);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        padding: 8px 0;
        list-style: none;
        max-height: 300px;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        z-index: 1000;
    }

    .dropdown-item {
        width: 100%;
        padding: 12px 16px;
        background: none;
        border: none;
        color: #ccc;
        font-size: 0.875rem;
        text-align: left;
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .dropdown-item:hover {
        background: rgba(255, 255, 255, 0.08);
    }

    .suggestion-name {
        color: #fff;
        font-weight: 500;
    }

    .suggestion-context {
        color: #888;
        font-size: 0.75rem;
    }

    .radius-legend {
        display: flex;
        gap: 16px;
        padding: 12px 16px;
        background: rgba(20, 25, 35, 0.95);
        border-radius: 12px;
        backdrop-filter: blur(10px);
    }

    .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8rem;
        color: #aaa;
    }

    .ring {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid;
    }

    .ring-500m {
        border-color: #ff6b6b;
        background: rgba(255, 107, 107, 0.2);
    }

    .ring-1km {
        border-color: #feca57;
        background: rgba(254, 202, 87, 0.2);
    }

    .ring-3km {
        border-color: #48dbfb;
        background: rgba(72, 219, 251, 0.2);
    }
</style>