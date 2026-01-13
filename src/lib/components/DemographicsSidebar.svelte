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
        householdData
    } from '$lib/stores/lensStore.js';
    import targetIcon from '$lib/assets/icons/target.svg';
    import houseIcon from '$lib/assets/icons/house.svg';
    import buildingIcon from '$lib/assets/icons/building.svg';
    import checkIcon from '$lib/assets/icons/check.svg';
    import squareIcon from '$lib/assets/icons/square.svg';
    import peopleIcon from '$lib/assets/icons/people.svg';
    import briefcaseIcon from '$lib/assets/icons/briefcase.svg';
    import familyIcon from '$lib/assets/icons/family.svg';
    import carIcon from '$lib/assets/icons/car-side-svgrepo-com.svg';
    import flameIcon from '$lib/assets/icons/flame-svgrepo-com.svg';
    import busIcon from '$lib/assets/icons/bus-svgrepo-com.svg';
    import walkIcon from '$lib/assets/icons/walk-svgrepo-com.svg';
    import bikeIcon from '$lib/assets/icons/bike-svgrepo-com.svg';
    import woodIcon from '$lib/assets/icons/fire-wood-svgrepo-com.svg';
    import electricityIcon from '$lib/assets/icons/electricity-bill-svgrepo-com.svg';
    import motorbikeIcon from '$lib/assets/icons/motorbike-motorcycle-scooter-svgrepo-com.svg';
    import gasIcon from '$lib/assets/icons/gas-burner-svgrepo-com.svg';

    // Categories with nested topics
    const categories = [
        {
            id: 'demografia',
            label: 'Demografía',
            icon: peopleIcon,
            topics: ['population', 'age-pyramid']
        },
        {
            id: 'socioeconomico',
            label: 'Socioeconómico',
            icon: briefcaseIcon,
            topics: ['employment', 'literacy']
        },
        {
            id: 'vivienda',
            label: 'Vivienda y Hogares',
            icon: familyIcon,
            topics: ['housing', 'households']
        },
        {
            id: 'transporte',
            label: 'Transporte',
            icon: carIcon,
            topics: []
        },
        {
            id: 'energia',
            label: 'Calefacción',
            icon: flameIcon,
            topics: []
        }
    ];

    // Track expanded categories - demografía expanded by default
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

    // Computed data
    $: migrationData = {
        inmigrantes: $selectedFeatures.reduce((sum, f) => sum + (f.properties?.n_inmigrantes || 0), 0),
        pueblosOrig: $selectedFeatures.reduce((sum, f) => sum + (f.properties?.n_pueblos_orig || 0), 0)
    };

    $: disabilityData = {
        total: $selectedFeatures.reduce((sum, f) => sum + (f.properties?.n_discapacidad || 0), 0),
        ver: $selectedFeatures.reduce((sum, f) => sum + (f.properties?.n_dificultad_ver || 0), 0),
        mover: $selectedFeatures.reduce((sum, f) => sum + (f.properties?.n_dificultad_mover || 0), 0)
    };

    $: transportData = computeTransport($selectedFeatures);

    function computeTransport(features) {
        const modes = [
            { key: 'n_transporte_auto', label: 'Auto', icon: carIcon },
            { key: 'n_transporte_publico', label: 'Transporte Público', icon: busIcon },
            { key: 'n_transporte_camina', label: 'Camina', icon: walkIcon },
            { key: 'n_transporte_bicicleta', label: 'Bicicleta', icon: bikeIcon },
            { key: 'n_transporte_motocicleta', label: 'Moto', icon: motorbikeIcon }
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

    // Get max for chart scaling
    $: ageMax = Math.max(...$ageGroupsData.map(d => d.count), 1);
    $: transportMax = transportData.length > 0 ? Math.max(...transportData.map(d => d.count), 1) : 1;
    $: tenureMax = tenureData.length > 0 ? Math.max(...tenureData.map(d => d.count), 1) : 1;
</script>

<aside class="sidebar">
    <!-- 1. Header con título y conteo -->
    <header class="sidebar-header">
        <h2>Censo 2024</h2>
        <span class="manzanas-count">{$selectedFeatures.length} manzanas</span>
    </header>

    {#if $selectedFeatures.length === 0}
        <div class="empty-state">
            <div class="icon">
                <img src={targetIcon} alt="target" />
            </div>
            <p>Selecciona una dirección o comuna para ver datos</p>
        </div>
    {:else}
        <div class="sidebar-content">
            <!-- 2. Datos principales -->
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

            <div class="separator"></div>

            <!-- 3. Slot para barra de búsqueda -->
            <div class="slot-section">
                <slot name="search"></slot>
            </div>

            <div class="separator"></div>

            <!-- 4. Slot para selector de comunas -->
            <div class="slot-section">
                <slot name="comunas"></slot>
            </div>

            <div class="separator"></div>

            <!-- 5. Slot para Explorar Variables (Heatmap) -->
            <div class="slot-section">
                <slot name="heatmap"></slot>
            </div>

            <div class="separator"></div>

            <!-- 6. Panel con datos (categorías) -->
            <div class="categories">
                {#each categories as cat}
                    <div class="category" class:expanded={expandedCategories[cat.id]}>
                        <button class="category-header" on:click={() => toggleCategory(cat.id)}>
                            <span class="cat-icon">
                                {#if cat.icon.length < 5}
                                    {cat.icon}
                                {:else}
                                    <img src={cat.icon} alt={cat.label} />
                                {/if}
                            </span>
                            <span class="cat-label">{cat.label}</span>
                            <span class="chevron">{expandedCategories[cat.id] ? '▼' : '▶'}</span>
                        </button>

                        {#if expandedCategories[cat.id]}
                            <div class="category-content">
                                <!-- Si tiene topics, mostrar píldoras -->
                                {#if cat.topics.length > 0}
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
                                {/if}

                                <div class="topic-data">
                                    {#if cat.id === 'demografia'}
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
                                                    <span class="subsection-title">Población y Origen</span>
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
                                        {/if}

                                    {:else if cat.id === 'socioeconomico'}
                                        {#if $activeTopic === 'employment'}
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
                                        {/if}

                                    {:else if cat.id === 'vivienda'}
                                        {#if $activeTopic === 'housing'}
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

                                    {:else if cat.id === 'transporte'}
                                        {#if transportData.length > 0}
                                            <div class="transport-list">
                                                {#each transportData as t}
                                                    <div class="transport-row">
                                                        <span class="tr-icon">
                                                            {#if t.icon.length < 5}
                                                                {t.icon}
                                                            {:else}
                                                                <img src={t.icon} alt={t.label} />
                                                            {/if}
                                                        </span>
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

                                    {:else if cat.id === 'energia'}
                                        <div class="energy-grid">
                                            <div class="energy-item" class:dominant={energyData.lena > energyData.gas && energyData.lena > energyData.electricidad}>
                                                <span class="e-icon">
                                                    <img src={woodIcon} alt="Leña" />
                                                </span>
                                                <span class="e-value">{energyData.lena}</span>
                                                <span class="e-label">Leña</span>
                                            </div>
                                            <div class="energy-item" class:dominant={energyData.gas > energyData.lena && energyData.gas > energyData.electricidad}>
                                                <span class="e-icon">
                                                    <img src={gasIcon} alt="Gas" />
                                                </span>
                                                <span class="e-value">{energyData.gas}</span>
                                                <span class="e-label">Gas</span>
                                            </div>
                                            <div class="energy-item" class:dominant={energyData.electricidad > energyData.lena && energyData.electricidad > energyData.gas}>
                                                <span class="e-icon">
                                                    <img src={electricityIcon} alt="Eléctrica" />
                                                </span>
                                                <span class="e-value">{energyData.electricidad}</span>
                                                <span class="e-label">Eléctrica</span>
                                            </div>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {/if}
                    </div>

                    <!-- Separador entre categorías -->
                    {#if cat.id !== 'energia'}
                        <div class="separator"></div>
                    {/if}
                {/each}
            </div>
        </div>
    {/if}
</aside>

<style>
    .sidebar {
        width: 380px;
        background: #1a1a1a !important;
        color: #fff;
        display: flex;
        flex-direction: column;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        max-height: calc(100vh - 32px);
    }

    .sidebar-header {
        padding: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .sidebar-header h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 700;
        color: #fff;
    }

    .manzanas-count {
        background: rgba(255, 204, 5, 0.2);
        border: 1px solid #ffcc05;
        color: #ffcc05;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 24px;
        text-align: center;
        color: rgba(255, 255, 255, 0.6);
    }

    .empty-state .icon {
        width: 64px;
        height: 64px;
        margin-bottom: 16px;
        opacity: 0.4;
    }

    .empty-state .icon img {
        width: 100%;
        height: 100%;
        filter: invert(1);
    }

    .empty-state p {
        margin: 0;
        font-size: 0.9rem;
        line-height: 1.4;
    }

    .sidebar-content {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        min-height: 0;
    }

    /* Quick stats */
    .quick-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        padding: 20px 16px;
    }

    .quick-stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
    }

    .qs-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: #ffcc05;
        margin-bottom: 4px;
    }

    .qs-label {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.7);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    /* Separator */
    .separator {
        height: 1px;
        background: rgba(255, 255, 255, 0.1);
        margin: 10px 10px;
    }

    /* Slot sections */
    .slot-section {
        padding: 12px 16px;
        max-width: 100%;
        overflow: hidden;
    }

    /* Global styles for slot content */
    .slot-section :global(*) {
        max-width: 100%;
        box-sizing: border-box;
    }

    /* Categories */
    .categories {
        padding: 12px 16px 16px 16px;
    }

    .category {
        margin-bottom: 0;
    }

    .category-header {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 0;
        background: none;
        border: none;
        color: #fff;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .category-header:hover {
        color: #ffcc05;
    }

    .cat-icon {
        font-size: 1.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .cat-icon img {
        width: 20px;
        height: 20px;
        filter: brightness(0) invert(1);
    }

    .cat-label {
        flex: 1;
        text-align: left;
        font-size: 0.95rem;
        font-weight: 600;
    }

    .chevron {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.5);
        transition: transform 0.2s ease;
    }

    .category.expanded .chevron {
        transform: rotate(0deg);
    }

    .category-content {
        padding: 12px 0 0 0;
    }

    /* Topic pills */
    .topic-pills {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
        flex-wrap: wrap;
    }

    .topic-pill {
        padding: 8px 16px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
    }

    .topic-pill:hover {
        background: rgba(255, 204, 5, 0.1);
        border-color: rgba(255, 204, 5, 0.3);
        color: #ffcc05;
    }

    .topic-pill.active {
        background: #ffcc05;
        border-color: #ffcc05;
        color: #0F2854;
        font-weight: 600;
    }

    .topic-data {
        margin-top: 12px;
    }

    /* Gender split */
    .gender-split {
        margin-bottom: 16px;
    }

    .gender-bar {
        height: 8px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        overflow: hidden;
        display: flex;
        margin-bottom: 12px;
    }

    .gender-fill {
        height: 100%;
        transition: width 0.3s ease;
    }

    .gender-fill.male {
        background: #4a9eff;
    }

    .gender-fill.female {
        background: #ff6b9d;
    }

    .gender-legend {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .gl-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.9);
    }

    .dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
    }

    .dot.male {
        background: #4a9eff;
    }

    .dot.female {
        background: #ff6b9d;
    }

    /* Age bars */
    .age-bars {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .age-row {
        display: grid;
        grid-template-columns: 50px 1fr 60px;
        align-items: center;
        gap: 10px;
    }

    .age-label {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.7);
    }

    .bar-track {
        height: 20px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 10px;
        overflow: hidden;
        position: relative;
    }

    .bar-track.small {
        height: 16px;
    }

    .bar-fill {
        height: 100%;
        background: #ffcc05;
        border-radius: 10px;
        transition: width 0.3s ease;
    }

    .bar-fill.good {
        background: #4ade80;
    }

    .bar-fill.bad {
        background: #ef4444;
    }

    .age-count {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.9);
        text-align: right;
    }

    /* Employment */
    .employment-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
    }

    .emp-card {
        padding: 12px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        text-align: center;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .emp-card.good {
        border-color: rgba(74, 222, 128, 0.3);
        background: rgba(74, 222, 128, 0.05);
    }

    .emp-card.bad {
        border-color: rgba(239, 68, 68, 0.3);
        background: rgba(239, 68, 68, 0.05);
    }

    .emp-card.neutral {
        border-color: rgba(255, 204, 5, 0.2);
        background: rgba(255, 204, 5, 0.05);
    }

    .emp-value {
        display: block;
        font-size: 1.25rem;
        font-weight: 700;
        color: #fff;
        margin-bottom: 4px;
    }

    .emp-label {
        display: block;
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.7);
        margin-bottom: 2px;
    }

    .emp-pct {
        display: block;
        font-size: 0.75rem;
        color: #ffcc05;
        font-weight: 600;
    }

    /* Literacy */
    .literacy-bars {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .lit-row {
        display: grid;
        grid-template-columns: 100px 1fr 50px;
        align-items: center;
        gap: 10px;
    }

    .lit-label {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.9);
    }

    .lit-value {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.9);
        text-align: right;
    }

    /* Housing */
    .housing-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }

    .house-card {
        padding: 12px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .house-card img {
        width: 24px;
        height: 24px;
        filter: invert(1);
        opacity: 0.8;
    }

    .hc-value {
        font-size: 1.1rem;
        font-weight: 700;
        color: #fff;
    }

    .hc-label {
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.7);
    }

    /* Households */
    .hh-stats {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .hh-main {
        text-align: center;
        padding: 16px;
        background: rgba(255, 204, 5, 0.1);
        border-radius: 8px;
        border: 1px solid rgba(255, 204, 5, 0.2);
    }

    .hh-value {
        display: block;
        font-size: 1.75rem;
        font-weight: 700;
        color: #ffcc05;
        margin-bottom: 4px;
    }

    .hh-label {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.8);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .hh-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
    }

    .hh-item {
        padding: 10px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 6px;
        text-align: center;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .hh-item.highlight {
        border-color: rgba(255, 204, 5, 0.3);
        background: rgba(255, 204, 5, 0.05);
    }

    .hhi-value {
        display: block;
        font-size: 1rem;
        font-weight: 700;
        color: #fff;
        margin-bottom: 4px;
    }

    .hhi-label {
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.7);
    }

    /* Subsections */
    .subsection {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    .subsection-title {
        display: block;
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 10px;
        font-weight: 600;
    }

    .mini-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
    }

    .mini-stat {
        padding: 10px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 6px;
        text-align: center;
    }

    .ms-value {
        display: block;
        font-size: 1rem;
        font-weight: 700;
        color: #fff;
        margin-bottom: 4px;
    }

    .ms-label {
        font-size: 0.65rem;
        color: rgba(255, 255, 255, 0.7);
    }

    /* Transport */
    .transport-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .transport-row {
        display: grid;
        grid-template-columns: 30px 110px 1fr 50px;
        align-items: center;
        gap: 10px;
    }

    .tr-icon {
        font-size: 1.25rem;
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .tr-icon img {
        width: 20px;
        height: 20px;
        filter: brightness(0) invert(1);
    }

    .tr-label {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.9);
    }

    .tr-value {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.9);
        text-align: right;
    }

    /* Energy */
    .energy-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
    }

    .energy-item {
        padding: 12px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        text-align: center;
        transition: all 0.2s;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .energy-item.dominant {
        background: rgba(255, 204, 5, 0.15);
        border-color: rgba(255, 204, 5, 0.4);
    }

    .e-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        margin-bottom: 6px;
    }

    .e-icon img {
        width: 24px;
        height: 24px;
        filter: brightness(0) invert(1);
    }

    .e-value {
        display: block;
        font-size: 1.1rem;
        font-weight: 700;
        color: #fff;
        margin-bottom: 4px;
    }

    .e-label {
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.7);
    }

    .tenure-bars {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .tenure-row {
        display: grid;
        grid-template-columns: 100px 1fr 40px;
        align-items: center;
        gap: 10px;
    }

    .t-label {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.9);
    }

    .t-value {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.9);
        text-align: right;
    }

    .no-data {
        text-align: center;
        color: rgba(255, 255, 255, 0.4);
        font-size: 0.8rem;
        padding: 20px;
        margin: 0;
    }

    /* Scrollbar - OCULTA pero funcional */
    .sidebar-content {
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* IE/Edge */
    }

    .sidebar-content::-webkit-scrollbar {
        display: none; /* Chrome/Safari/Opera */
    }
</style>