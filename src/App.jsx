import { useState, useEffect, useRef } from "react";
import heroImg from "./assets/geoportal_header.jpg";
import reactLogo from "./assets/react.svg";
import viteLogo from "./assets/vite.svg";
import "./App.css";

import Header from "./components/Layout/Header";
import Sidebar from "./components/Layout/Sidebar";
import MapView from "./components/Map/MapView";
import StackedBarChart from "./components/Charts/StackedBarChart";

function App() {
    const [layers, setLayers] = useState({
        points: true,
        pointsOpacity: 0.5,
    });

    const [chartEstadoData, setChartEstadoData] = useState([]);
    const [chartTipoData, setChartTipoData] = useState([]);

    const FEATURE_SERVICE =
        "https://services6.arcgis.com/VhaZpxaKWh8z652A/arcgis/rest/services/FS_Demo3D/FeatureServer";

    const [selectedLayers, setSelectedLayers] = useState(new Set());
    const [serviceLayers, setServiceLayers] = useState(null);
    const [serviceTables, setServiceTables] = useState(null);
    const [serviceError, setServiceError] = useState(null);
    const [lastClickedLayer, setLastClickedLayer] = useState(null);
    const [layerDetails, setLayerDetails] = useState({});
    const [vectorStyles, setVectorStyles] = useState({});
    const [projectOptions, setProjectOptions] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [panEnabled, setPanEnabled] = useState(true);

    const [indicators, setIndicators] = useState({
        totalLotes: 0,
        distinctCodigos: 0,
        lotesWithComercial: 0,
        active: 0,
        inactive: 0,
        proyectosCount: 0,
    });

    const [indicatorError, setIndicatorError] = useState(null);

    // Load FeatureServer metadata and project options.
    useEffect(() => {
        let cancelled = false;

    async function loadServiceMetadata() {
            try {
                const response = await fetch(`${FEATURE_SERVICE}?f=json`);
                if (!response.ok) {
                    throw new Error(`Service metadata request failed: ${response.status}`);
                }

                const data = await response.json();
                if (data.error) {
                    throw new Error(data.error.message || "ArcGIS service error");
                }

                const byId = new Map();
                (data.layers || []).forEach((layer) => {
                    byId.set(layer.id, { ...layer });
                });

                const roots = [];

                byId.forEach((layer) => {
                    if (
                        layer.parentLayerId != null &&
                        layer.parentLayerId !== -1 &&
                        byId.has(layer.parentLayerId)
                    ) {
                        const parent = byId.get(layer.parentLayerId);
                        parent.children = parent.children || [];
                        parent.children.push(layer);
                    } else {
                        roots.push(layer);
                    }
                });

                if (!cancelled) {
                    setServiceLayers(roots);
                    setServiceTables(data.tables || []);
                    setServiceError(null);
                }
            } catch (error) {
                if (!cancelled) {
                    setServiceLayers(null);
                    setServiceError(String(error));
                }
            }
        }

        async function loadProjectOptions() {
            try {
                const body = new URLSearchParams({
                    where: "1=1",
                    returnDistinctValues: "true",
                    outFields: "PROYECTO",
                    returnGeometry: "false",
                    f: "json",
                });

                const response = await fetch(`${FEATURE_SERVICE}/6/query`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body,
                });

                const data = await response.json();

                if (data.error) {
                    throw new Error(data.error.message || "Project query failed");
                }

                const values = (data.features || [])
                    .map((feature) => feature.attributes?.PROYECTO)
                    .filter((value) => value != null && value !== "");

                if (!cancelled) {
                    setProjectOptions([...new Set(values)]);
                }
            } catch (error) {
                console.error("Failed to load project options:", error);
                if (!cancelled) setProjectOptions([]);
            }
        }

        loadServiceMetadata();
        loadProjectOptions();

        return () => {
            cancelled = true;
        };
    }, []);

    function escapeSqlString(value) {
        return String(value).replace(/'/g, "''");
    }

    // Compute the dashboard indicators whenever the selected project changes.
    useEffect(() => {
        let cancelled = false;

        async function postQuery(layerId, params) {
            const body = new URLSearchParams(params);

            const response = await fetch(
                `${FEATURE_SERVICE}/${layerId}/query`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body,
                }
            );

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error.message || `Query failed for layer ${layerId}`);
            }

            return data;
        }

        async function computeIndicators() {
            try {
                setIndicatorError(null);

                // Wait for service metadata (layers/tables) to be available before running chart queries
                if (!serviceLayers && !serviceTables) return;

                // helper to find a layer id by name in the loaded serviceLayers tree
                function findLayerIdByName(name, nodes) {
                    if (!nodes) return null;
                    for (const node of nodes) {
                        if ((node.name || '').toLowerCase() === String(name).toLowerCase()) return node.id;
                        if (node.children && node.children.length > 0) {
                            const found = findLayerIdByName(name, node.children);
                            if (found != null) return found;
                        }
                    }
                    return null;
                }

                // table lookup helpers (parallel to layer helpers)
                function findTableIdByName(name, tables) {
                    if (!tables) return null;
                    for (const t of tables) {
                        if ((t.name || '').toLowerCase() === String(name).toLowerCase()) return t.id;
                    }
                    return null;
                }

                function findTableIdByField(fieldNames, tables) {
                    if (!tables) return null;
                    const target = (Array.isArray(fieldNames) ? fieldNames : [fieldNames]).map(s => String(s).toLowerCase());
                    for (const t of tables) {
                        const fields = t.fields || [];
                        for (const f of fields) {
                            if (f && f.name && target.includes(String(f.name).toLowerCase())) {
                                return t.id;
                            }
                        }
                    }
                    return null;
                }

                // helper: find layer id by presence of one or more field names in layer metadata
                function findLayerIdByField(fieldNames, nodes) {
                    if (!nodes) return null;
                    const target = (Array.isArray(fieldNames) ? fieldNames : [fieldNames]).map(s => String(s).toLowerCase());
                    for (const node of nodes) {
                        const fields = node.fields || [];
                        for (const f of fields) {
                            if (f && f.name && target.includes(String(f.name).toLowerCase())) {
                                return node.id;
                            }
                        }
                        if (node.children && node.children.length > 0) {
                            const found = findLayerIdByField(fieldNames, node.children);
                            if (found != null) return found;
                        }
                    }
                    return null;
                }

                // helper to robustly read an attribute value regardless of case variations
                function attrValue(attributes, fieldName) {
                    if (!attributes || !fieldName) return undefined;
                    if (attributes[fieldName] !== undefined) return attributes[fieldName];
                    const lower = String(fieldName).toLowerCase();
                    for (const k of Object.keys(attributes)) {
                        if (k && k.toLowerCase() === lower) return attributes[k];
                    }
                    return undefined;
                }

                if (!selectedProject) {
                    const [
                        lotesCount,
                        distinctCodes,
                        constructionSum,
                        availableCount,
                        areaSum,
                        projectsCount,
                    ] = await Promise.all([
                        postQuery("4", {
                            where: "1=1",
                            returnCountOnly: "true",
                            f: "json",
                        }),
                        postQuery("4", {
                            where: "1=1",
                            returnDistinctValues: "true",
                            outFields: "CODIGO",
                            returnGeometry: "false",
                            resultRecordCount: "2000",
                            f: "json",
                        }),
                        postQuery("8", {
                            where: "1=1",
                            outStatistics: JSON.stringify([
                                {
                                    statisticType: "sum",
                                    onStatisticField: "Metros_Construccion",
                                    outStatisticFieldName: "sum_metros",
                                },
                            ]),
                            f: "json",
                        }),
                        postQuery("8", {
                            where: "UPPER(ESTADO) LIKE '%DISPONIBLE%'",
                            returnCountOnly: "true",
                            f: "json",
                        }),
                        postQuery("4", {
                            where: "1=1",
                            outStatistics: JSON.stringify([
                                {
                                    statisticType: "sum",
                                    onStatisticField: "AREA_M2",
                                    outStatisticFieldName: "sum_area",
                                },
                            ]),
                            f: "json",
                        }),
                        postQuery("6", {
                            where: "1=1",
                            returnCountOnly: "true",
                            f: "json",
                        }),
                    ]);


                    if (cancelled) return;

                    // Determine Departamentos count by matching COD_PARCELA to CODIGO values from lotes
                    let departamentosCount = 0;
                    try {
                        const deptId = findLayerIdByName('Departamentos', serviceLayers || []);
                        if (deptId != null) {
                            const codes = (distinctCodes.features || [])
                                .map((f) => f.attributes?.CODIGO)
                                .filter((v) => v != null);

                            if (codes.length > 0) {
                                const codeList = codes
                                    .slice(0, 800)
                                    .map((c) => `'${String(c).replace(/'/g, "''")}'`)
                                    .join(',');
                                const whereCodes = `COD_PARCELA IN (${codeList})`;
                                try {
                                    const deptResp = await postQuery(String(deptId), {
                                        where: whereCodes,
                                        returnCountOnly: 'true',
                                        f: 'json',
                                    });
                                    departamentosCount = Number(deptResp.count || 0);
                                } catch (e) {
                                    console.warn('Departamentos count by relationship failed', e);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('Failed to get Departamentos count', e);
                    }

                    setIndicators({
                        totalLotes: Number(lotesCount.count || 0),
                        // show number of entities in Departamentos layer instead of distinct CODIGO
                        distinctCodigos: departamentosCount,
                        lotesWithComercial: Number(
                            constructionSum.features?.[0]?.attributes?.sum_metros || 0
                        ),
                        active: Number(availableCount.count || 0),
                        inactive: Number(
                            areaSum.features?.[0]?.attributes?.sum_area || 0
                        ),
                        proyectosCount: Number(projectsCount.count || 0),
                    });

                    return;
                }

                const projectLayerWhere = `PROYECTO='${escapeSqlString(selectedProject)}'`;
                const projectTableWhere = `Proyecto='${escapeSqlString(selectedProject)}'`;


                const lotesResponse = await postQuery("4", {
                    where: projectLayerWhere,
                    outFields: "CODIGO",
                    returnGeometry: "false",
                    resultRecordCount: "2000",
                    f: "json",
                });

                const lotes = lotesResponse.features || [];
                const codigos = [
                    ...new Set(
                        lotes
                            .map((feature) => feature.attributes?.CODIGO)
                            .filter((value) => value != null)
                    ),
                ];

                let sumMetros = 0;
                let countDisponibles = 0;

                if (codigos.length > 0) {
                    // Limit the IN clause to avoid excessively long queries.
                    const codeList = codigos
                        .slice(0, 800)
                        .map((code) => `'${String(code).replace(/'/g, "''")}'`)
                        .join(",");

                    const whereCodes = `CODIGO IN (${codeList})`;

                    const [sumResponse, availableResponse] = await Promise.all([
                        postQuery("8", {
                            where: whereCodes,
                            outStatistics: JSON.stringify([
                                {
                                    statisticType: "sum",
                                    onStatisticField: "Metros_Construccion",
                                    outStatisticFieldName: "sum_metros",
                                },
                            ]),
                            f: "json",
                        }),
                        postQuery("8", {
                            where: `${whereCodes} AND UPPER(ESTADO) LIKE '%DISPONIBLE%'`,
                            returnCountOnly: "true",
                            f: "json",
                        }),
                    ]);

                    sumMetros = Number(
                        sumResponse.features?.[0]?.attributes?.sum_metros || 0
                    );
                    countDisponibles = Number(availableResponse.count || 0);
                }

                const [areaResponse, projectsResponse] = await Promise.all([
                    postQuery("4", {
                        where: projectLayerWhere,
                        outStatistics: JSON.stringify([
                            {
                                statisticType: "sum",
                                onStatisticField: "AREA_M2",
                                outStatisticFieldName: "sum_area",
                            },
                        ]),
                        f: "json",
                    }),
                    postQuery("6", {
                        where: projectLayerWhere,
                        returnCountOnly: "true",
                        f: "json",
                    }),
                ]);

                if (cancelled) return;

                // Also compute Departamentos count related to the selected project's lotes
                let departamentosCountForProject = 0;
                try {
                    const deptId = findLayerIdByName('Departamentos', serviceLayers || []);
                    if (deptId != null && codigos.length > 0) {
                        const codeListForDept = codigos
                            .slice(0, 800)
                            .map((c) => `'${String(c).replace(/'/g, "''")}'`)
                            .join(',');
                        const whereDept = `COD_PARCELA IN (${codeListForDept})`;
                        try {
                            const deptResp = await postQuery(String(deptId), {
                                where: whereDept,
                                returnCountOnly: 'true',
                                f: 'json',
                            });
                            departamentosCountForProject = Number(deptResp.count || 0);
                        } catch (e) {
                            console.warn('Departamentos count by relationship failed', e);
                        }
                    }
                } catch (e) {
                    console.warn('Failed to get Departamentos count', e);
                }

                setIndicators({
                    totalLotes: lotes.length,
                    distinctCodigos: departamentosCountForProject,
                    lotesWithComercial: sumMetros,
                    active: countDisponibles,
                    inactive: Number(
                        areaResponse.features?.[0]?.attributes?.sum_area || 0
                    ),
                    proyectosCount: Number(projectsResponse.count || 0),
                });

                // Charts for selected project: breakdown by relation (lotes / departamentos / other)
                try {
                    // Try to find data_comercial first among layers then tables, by name or by field presence
                    let dataComId = findLayerIdByName('data_comercial', serviceLayers || []);
                    let dataComType = 'layer';

                    if (dataComId == null) {
                    dataComId = findLayerIdByField(['Estado', 'Tipo_De_Venta'], serviceLayers || []);
                        if (dataComId != null) {
                            dataComType = 'layer';
                        }
                    }

                    // If not found in layers, try tables
                    if (dataComId == null) {
                        dataComId = findTableIdByName('data_comercial', serviceTables || []);
                        if (dataComId != null) {
                            dataComType = 'table';
                        }
                    }

                    if (dataComId == null) {
                        dataComId = findTableIdByField(['Estado', 'Tipo_De_Venta'], serviceTables || []);
                        if (dataComId != null) {
                            dataComType = 'table';
                        }
                    }

                    if (dataComId != null) {
                        console.info(`[computeIndicators] using data_comercial id=${dataComId} type=${dataComType}`);
                        const whereBase = projectTableWhere || '1=1';

                        // total by ESTADO
                        const estadoParams = {
                            where: whereBase,
                            groupByFieldsForStatistics: 'Estado',
                            outStatistics: JSON.stringify([{ statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'cnt' }]),
                            f: 'json',
                        };
                        console.info(`[computeIndicators] querying data_comercial (Estado) layer=${dataComId} params=`, estadoParams);
                        const totalByEstado = await postQuery(String(dataComId), estadoParams);


                        // by ESTADO and linked to lotes via CODIGO (data_comercial.CODIGO)
                        let lotesByEstado = { features: [] };
                        if (codigos.length > 0) {
                            const codeList = codigos.slice(0,800).map(c => `'${String(c).replace(/'/g, "''")}'`).join(',');
                            const whereLotes = `${projectLayerWhere} AND CODIGO IN (${codeList})`;
                            const lotesEstadoParams = {
                                where: whereLotes,
                                groupByFieldsForStatistics: 'Estado',
                                outStatistics: JSON.stringify([{ statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'cnt' }]),
                                f: 'json',
                            };
                            console.info(`[computeIndicators] querying data_comercial for lotes by ESTADO layer=${dataComId} params=`, lotesEstadoParams);
                            lotesByEstado = await postQuery(String(dataComId), lotesEstadoParams);

                        }

                        // by ESTADO and linked to departamentos via COD_PARCELA
                        let deptByEstado = { features: [] };
                        if (codigos.length > 0) {
                            const codeList = codigos.slice(0,800).map(c => `'${String(c).replace(/'/g, "''")}'`).join(',');
                            const whereDept = `${projectLayerWhere} AND CODIGO IN (${codeList})`;
                            const deptEstadoParams = {
                                where: whereDept,
                                groupByFieldsForStatistics: 'Estado',
                                outStatistics: JSON.stringify([{ statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'cnt' }]),
                                f: 'json',
                            };
                            console.info(`[computeIndicators] querying data_comercial for departamentos by ESTADO layer=${dataComId} params=`, deptEstadoParams);
                            deptByEstado = await postQuery(String(dataComId), deptEstadoParams);

                        }

                        // Build combined dataset
                        const totals = (totalByEstado.features || []).map(f => ({ estado: attrValue(f.attributes, 'Estado') || 'Unknown', total: Number(attrValue(f.attributes, 'cnt') || 0) }));

                        const lotesMap = new Map((lotesByEstado.features || []).map(f => [attrValue(f.attributes, 'Estado') || 'Unknown', Number(attrValue(f.attributes, 'cnt') || 0)]));
                        const deptMap = new Map((deptByEstado.features || []).map(f => [attrValue(f.attributes, 'Estado') || 'Unknown', Number(attrValue(f.attributes, 'cnt') || 0)]));

                        const combined = totals.map(t => {
                            const l = lotesMap.get(t.estado) || 0;
                            const d = deptMap.get(t.estado) || 0;
                            const other = Math.max(0, t.total - l - d);
                            return { estado: t.estado, lotes: l, departamentos: d, other, total: t.total };
                        });

                        setChartEstadoData(combined);

                        // Tipo_De_Venta chart (grouped similarly)
                        const tipoParams = {
                            where: projectTableWhere,
                            groupByFieldsForStatistics: 'Tipo_De_Venta', // normalize field name
                            outStatistics: JSON.stringify([{ statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'cnt' }]),
                            f: 'json',
                        };
                        console.info(`[computeIndicators] querying data_comercial (Tipo_De_Venta) layer=${dataComId} params=`, tipoParams);
                        const totalByTipo = await postQuery(String(dataComId), tipoParams);


                        const lotesTipoParams = (codigos.length>0) ? {
                            where: `${whereBase} AND CODIGO IN (${codigos.slice(0,800).map(c=>`'${String(c).replace(/'/g,"''")}'`).join(',')})`,
                            groupByFieldsForStatistics: 'Tipo_De_Venta', // normalize field name
                            outStatistics: JSON.stringify([{ statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'cnt' }]),
                            f: 'json',
                        } : null;

                        if (lotesTipoParams) {
                            console.info(`[computeIndicators] querying data_comercial for lotes by Tipo_De_Venta layer=${dataComId} params=`, lotesTipoParams);
                            var lotesByTipo = await postQuery(String(dataComId), lotesTipoParams);

                        } else {
                            var lotesByTipo = { features: [] };
                        }

                        const deptTipoParams = (codigos.length>0) ? {
                            where: `${whereBase} AND CODIGO IN (${codigos.slice(0,800).map(c=>`'${String(c).replace(/'/g,"''")}'`).join(',')})`,
                            groupByFieldsForStatistics: 'Tipo_De_Venta', // normalize field name
                            outStatistics: JSON.stringify([{ statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'cnt' }]),
                            f: 'json',
                        } : null;

                        if (deptTipoParams) {
                            console.info(`[computeIndicators] querying data_comercial for departamentos by Tipo_De_Venta layer=${dataComId} params=`, deptTipoParams);
                            var deptByTipo = await postQuery(String(dataComId), deptTipoParams);

                        } else {
                            var deptByTipo = { features: [] };
                        }

                        const totalTipo = (totalByTipo.features || []).map(f=>({ tipo: attrValue(f.attributes, 'Tipo_De_Venta') || 'Unknown', total: Number(attrValue(f.attributes, 'cnt') || 0) }));
                        const lTipoMap = new Map((lotesByTipo.features || []).map(f=>[attrValue(f.attributes, 'Tipo_De_Venta') || 'Unknown', Number(attrValue(f.attributes, 'cnt') || 0)]));
                        const dTipoMap = new Map((deptByTipo.features || []).map(f=>[attrValue(f.attributes, 'Tipo_De_Venta') || 'Unknown', Number(attrValue(f.attributes, 'cnt') || 0)]));

                        const tipoCombined = totalTipo.map(t=>{
                            const l = lTipoMap.get(t.tipo) || 0;
                            const d = dTipoMap.get(t.tipo) || 0;
                            const other = Math.max(0, t.total - l - d);
                            return { tipo: t.tipo, lotes: l, departamentos: d, other, total: t.total };
                        });

                        setChartTipoData(tipoCombined);
                    }
                } catch (e) { console.warn('Failed to compute charts for project', e); }
            } catch (error) {
                if (!cancelled) {
                    console.error("Failed computing indicators:", error);
                    setIndicatorError(String(error));
                }
            }
        }

        computeIndicators();

        return () => {
            cancelled = true;
        };
    }, [selectedProject, serviceLayers, serviceTables]);

    function handleToggle(id, checked) {
        setSelectedLayers((previous) => {
            const next = new Set(previous);

            if (checked) {
                setVectorStyles((previousStyles) => {
                    const nextStyles = { ...previousStyles };
                    delete nextStyles[id];
                    return nextStyles;
                });

                if (!layerDetails[id]) {
                    fetch(`${FEATURE_SERVICE}/${id}?f=json`)
                        .then((response) => response.json())
                        .then((data) => {
                            if (data.error) {
                                throw new Error(data.error.message);
                            }

                            setLayerDetails((previousDetails) => ({
                                ...previousDetails,
                                [id]: data,
                            }));
                        })
                        .catch((error) => {
                            console.warn(
                                `[Layer details fetch failed] id=${id}`,
                                error
                            );
                        });
                }

                next.add(id);
            } else {
                next.delete(id);
            }

            return next;
        });
    }

    function handleLayerClick(layer) {
        setLastClickedLayer(layer);

        if (!layerDetails[layer.id]) {
            fetch(`${FEATURE_SERVICE}/${layer.id}?f=json`)
                .then((response) => response.json())
                .then((data) => {
                    setLayerDetails((previous) => ({
                        ...previous,
                        [layer.id]: data,
                    }));
                })
                .catch((error) => {
                    console.warn("Failed to load layer details:", error);
                });
        }
    }

    async function applyStyleByField(
        layerId,
        fieldName,
        predefinedStyleMap = null
    ) {
        if (!fieldName) return;

        try {
            let styleMap = predefinedStyleMap;

            if (!styleMap) {
                const body = new URLSearchParams({
                    where: "1=1",
                    returnDistinctValues: "true",
                    outFields: fieldName,
                    returnGeometry: "false",
                    f: "json",
                });

                const response = await fetch(`${FEATURE_SERVICE}/${layerId}/query`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body,
                });

                const data = await response.json();

                if (data.error) {
                    throw new Error(data.error.message || "Distinct values query failed");
                }

                const values = (data.features || [])
                    .map((feature) => feature.attributes?.[fieldName])
                    .filter((value) => value != null);

                styleMap = {};

                [...new Set(values)].forEach((value, index) => {
                    const hue = Math.round((index * 137.5) % 360);
                    styleMap[value] = `hsl(${hue} 70% 50%)`;
                });
            }

            const details =
                layerDetails[layerId] ||
                (await fetch(`${FEATURE_SERVICE}/${layerId}?f=json`).then((r) =>
                    r.json()
                ));

            setLayerDetails((previous) => ({
                ...previous,
                [layerId]: details,
            }));

            setVectorStyles((previous) => ({
                ...previous,
                [layerId]: {
                    field: fieldName,
                    styleMap,
                    geometryType: details.geometryType || null,
                },
            }));
        } catch (error) {
            console.error("Failed to apply layer style:", error);
        }
    }

    function clearStyle(layerId) {
        setVectorStyles((previous) => {
            const next = { ...previous };
            delete next[layerId];
            return next;
        });
    }

    // StackedBarChart moved to src/components/Charts/StackedBarChart.jsx

    function CountUp({ value }) {
        const [display, setDisplay] = useState(0);
        const raf = useRef(null);

        useEffect(() => {
            const start = performance.now();
            const duration = 900;
            const target = Number(value) || 0;

            if (raf.current) cancelAnimationFrame(raf.current);

            function step(now) {
                const progress = Math.min(1, (now - start) / duration);
                const current = target * progress;

                setDisplay(Number(current.toFixed(1)));

                if (progress < 1) {
                    raf.current = requestAnimationFrame(step);
                } else {
                    setDisplay(target);
                }
            }

            raf.current = requestAnimationFrame(step);

            return () => {
                if (raf.current) cancelAnimationFrame(raf.current);
            };
        }, [value]);

        return (
            <div className="indicator-number">
                {Number(display).toLocaleString("en-US", {
                    maximumFractionDigits: 1,
                    minimumFractionDigits: 1,
                })}
            </div>
        );
    }

    return (
        <>
            <section id="center">
                <div className="header_image">
                    <img
                        src={heroImg}
                        className="img_bkg"
                        alt="map background"
                    />
                </div>

                <div className="hero">
                    <h1>Gestión de Proyectos</h1>
                    <p>
                        Desarrollado por el equipo de SIG de Esintegeo Cia. Ltda.,
                        este portal permite la visualización y análisis de proyectos
                        en Ecuador.
                    </p>
                </div>

                {indicatorError && (
                    <div
                        style={{
                            color: "#f88",
                            textAlign: "center",
                            marginTop: 8,
                        }}
                    >
                        Indicators error: {indicatorError}
                    </div>
                )}
            </section>

            <div className="ticks" />

            <Header
                projectOptions={projectOptions}
                selectedProject={selectedProject}
                onSelectProject={setSelectedProject}
                panEnabled={panEnabled}
                onTogglePan={() => setPanEnabled((previous) => !previous)}
            />

            <div className="ticks" />

            {serviceError && (
                <div
                    style={{
                        padding: 8,
                        background: "rgba(255,0,0,0.06)",
                        color: "#f88",
                        margin: "8px 0",
                    }}
                >
                    Service error: {serviceError}
                </div>
            )}

            <section id="indicators-section">
                <div className="indicators-grid">
                    <div className="indicator">
                        <div className="indicator-label">Total Lotes</div>
                        <CountUp value={indicators.totalLotes} />
                    </div>

                    <div className="indicator">
                        <div className="indicator-label">Departamentos</div>
                        <CountUp value={indicators.distinctCodigos} />
                    </div>

                    <div className="indicator">
                        <div className="indicator-label">
                            Metros Construcción (m²)
                        </div>
                        <CountUp value={indicators.lotesWithComercial} />
                    </div>

                    <div className="indicator">
                        <div className="indicator-label">Disponibles</div>
                        <CountUp value={indicators.active} />
                    </div>

                    <div className="indicator">
                        <div className="indicator-label">Área total (m²)</div>
                        <CountUp value={indicators.inactive} />
                    </div>

                    <div className="indicator">
                        <div className="indicator-label">Proyectos Count</div>
                        <CountUp value={indicators.proyectosCount} />
                    </div>
                </div>
            </section>

            <div className="app">
                <div className="app-body">
                    <Sidebar
                        layers={layers}
                        setLayers={setLayers}
                        featureService={FEATURE_SERVICE}
                        serviceLayers={serviceLayers}
                        selectedLayers={selectedLayers}
                        onToggleLayer={handleToggle}
                        onLayerClick={handleLayerClick}
                        layerDetails={layerDetails}
                        onApplyStyle={applyStyleByField}
                        onClearStyle={clearStyle}
                        vectorStyles={vectorStyles}
                        lastClickedLayer={lastClickedLayer}
                    />

                    <main className="map-container">
                        <MapView
                            layers={layers}
                            featureService={FEATURE_SERVICE}
                            selectedLayers={selectedLayers}
                            serviceLayers={serviceLayers}
                            vectorStyles={vectorStyles}
                            layerDetails={layerDetails}
                            selectedProject={selectedProject}
                            panEnabled={panEnabled}
                        />
                    </main>
                </div>
            </div>

            <div className="ticks" />

            {/* Charts section: Data Comercial visualizations */}
            <section id="charts-section" className="charts-section">
                <div className="charts-grid">
                    <div style={{flex:1}}>
                        <StackedBarChart data={chartEstadoData} categoryKey="estado" seriesKeys={["lotes","departamentos","other"]} colors={["#7cb342","#42a5f5","#888888"]} labelKey="Registros por Estado de Venta" />
                    </div>
                    <div style={{flex:1}}>
                        <StackedBarChart data={chartTipoData} categoryKey="tipo" seriesKeys={["lotes","departamentos","other"]} colors={["#f6c343","#f57c42","#888888"]} labelKey="Registros por Tipo de Venta" />
                    </div>
                </div>
            </section>

            <section id="next-steps">
                <div id="docs">
                    <svg
                        className="icon"
                        role="presentation"
                        aria-hidden="true"
                    >
                        <use href="/icons.svg#documentation-icon" />
                    </svg>
                    <h2>Documentation</h2>
                    <p>Your questions, answered</p>
                    <ul>
                        <li>
                            <a href="https://vite.dev/" target="_blank" rel="noreferrer">
                                <img className="logo" src={viteLogo} alt="" />
                                Explore Vite
                            </a>
                        </li>
                        <li>
                            <a href="https://react.dev/" target="_blank" rel="noreferrer">
                                <img
                                    className="button-icon"
                                    src={reactLogo}
                                    alt=""
                                />
                                Learn more
                            </a>
                        </li>
                    </ul>
                </div>

                <div id="social">
                    <svg
                        className="icon"
                        role="presentation"
                        aria-hidden="true"
                    >
                        <use href="/icons.svg#social-icon" />
                    </svg>
                    <h2>Connect with us</h2>
                    <p>Join the Vite community</p>
                    <ul>
                        <li>
                            <a
                                href="https://github.com/vitejs/vite"
                                target="_blank"
                                rel="noreferrer"
                            >
                                <svg
                                    className="button-icon"
                                    role="presentation"
                                    aria-hidden="true"
                                >
                                    <use href="/icons.svg#github-icon" />
                                </svg>
                                GitHub
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://chat.vite.dev/"
                                target="_blank"
                                rel="noreferrer"
                            >
                                <svg
                                    className="button-icon"
                                    role="presentation"
                                    aria-hidden="true"
                                >
                                    <use href="/icons.svg#discord-icon" />
                                </svg>
                                Discord
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://x.com/vite_js"
                                target="_blank"
                                rel="noreferrer"
                            >
                                <svg
                                    className="button-icon"
                                    role="presentation"
                                    aria-hidden="true"
                                >
                                    <use href="/icons.svg#x-icon" />
                                </svg>
                                X.com
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://bsky.app/profile/vite.dev"
                                target="_blank"
                                rel="noreferrer"
                            >
                                <svg
                                    className="button-icon"
                                    role="presentation"
                                    aria-hidden="true"
                                >
                                    <use href="/icons.svg#bluesky-icon" />
                                </svg>
                                Bluesky
                            </a>
                        </li>
                    </ul>
                </div>
            </section>

            <div className="ticks" />
            <section id="spacer"> </section>
        </>
    );
}

export default App;