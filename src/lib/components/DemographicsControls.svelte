<script>
    import { isLensActive, showParcels, showDensity, lensRadius } from '$lib/stores/lensStore.js';
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();

    function clearCircle() {
        dispatch('clear');
    }

    function toggleDensity() {
        showDensity.update(v => !v);
    }

    function toggleParcels() {
        showParcels.update(v => !v);
    }

    function handleRadiusChange(e) {
        lensRadius.set(parseFloat(e.target.value));
    }
</script>

<div class="controls">
    <div class="radius-control">
        <label for="radius-slider">Radio: <strong>{$lensRadius.toFixed(2)} km</strong></label>
        <input
                type="range"
                id="radius-slider"
                min="0.1"
                max="3"
                step="0.05"
                value={$lensRadius}
                on:input={handleRadiusChange}
        />
    </div>

    <div class="buttons">
        <button
                class="control-btn clear"
                on:click={clearCircle}
                disabled={!$isLensActive}
        >
            Borrar selección
        </button>

        <button
                class="control-btn parcels"
                class:active={!$showParcels}
                on:click={toggleParcels}
        >
            {$showParcels ? 'Ocultar' : 'Mostrar'} Manzanas
        </button>
    </div>
</div>

<style>
    .controls {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 320px;
    }

    .radius-control {
        background: rgba(20, 25, 35, 0.95);
        backdrop-filter: blur(10px);
        padding: 12px 24px;
        border-radius: 25px;
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .radius-control label {
        color: #aaa;
        font-size: 0.85rem;
        white-space: nowrap;
    }

    .radius-control strong {
        color: #fff;
        min-width: 60px;
        display: inline-block;
    }

    input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
        width: 180px;
        height: 6px;
        background: rgba(255,255,255,0.2);
        border-radius: 3px;
        outline: none;
        cursor: pointer;
    }

    input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        background: #f5c542;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        transition: transform 0.15s ease;
    }

    input[type="range"]::-webkit-slider-thumb:hover {
        transform: scale(1.15);
    }

    input[type="range"]::-moz-range-thumb {
        width: 20px;
        height: 20px;
        background: #f5c542;
        border-radius: 50%;
        cursor: pointer;
        border: none;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }

    .buttons {
        display: flex;
        gap: 12px;
    }

    .control-btn {
        padding: 10px 18px;
        border: 2px solid;
        border-radius: 25px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        backdrop-filter: blur(8px);
        background: rgba(20, 25, 35, 0.8);
    }

    .control-btn.clear {
        border-color: #4a9eff;
        color: #4a9eff;
    }

    .control-btn.clear:hover:not(:disabled) {
        background: #4a9eff;
        color: #000;
    }

    .control-btn.clear:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .control-btn.parcels {
        border-color: #4ecdc4;
        color: #4ecdc4;
    }

    .control-btn.parcels:hover,
    .control-btn.parcels.active {
        background: #4ecdc4;
        color: #000;
    }
</style>