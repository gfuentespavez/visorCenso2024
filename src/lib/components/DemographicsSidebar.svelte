<script>
    import {
        activeTopic,
        topics,
        selectedFeatures,
        totalPopulation,
        genderBreakdown,
        ageGroupsData,
        employmentData,
        literacyData,
        housingData,
        avgAge,
        householdData,
        isLensActive
    } from '$lib/stores/lensStore.js';
    import targetIcon from '$lib/assets/icons/target.svg';
    import houseIcon from '$lib/assets/icons/house.svg';
    import buildingIcon from '$lib/assets/icons/building.svg';
    import checkIcon from '$lib/assets/icons/check.svg';
    import squareIcon from '$lib/assets/icons/square.svg';

    // Categories with nested topics
    const categories = [
        {
            id: 'demografia',
            label: 'Demografía',
            icon: '👥',
            topics: ['population', 'age-pyramid']
        },
        {
            id: 'socioeconomico',
            label: 'Socioeconómico',
            icon: '💼',
            topics: ['employment', 'literacy']
        },
        {
            id: 'vivienda',
            label: 'Vivienda y Hogares',
            icon: '🏠',
            topics: ['housing', 'households']
        }
    ];

    // Track expanded categories
    let expandedCategories = { 'demografia': true };

    function toggleCategory(catId) {
        expandedCategories[catId] = !expandedCategories[catId];
        expandedCategories = expandedCategories;
    }

    function setTopic(topicId) {
        activeTopic.set(topicId);
    }

    function getTopicLabel(topicId) {
        const topic = topics.find(t => t.id === topicId);
        return topic ? topic.label : topicId;
    }

    // Computed data from selectedFeatures for additional metrics
    $: migrationData = {
        inmigrantes: $selectedFeatures.reduce((sum, f) => sum + (f.properties?.n_inmigrantes || 0), 0),
        pueblosOrig: $selectedFeatures.reduce((sum, f) => sum + (f.properties?.n_pueblos_orig || 0), 0),
        afrodescendencia: $selectedFeatures.reduce((sum, f) => sum + (f.properties?.n_afrodescendencia || 0), 0)
    };

    $: disabilityData = {
        total: $selectedFeatures.reduce((sum, f) => sum + (f.properties?.n_discapacidad || 0), 0),
        ver: $selectedFeatures.reduce((sum, f) => sum + (f.properties?.n_dificultad_ver || 0), 0),
        oir: $selectedFeatures.reduce((sum, f) => sum + (f.properties?.n_dificultad_oir || 0), 0),
        mover: $selectedFeatures.reduce((sum, f) => sum + (f.properties?.n_dificultad_mover || 0), 0)
    };

    $: transportData = computeTransport($selectedFeatures);

    function computeTransport(features) {
        const modes = [
            { key: 'n_transporte_auto', label: 'Auto', icon: '🚗' },
            { key: 'n_transporte_publico', label: 'Transporte Público', icon: '🚌' },
            { key: 'n_transporte_camina', label: 'Camina', icon: '🚶' },
            { key: 'n_transporte_bicicleta', label: 'Bicicleta', icon: '🚲' },
            { key: 'n_transporte_motocicleta', label: 'Moto', icon: '🏍️' }
        ];
        return modes.map(m => ({
            ...m,
            count: features.reduce((sum, f) => sum + (f.properties?.[m.key] || 0), 0)
        })).filter(m => m.count > 0).sort((a, b) => b.count - a.count);
    }

    $: connectivityData = {
        celular: $selectedFeatures.reduce((sum, f) => sum + (f.properties?.n_serv_tel_movil || 0), 0),
        computador: $selectedFeatures.reduce((sum, f) => sum + (f.properties?.n_serv_compu || 0), 0),
        internet: $selectedFeatures.reduce((sum, f) => sum + (f.properties?.n_internet || 0), 0)
    };

    $: energyData = {
        lena: $selectedFeatures.reduce((sum, f) => sum + (f.properties?.n_comb_calefaccion_lena || 0), 0),
        gas: $selectedFeatures.reduce((sum, f) => sum + (f.properties?.n_comb_calefaccion_gas || 0), 0),
        electricidad: $selectedFeatures.reduce((sum, f) => sum + (f.properties?.n_comb_calefaccion_electricidad || 0), 0)
    };

    $: tenureData = computeTenure($selectedFeatures);

    function computeTenure(features) {
        const types = [
            { key: 'n_tenencia_propia_pagada', label: 'Propia pagada' },
            { key: 'n_tenencia_propia_pagandose', label: 'Pagándose' },
            { key: 'n_tenencia_arrendada_contrato', label: 'Arrendada' },
            { key: 'n_tenencia_cedida_familiar', label: 'Cedida' }
        ];
        return types.map(t => ({
            label: t.label,
            count: features.reduce((sum, f) => sum + (f.properties?.[t.key] || 0), 0)
        })).filter(t => t.count > 0).sort((a, b) => b.count - a.count);
    }

    // Get max for age chart scaling
    $: ageMax = Math.max(...$ageGroupsData.map(d => d.count), 1);
    $: transportMax = transportData.length > 0 ? Math.max(...transportData.map(d => d.count), 1) : 1;
    $: tenureMax = tenureData.length > 0 ? Math.max(...tenureData.map(d => d.count), 1) : 1;
