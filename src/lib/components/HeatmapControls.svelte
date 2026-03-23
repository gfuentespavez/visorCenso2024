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
                {#if $activeHeatmapVariable.vizType === 'heating_gap'}
                    <!-- Heating Gap Legend -->
                    <div class="legend">
                        <div class="legend-header">
                            <div class="legend-title">Calefacción dominante por Manzana</div>
                            <button class="clear-var-btn" on:click={clearVariable}>Limpiar</button>
                        </div>
                        <div class="legend-desc">
                            Color por fuente dominante. Intensidad según la brecha con la segunda opción.
                        </div>

                        {#each [
                            { label: 'Leña',         colors: ['#D7A876','#A0522D','#5C2300'] },
                            { label: 'Gas',          colors: ['#FFCC80','#FF9800','#E65100'] },
                            { label: 'Parafina',     colors: ['#90CAF9','#2196F3','#0D47A1'] },
                            { label: 'Electricidad', colors: ['#FFF176','#FFD600','#F57F17'] }
                        ] as source}
                            <div class="legend-section-label">{source.label}</div>
                            <div class="legend-items">
                                <div class="legend-row">
                                    <span class="legend-dot" style="background:{source.colors[0]}; border-color:{source.colors[0]}80;"></span>
                                    <span class="legend-text">Brecha ≤ 5%</span>
                                </div>
                                <div class="legend-row">
                                    <span class="legend-dot" style="background:{source.colors[1]}; border-color:{source.colors[1]}80;"></span>
                                    <span class="legend-text">Brecha 5-10%</span>
                                </div>
                                <div class="legend-row">
                                    <span class="legend-dot" style="background:{source.colors[2]}; border-color:{source.colors[2]}80;"></span>
                                    <span class="legend-text">Brecha > 10%</span>
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else if $activeHeatmapVariable.vizType === 'age_gap'}
                    <!-- Age Gap Legend - directly below variable button -->
                    <div class="legend">
                        <div class="legend-header">
                            <div class="legend-title">Brecha Etaria por Manzana</div>
                            <button class="clear-var-btn" on:click={clearVariable}>Limpiar</button>
                        </div>
                        <div class="legend-desc">
                            Muestra la brecha entre el grupo etario dominante y el segundo grupo. El color indica si el segundo grupo es mayor o menor en edad.
                        </div>
                        <div class="legend-section-label">Segundo grupo es mayor en edad</div>
                        <div class="legend-items">
                            <div class="legend-row">
                                <span class="legend-dot" style="background: #ffe0b2; border-color: rgba(255,224,178,0.5);"></span>
                                <span class="legend-text">Brecha ≤ 5%</span>
                            </div>
                            <div class="legend-row">
                                <span class="legend-dot" style="background: #ffb74d; border-color: rgba(255,183,77,0.5);"></span>
                                <span class="legend-text">Brecha 5-10%</span>
                            </div>
                            <div class="legend-row">
                                <span class="legend-dot" style="background: #e65100; border-color: rgba(230,81,0,0.5);"></span>
                                <span class="legend-text">Brecha > 10%</span>
                            </div>
                        </div>
                        <div class="legend-section-label">Segundo grupo es menor en edad</div>
                        <div class="legend-items">
                            <div class="legend-row">
                                <span class="legend-dot" style="background: #bbdefb; border-color: rgba(187,222,251,0.5);"></span>
                                <span class="legend-text">Brecha ≤ 5%</span>
                            </div>
                            <div class="legend-row">
                                <span class="legend-dot" style="background: #42a5f5; border-color: rgba(66,165,245,0.5);"></span>
                                <span class="legend-text">Brecha 5-10%</span>
                            </div>
                            <div class="legend-row">
                                <span class="legend-dot" style="background: #1565c0; border-color: rgba(21,101,192,0.5);"></span>
                                <span class="legend-text">Brecha > 10%</span>
                            </div>
                        </div>
                    </div>
                {:else if $activeHeatmapVariable.vizType === 'gradient'}
                    <!-- Average Age Gradient Legend -->
                    <div class="legend">
                        <div class="legend-header">
                            <div class="legend-title">Edad Promedio</div>
                            <button class="clear-var-btn" on:click={clearVariable}>Limpiar</button>
                        </div>
                        <div class="legend-gradient-bar">
                            <div class="gradient-bar age-gradient"></div>
                            <div class="gradient-labels">
                                <span>15</span>
                                <span>25</span>
                                <span>35</span>
                                <span>45</span>
                                <span>55</span>
                                <span>70+</span>
                            </div>
                        </div>
                        <div class="legend-desc">
                            Color más cálido indica mayor edad promedio en la manzana.
                        </div>
                    </div>
                {:else}
                    <!-- Default Legend -->
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

    .legend-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
    }

    .legend-desc {
        color: #999;
        font-size: 0.7rem;
        line-height: 1.4;
        margin-bottom: 10px;
    }

    .legend-section-label {
        color: #aaa;
        font-size: 0.65rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        margin-top: 6px;
        margin-bottom: 4px;
        padding-left: 2px;
    }

    .legend-note {
        color: #666;
        font-size: 0.65rem;
        line-height: 1.4;
        font-style: italic;
        padding-top: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    .legend-items {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin-bottom: 4px;
    }

    .legend-row {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .legend-gradient-bar {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 8px;
    }

    .gradient-bar {
        height: 12px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .gradient-bar.age-gradient {
        background: linear-gradient(to right,
            #00b894 0%,
            #00cec9 18%,
            #fdcb6e 36%,
            #e17055 55%,
            #d63031 73%,
            #6c5ce7 100%
        );
    }

    .gradient-labels {
        display: flex;
        justify-content: space-between;
        color: #aaa;
        font-size: 0.6rem;
        padding: 0 2px;
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