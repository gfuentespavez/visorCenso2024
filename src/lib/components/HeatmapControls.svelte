<script>
    import { visualizationMode, activeHeatmapVariable, heatmapVariables } from '$lib/stores/lensStore.js';
    import flameIcon from '$lib/assets/icons/flame-svgrepo-com.svg';

    let expanded = false;

    function toggleMode() {
        if ($visualizationMode === 'lens') {
            $visualizationMode = 'heatmap';
            expanded = true;
        } else {
            $visualizationMode = 'lens';
            $activeHeatmapVariable = null;
            expanded = false;
        }
    }

    function selectVariable(variable) {
        $activeHeatmapVariable = variable;
    }

    function clearVariable() {
        $activeHeatmapVariable = null;
    }

    // Group variables by category
    $: groupedVariables = heatmapVariables.reduce((acc, v) => {
        if (!acc[v.category]) acc[v.category] = [];
        acc[v.category].push(v);
        return acc;
    }, {});
</script>

<div class="heatmap-controls">
    <button
            class="mode-toggle"
            class:active={$visualizationMode === 'heatmap'}
            on:click={toggleMode}
            title="Activar visualización por variables"
    >
        <span class="icon">
            {#if $visualizationMode === 'heatmap'}
                <img src={flameIcon} alt="Heatmap" />
            {:else}
                🗺️
            {/if}
        </span>
        <span class="label">
            {$visualizationMode === 'heatmap' ? 'Modo Heatmap' : 'Explorar Variables'}
        </span>
    </button>

    {#if $visualizationMode === 'heatmap'}
        <div class="variables-panel" class:expanded>
            <div class="panel-header">
                <h3>¿Dónde destaca...?</h3>
                <p class="subtitle">Selecciona una variable para visualizar</p>
            </div>

            <div class="categories">
                {#each Object.entries(groupedVariables) as [category, variables]}
                    <div class="category">
                        <div class="category-name">{category}</div>
                        <div class="variables-grid">
                            {#each variables as variable}
                                <button
                                        class="variable-btn"
                                        class:selected={$activeHeatmapVariable?.id === variable.id}
                                        on:click={() => selectVariable(variable)}
                                        title={variable.description}
                                >
                                    <span class="var-icon">
                                        {#if variable.icon.length < 5}
                                            {variable.icon}
                                        {:else}
                                            <img src={variable.icon} alt={variable.label} />
                                        {/if}
                                    </span>
                                    <span class="var-label">{variable.label}</span>
                                </button>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>

            {#if $activeHeatmapVariable}
                <div class="active-variable">
                    <div class="active-header">
                        <span class="active-icon">
                            {#if $activeHeatmapVariable.icon.length < 5}
                                {$activeHeatmapVariable.icon}
                            {:else}
                                <img src={$activeHeatmapVariable.icon} alt={$activeHeatmapVariable.label} />
                            {/if}
                        </span>
                        <div class="active-text">
                            <div class="active-label">{$activeHeatmapVariable.label}</div>
                            <div class="active-desc">{$activeHeatmapVariable.description}</div>
                        </div>
                    </div>
                    <button class="clear-var-btn" on:click={clearVariable}>
                        Limpiar
                    </button>
                </div>

                <div class="legend">
                    <div class="legend-title">Visualización</div>
                    <div class="legend-info">
                        <span class="legend-dot"></span>
                        <span class="legend-text">Manzanas donde esta variable es dominante</span>
                    </div>
                    <div class="legend-note">
                        Solo se muestran áreas donde "{$activeHeatmapVariable.label}" lidera sobre las demás opciones.
                    </div>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .heatmap-controls {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .mode-toggle {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        background: rgba(15, 20, 30, 0.95);
        backdrop-filter: blur(12px);
        border: 1.5px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        color: #aaa;
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        width: 100%;
    }

    .mode-toggle:hover {
        border-color: rgba(255, 107, 107, 0.4);
        background: rgba(20, 28, 42, 0.98);
        color: #fff;
    }

    .mode-toggle.active {
        border-color: #ff6b6b;
        background: rgba(255, 107, 107, 0.15);
        color: #ff6b6b;
    }

    .mode-toggle .icon {
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .mode-toggle .icon img {
        width: 18px;
        height: 18px;
        filter: brightness(0) invert(1);
    }

    .mode-toggle .label {
        font-weight: 500;
    }

    .variables-panel {
        background: rgba(15, 20, 30, 0.98);
        backdrop-filter: blur(16px);
        border: 1.5px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        gap: 16px;
        max-height: calc(100vh - 200px);
        overflow-y: auto;
        width: 360px;
    }

    .panel-header h3 {
        margin: 0;
        color: #fff;
        font-size: 1rem;
        font-weight: 600;
    }

    .subtitle {
        margin: 4px 0 0 0;
        color: #888;
        font-size: 0.75rem;
    }

    .categories {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .category {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .category-name {
        color: #888;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 0 4px;
    }

    .variables-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
    }

    .variable-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: #ccc;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: left;
    }

    .variable-btn:hover {
        background: rgba(255, 107, 107, 0.15);
        border-color: rgba(255, 107, 107, 0.4);
        color: #fff;
        transform: translateY(-1px);
    }

    .variable-btn.selected {
        background: rgba(255, 107, 107, 0.25);
        border-color: #ff6b6b;
        color: #fff;
        font-weight: 600;
    }

    .var-icon {
        font-size: 16px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .var-icon img {
        width: 16px;
        height: 16px;
        filter: brightness(0) invert(1);
    }

    .var-label {
        font-size: 0.75rem;
        line-height: 1.2;
    }

    .active-variable {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px;
        background: rgba(255, 107, 107, 0.15);
        border: 1px solid rgba(255, 107, 107, 0.3);
        border-radius: 10px;
    }

    .active-header {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
        min-width: 0;
    }

    .active-icon {
        font-size: 20px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .active-icon img {
        width: 20px;
        height: 20px;
        filter: brightness(0) invert(1);
    }

    .active-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    .active-label {
        color: #fff;
        font-weight: 600;
        font-size: 0.875rem;
    }

    .active-desc {
        color: #aaa;
        font-size: 0.7rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .clear-var-btn {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        color: #ccc;
        font-size: 0.75rem;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
        flex-shrink: 0;
    }

    .clear-var-btn:hover {
        background: rgba(255, 107, 107, 0.3);
        color: #fff;
    }

    .legend {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .legend-title {
        color: #888;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
    }

    .legend-info {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
    }

    .legend-dot {
        width: 16px;
        height: 16px;
        background: #ff6b6b;
        border-radius: 3px;
        flex-shrink: 0;
        border: 1px solid rgba(255, 107, 107, 0.5);
    }

    .legend-text {
        color: #ccc;
        font-size: 0.75rem;
        line-height: 1.3;
    }

    .legend-note {
        color: #666;
        font-size: 0.65rem;
        line-height: 1.4;
        font-style: italic;
        padding-top: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    /* Scrollbar */
    .variables-panel::-webkit-scrollbar {
        width: 6px;
    }

    .variables-panel::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
    }

    .variables-panel::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
    }

    .variables-panel::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
    }
</style>