</script>

<aside class="sidebar">
    <header class="sidebar-header">
        <h2>Censo 2024</h2>
        <span class="manzanas-count">{$selectedFeatures.length} manzanas</span>
    </header>

    {#if !$isLensActive}
        <div class="empty-state">
            <div class="icon">
                <img src={targetIcon} alt="target" />
            </div>
            <p>Mueve el cursor sobre el mapa para explorar</p>
            <span class="hint">Scroll para cambiar el radio · Click para fijar</span>
        </div>
    {:else}
        <div class="sidebar-content">
            <div class="quick-stats">
                <div class="quick-stat">
                    <span class="qs-value">{$totalPopulation.toLocaleString('es-CL')}</span>
                    <span class="qs-label">Población</span>
                </div>
                <div class="quick-stat">
                    <span class="qs-value">{$householdData.total.toLocaleString('es-CL')}</span>
                    <span class="qs-label">Hogares</span>
                </div>
                <div class="quick-stat">
                    <span class="qs-value">{$avgAge}</span>
                    <span class="qs-label">Edad prom.</span>
                </div>
            </div>

            <div class="categories">
                {#each categories as cat}
                    <div class="category" class:expanded={expandedCategories[cat.id]}>
                        <button class="category-header" on:click={() => toggleCategory(cat.id)}>
                            <span class="cat-icon">{cat.icon}</span>
                            <span class="cat-label">{cat.label}</span>
                            <span class="chevron">{expandedCategories[cat.id] ? '▼' : '▶'}</span>
                        </button>

                        {#if expandedCategories[cat.id]}
                            <div class="category-content">
                                <div class="topic-pills">
                                    {#each cat.topics as topicId}
                                        <button
                                                class="topic-pill"
                                                class:active={$activeTopic === topicId}
                                                on:click={() => setTopic(topicId)}
                                        >
                                            {getTopicLabel(topicId)}
                                        </button>
                                    {/each}
                                </div>

                                {#if cat.topics.includes($activeTopic)}
                                    <div class="topic-data">
                                        {#if $activeTopic === 'population'}
                                            <div class="gender-split">
                                                <div class="gender-bar">
                                                    <div class="gender-fill male" style="width: {$genderBreakdown.malePercent}%"></div>
                                                    <div class="gender-fill female" style="width: {$genderBreakdown.femalePercent}%"></div>
                                                </div>
                                                <div class="gender-legend">
                                                    <span class="gl-item"><span class="dot male"></span> Hombres {$genderBreakdown.male.toLocaleString('es-CL')} ({$genderBreakdown.malePercent}%)</span>
                                                    <span class="gl-item"><span class="dot female"></span> Mujeres {$genderBreakdown.female.toLocaleString('es-CL')} ({$genderBreakdown.femalePercent}%)</span>
                                                </div>
                                            </div>

                                            {#if migrationData.inmigrantes > 0 || migrationData.pueblosOrig > 0}
                                                <div class="subsection">
                                                    <span class="subsection-title">Población Flotante y Origen</span>
                                                    <div class="mini-stats">
                                                        {#if migrationData.inmigrantes > 0}
                                                            <div class="mini-stat">
                                                                <span class="ms-value">{migrationData.inmigrantes}</span>
                                                                <span class="ms-label">Inmigrantes</span>
                                                            </div>
                                                        {/if}
                                                        {#if migrationData.pueblosOrig > 0}
                                                            <div class="mini-stat">
                                                                <span class="ms-value">{migrationData.pueblosOrig}</span>
                                                                <span class="ms-label">Pueblos orig.</span>
                                                            </div>
                                                        {/if}
                                                    </div>
                                                </div>
                                            {/if}

                                        {:else if $activeTopic === 'age-pyramid'}
                                            <div class="age-bars">
                                                {#each $ageGroupsData as group}
                                                    <div class="age-row">
                                                        <span class="age-label">{group.label}</span>
                                                        <div class="bar-track">
                                                            <div class="bar-fill" style="width: {(group.count / ageMax) * 100}%"></div>
                                                        </div>
                                                        <span class="age-count">{group.count.toLocaleString('es-CL')}</span>
                                                    </div>
                                                {/each}
                                            </div>

                                        {:else if $activeTopic === 'employment'}
                                            <div class="employment-grid">
                                                <div class="emp-card good">
                                                    <span class="emp-value">{$employmentData.employed.toLocaleString('es-CL')}</span>
                                                    <span class="emp-label">Ocupados</span>
                                                    <span class="emp-pct">{$employmentData.employedPercent}%</span>
                                                </div>
                                                <div class="emp-card bad">
                                                    <span class="emp-value">{$employmentData.unemployed.toLocaleString('es-CL')}</span>
                                                    <span class="emp-label">Desocupados</span>
                                                    <span class="emp-pct">{$employmentData.unemployedPercent}%</span>
                                                </div>
                                                <div class="emp-card neutral">
                                                    <span class="emp-value">{$employmentData.inactive.toLocaleString('es-CL')}</span>
                                                    <span class="emp-label">Inactivos</span>
                                                    <span class="emp-pct">{$employmentData.inactivePercent}%</span>
                                                </div>
                                            </div>

                                        {:else if $activeTopic === 'literacy'}
                                            <div class="literacy-bars">
                                                <div class="lit-row">
                                                    <span class="lit-label">Alfabetizados</span>
                                                    <div class="bar-track">
                                                        <div class="bar-fill good" style="width: {$literacyData.literatePercent}%"></div>
                                                    </div>
                                                    <span class="lit-value">{$literacyData.literatePercent}%</span>
                                                </div>
                                                <div class="lit-row">
                                                    <span class="lit-label">Analfabetos</span>
                                                    <div class="bar-track">
                                                        <div class="bar-fill bad" style="width: {$literacyData.illiteratePercent}%"></div>
                                                    </div>
                                                    <span class="lit-value">{$literacyData.illiterate}</span>
                                                </div>
                                            </div>

                                            {#if disabilityData.total > 0}
                                                <div class="subsection">
                                                    <span class="subsection-title">Discapacidad</span>
                                                    <div class="mini-stats">
                                                        <div class="mini-stat">
                                                            <span class="ms-value">{disabilityData.total}</span>
                                                            <span class="ms-label">Total</span>
                                                        </div>
                                                        <div class="mini-stat">
                                                            <span class="ms-value">{disabilityData.ver}</span>
                                                            <span class="ms-label">Ver</span>
                                                        </div>
                                                        <div class="mini-stat">
                                                            <span class="ms-value">{disabilityData.mover}</span>
                                                            <span class="ms-label">Moverse</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            {/if}

                                        {:else if $activeTopic === 'housing'}
                                            <div class="housing-grid">
                                                <div class="house-card">
                                                    <img src={houseIcon} alt="casa" />
                                                    <span class="hc-value">{$housingData.casa.toLocaleString('es-CL')}</span>
                                                    <span class="hc-label">Casas</span>
                                                </div>
                                                <div class="house-card">
                                                    <img src={buildingIcon} alt="depto" />
                                                    <span class="hc-value">{$housingData.depto.toLocaleString('es-CL')}</span>
                                                    <span class="hc-label">Deptos</span>
                                                </div>
                                                <div class="house-card">
                                                    <img src={checkIcon} alt="ocupadas" />
                                                    <span class="hc-value">{$housingData.ocupadas.toLocaleString('es-CL')}</span>
                                                    <span class="hc-label">Ocupadas</span>
                                                </div>
                                                <div class="house-card">
                                                    <img src={squareIcon} alt="desocupadas" />
                                                    <span class="hc-value">{$housingData.desocupadas.toLocaleString('es-CL')}</span>
                                                    <span class="hc-label">Desocupadas</span>
                                                </div>
                                            </div>

                                            {#if tenureData.length > 0}
                                                <div class="subsection">
                                                    <span class="subsection-title">Tenencia</span>
                                                    <div class="tenure-bars">
                                                        {#each tenureData.slice(0, 4) as t}
                                                            <div class="tenure-row">
                                                                <span class="t-label">{t.label}</span>
                                                                <div class="bar-track small">
                                                                    <div class="bar-fill" style="width: {(t.count / tenureMax) * 100}%"></div>
                                                                </div>
                                                                <span class="t-value">{t.count}</span>
                                                            </div>
                                                        {/each}
                                                    </div>
                                                </div>
                                            {/if}

                                        {:else if $activeTopic === 'households'}
                                            <div class="hh-stats">
                                                <div class="hh-main">
                                                    <span class="hh-value">{$householdData.total.toLocaleString('es-CL')}</span>
                                                    <span class="hh-label">Total hogares</span>
                                                </div>
                                                <div class="hh-grid">
                                                    <div class="hh-item">
                                                        <span class="hhi-value">{$householdData.unipersonal}</span>
                                                        <span class="hhi-label">Unipersonales</span>
                                                    </div>
                                                    <div class="hh-item">
                                                        <span class="hhi-value">{$householdData.conMenores}</span>
                                                        <span class="hhi-label">Con menores</span>
                                                    </div>
                                                    <div class="hh-item">
                                                        <span class="hhi-value">{$householdData.adultoMayor}</span>
                                                        <span class="hhi-label">Con 60+</span>
                                                    </div>
                                                    <div class="hh-item highlight">
                                                        <span class="hhi-value">{$householdData.jefaturaMujer}</span>
                                                        <span class="hhi-label">Jefatura ♀</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {#if connectivityData.internet > 0}
                                                <div class="subsection">
                                                    <span class="subsection-title">Conectividad</span>
                                                    <div class="mini-stats">
                                                        <div class="mini-stat">
                                                            <span class="ms-value">{connectivityData.internet}</span>
                                                            <span class="ms-label">Internet</span>
                                                        </div>
                                                        <div class="mini-stat">
                                                            <span class="ms-value">{connectivityData.computador}</span>
                                                            <span class="ms-label">PC</span>
                                                        </div>
                                                        <div class="mini-stat">
                                                            <span class="ms-value">{connectivityData.celular}</span>
                                                            <span class="ms-label">Celular</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            {/if}
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/each}

                <div class="category" class:expanded={expandedCategories['transporte']}>
                    <button class="category-header" on:click={() => toggleCategory('transporte')}>
                        <span class="cat-icon">🚗</span>
                        <span class="cat-label">Transporte</span>
                        <span class="chevron">{expandedCategories['transporte'] ? '▼' : '▶'}</span>
                    </button>
                    {#if expandedCategories['transporte']}
                        <div class="category-content">
                            <div class="topic-data">
                                {#if transportData.length > 0}
                                    <div class="transport-list">
                                        {#each transportData as t}
                                            <div class="transport-row">
                                                <span class="tr-icon">{t.icon}</span>
                                                <span class="tr-label">{t.label}</span>
                                                <div class="bar-track small">
                                                    <div class="bar-fill" style="width: {(t.count / transportMax) * 100}%"></div>
                                                </div>
                                                <span class="tr-value">{t.count}</span>
                                            </div>
                                        {/each}
                                    </div>
                                {:else}
                                    <p class="no-data">Sin datos de transporte</p>
                                {/if}
                            </div>
                        </div>
                    {/if}
                </div>

                <div class="category" class:expanded={expandedCategories['energia']}>
                    <button class="category-header" on:click={() => toggleCategory('energia')}>
                        <span class="cat-icon">🔥</span>
                        <span class="cat-label">Calefacción</span>
                        <span class="chevron">{expandedCategories['energia'] ? '▼' : '▶'}</span>
                    </button>
                    {#if expandedCategories['energia']}
                        <div class="category-content">
                            <div class="topic-data">
                                <div class="energy-grid">
                                    <div class="energy-item" class:dominant={energyData.lena > energyData.gas && energyData.lena > energyData.electricidad}>
                                        <span class="e-icon">🪵</span>
                                        <span class="e-value">{energyData.lena}</span>
                                        <span class="e-label">Leña</span>
                                    </div>
                                    <div class="energy-item" class:dominant={energyData.gas > energyData.lena && energyData.gas > energyData.electricidad}>
                                        <span class="e-icon">🔵</span>
                                        <span class="e-value">{energyData.gas}</span>
                                        <span class="e-label">Gas</span>
                                    </div>
                                    <div class="energy-item" class:dominant={energyData.electricidad > energyData.lena && energyData.electricidad > energyData.gas}>
                                        <span class="e-icon">⚡</span>
                                        <span class="e-value">{energyData.electricidad}</span>
                                        <span class="e-label">Eléctrica</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    {/if}
</aside>

<style>
    .sidebar {
        width: 340px;
        max-height: 90vh;
        background: rgba(20, 25, 35, 0.95);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        backdrop-filter: blur(10px);
        color: #e0e0e0;
    }

    .sidebar-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        flex-shrink: 0;
    }

    .sidebar-header h2 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: #ffffff;
        letter-spacing: 0.5px;
    }

    .manzanas-count {
        font-size: 0.7rem;
        color: #4ecdc4;
        background: rgba(78, 205, 196, 0.1);
        padding: 5px 12px;
        border-radius: 20px;
        border: 1px solid rgba(78, 205, 196, 0.2);
    }

    .empty-state {
        padding: 60px 24px;
        text-align: center;
        color: #888;
    }

    .empty-state .icon { margin-bottom: 20px; }
    .empty-state .icon img { width: 56px; height: 56px; filter: invert(1); opacity: 0.5; }
    .empty-state p { margin: 0 0 10px; font-size: 0.95rem; line-height: 1.4; }
    .empty-state .hint { font-size: 0.75rem; color: #555; }

    .sidebar-content {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding-bottom: 24px; /* Added padding for scroll end */
    }

    /* Quick Stats */
    .quick-stats {
        display: flex;
        justify-content: space-evenly;
        padding: 18px 16px;
        background: rgba(255,255,255,0.02);
        border-bottom: 1px solid rgba(255,255,255,0.06);
        margin-bottom: 8px; /* Breathing room before accordion */
    }

    .quick-stat { text-align: center; }
    .qs-value { display: block; font-size: 1.3rem; font-weight: 700; color: #fff; margin-bottom: 2px; }
    .qs-label { font-size: 0.65rem; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }

    /* Categories */
    .categories { display: flex; flex-direction: column; }

    .category {
        border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .category-header {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 20px;
        background: transparent;
        border: none;
        color: #ccc;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .category-header:hover { background: rgba(255,255,255,0.03); color: #fff; }
    .category.expanded .category-header { background: rgba(78, 205, 196, 0.08); color: #4ecdc4; }

    .cat-icon { font-size: 1.1rem; }
    .cat-label { flex: 1; text-align: left; font-weight: 500; }
    .chevron { font-size: 0.6rem; color: #666; transition: transform 0.2s; }
    .category.expanded .chevron { transform: rotate(90deg); }

    .category-content {
        padding: 0 20px 20px; /* More horizontal padding */
        background: rgba(0,0,0,0.1);
    }

    /* Topic Pills */
    .topic-pills {
        display: flex;
        gap: 8px;
        margin: 16px 0 20px; /* Increased bottom margin */
        flex-wrap: wrap;
    }

    .topic-pill {
        padding: 6px 14px;
        background: rgba(255,255,255,0.06);
        border: 1px solid transparent;
        border-radius: 20px;
        color: #aaa;
        font-size: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .topic-pill:hover { background: rgba(255,255,255,0.1); color: #fff; border-color: rgba(255,255,255,0.1); }
    .topic-pill.active { background: #4ecdc4; color: #1a1a2e; font-weight: 600; border-color: #4ecdc4; box-shadow: 0 2px 8px rgba(78,205,196,0.3); }

    /* Topic Data */
    .topic-data { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

    /* Gender Split */
    .gender-split { margin-bottom: 24px; }
    .gender-bar {
        height: 10px;
        border-radius: 5px;
        overflow: hidden;
        display: flex;
        background: #2a2a3a;
        margin-bottom: 12px;
    }
    .gender-fill.male { background: #4a9eff; }
    .gender-fill.female { background: #ff6b9d; }
    .gender-legend { display: flex; justify-content: space-between; gap: 10px; }
    .gl-item { font-size: 0.8rem; color: #ccc; display: flex; align-items: center; gap: 8px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; }
    .dot.male { background: #4a9eff; }
    .dot.female { background: #ff6b9d; }

    /* Age Bars */
    .age-bars { display: flex; flex-direction: column; gap: 4px; } /* Increased gap */
    .age-row { display: flex; align-items: center; gap: 12px; padding: 2px 0; }
    .age-label { width: 45px; font-size: 0.75rem; color: #999; text-align: right; }
    .bar-track { flex: 1; height: 16px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; }
    .bar-track.small { height: 12px; }
    .bar-fill { height: 100%; background: linear-gradient(90deg, #3d84d6, #4ecdc4); border-radius: 3px; transition: width 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); }
    .bar-fill.good { background: #4ecdc4; }
    .bar-fill.bad { background: #ff6b6b; }
    .age-count { width: 45px; font-size: 0.75rem; color: #ccc; text-align: right; font-feature-settings: "tnum"; }

    /* Employment Grid */
    .employment-grid { display: flex; flex-direction: column; gap: 12px; }
    .emp-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        background: rgba(255,255,255,0.04);
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.03);
    }
    .emp-value { font-size: 1.15rem; font-weight: 700; color: #fff; min-width: 60px; }
    .emp-label { flex: 1; font-size: 0.8rem; color: #999; }
    .emp-pct { font-size: 0.85rem; font-weight: 600; padding: 2px 8px; border-radius: 6px; background: rgba(0,0,0,0.2); }
    .emp-card.good .emp-pct { color: #4ecdc4; background: rgba(78, 205, 196, 0.1); }
    .emp-card.bad .emp-pct { color: #ff6b6b; background: rgba(255, 107, 107, 0.1); }
    .emp-card.neutral .emp-pct { color: #aaa; }

    /* Literacy */
    .literacy-bars { display: flex; flex-direction: column; gap: 16px; }
    .lit-row { display: flex; align-items: center; gap: 12px; }
    .lit-label { width: 90px; font-size: 0.8rem; color: #aaa; }
    .lit-value { width: 45px; font-size: 0.8rem; color: #fff; text-align: right; font-weight: 600; }

    /* Housing Grid */
    .housing-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .house-card {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.02);
        border-radius: 10px;
        padding: 16px;
        text-align: center;
        transition: transform 0.2s;
    }
    .house-card:hover { transform: translateY(-2px); background: rgba(255,255,255,0.06); }
    .house-card img { width: 24px; height: 24px; opacity: 0.8; margin-bottom: 8px; }
    .hc-value { display: block; font-size: 1.2rem; font-weight: 700; color: #fff; margin-bottom: 2px; }
    .hc-label { font-size: 0.75rem; color: #888; }

    /* Tenure */
    .tenure-bars { display: flex; flex-direction: column; gap: 8px; }
    .tenure-row { display: flex; align-items: center; gap: 10px; padding: 2px 0; }
    .t-label { width: 90px; font-size: 0.75rem; color: #999; }
    .t-value { width: 40px; font-size: 0.75rem; color: #ccc; text-align: right; }

    /* Households */
    .hh-stats { text-align: center; margin-bottom: 24px; }
    .hh-main { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .hh-value { display: block; font-size: 2.2rem; font-weight: 700; color: #fff; letter-spacing: -1px; }
    .hh-label { font-size: 0.8rem; color: #888; text-transform: uppercase; letter-spacing: 1px; }
    .hh-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .hh-item {
        background: rgba(255,255,255,0.04);
        border-radius: 8px;
        padding: 12px 10px;
        text-align: center;
    }
    .hh-item.highlight { background: rgba(255, 107, 157, 0.1); border: 1px solid rgba(255, 107, 157, 0.25); }
    .hhi-value { display: block; font-size: 1.2rem; font-weight: 700; color: #fff; margin-bottom: 4px; }
    .hh-item.highlight .hhi-value { color: #ff6b9d; }
    .hhi-label { font-size: 0.7rem; color: #888; }

    /* Subsections - Improved Spacing */
    .subsection {
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid rgba(255,255,255,0.08);
    }
    .subsection-title {
        display: block;
        font-size: 0.75rem;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        margin-bottom: 12px;
        font-weight: 600;
    }

    /* Mini Stats */
    .mini-stats { display: flex; gap: 10px; flex-wrap: wrap; }
    .mini-stat {
        background: rgba(255,255,255,0.04);
        padding: 10px 14px;
        border-radius: 8px;
        text-align: center;
        flex: 1;
        min-width: 70px;
        border: 1px solid rgba(255,255,255,0.02);
    }
    .ms-value { display: block; font-size: 1.1rem; font-weight: 700; color: #fff; margin-bottom: 2px; }
    .ms-label { font-size: 0.65rem; color: #888; }

    /* Transport */
    .transport-list { display: flex; flex-direction: column; gap: 10px; }
    .transport-row { display: flex; align-items: center; gap: 12px; padding: 2px 0; }
    .tr-icon { font-size: 1.1rem; width: 28px; text-align: center; }
    .tr-label { width: 110px; font-size: 0.8rem; color: #aaa; }
    .tr-value { width: 40px; font-size: 0.8rem; color: #ccc; text-align: right; }

    /* Energy */
    .energy-grid { display: flex; justify-content: space-between; gap: 12px; }
    .energy-item {
        text-align: center;
        padding: 16px 10px;
        background: rgba(255,255,255,0.04);
        border-radius: 10px;
        flex: 1;
        transition: all 0.2s;
        border: 1px solid transparent;
    }
    .energy-item.dominant {
        background: rgba(255, 140, 66, 0.15);
        border-color: rgba(255, 140, 66, 0.3);
        box-shadow: 0 4px 12px rgba(255, 140, 66, 0.1);
    }
    .e-icon { font-size: 1.8rem; display: block; margin-bottom: 8px; }
    .e-value { display: block; font-size: 1.3rem; font-weight: 700; color: #fff; margin-bottom: 2px; }
    .e-label { font-size: 0.7rem; color: #999; }

    .no-data { color: #666; font-size: 0.85rem; text-align: center; padding: 30px; font-style: italic; }

    /* Scrollbar */
    .sidebar-content::-webkit-scrollbar { width: 6px; }
    .sidebar-content::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
    .sidebar-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
    .sidebar-content::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
</style>