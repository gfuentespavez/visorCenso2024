<script>
    import { lensRadius, drawMode, isLensActive } from '$lib/stores/lensStore.js';

    function handleRadiusChange(e) {
        lensRadius.set(parseFloat(e.target.value));
    }

    function toggleDrawMode() {
        drawMode.update(v => !v);
        // Si activa draw mode, desactiva el lente
        if ($drawMode) {
            isLensActive.set(false);
        }
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
                disabled={$drawMode}
        />
    </div>

    <button
            class="draw-mode-btn"
            class:active={$drawMode}
            on:click={toggleDrawMode}
    >
        <span class="btn-icon">{$drawMode ? '📍' : '✏️'}</span>
        <span class="btn-text">{$drawMode ? 'Usar Lente' : 'Dibujar Perímetro'}</span>
    </button>
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
        transition: opacity 0.2s ease;
    }

    input[type="range"]:disabled {
        opacity: 0.3;
        cursor: not-allowed;
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

    input[type="range"]:disabled::-webkit-slider-thumb {
        cursor: not-allowed;
        transform: scale(1);
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

    /* Botón de modo de dibujo */
    .draw-mode-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 12px 20px;
        background: rgba(20, 25, 35, 0.95);
        backdrop-filter: blur(10px);
        border: 2px solid rgba(245, 197, 66, 0.3);
        border-radius: 25px;
        color: #f5c542;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .draw-mode-btn:hover {
        background: rgba(245, 197, 66, 0.1);
        border-color: rgba(245, 197, 66, 0.6);
        transform: translateY(-1px);
    }

    .draw-mode-btn.active {
        background: rgba(245, 197, 66, 0.2);
        border-color: #f5c542;
        box-shadow: 0 0 12px rgba(245, 197, 66, 0.3);
    }

    .btn-icon {
        font-size: 1.2rem;
    }

    .btn-text {
        font-size: 0.85rem;
    }
</style>