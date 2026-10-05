import React, { useState, useEffect, useCallback } from "react";
import {
    MapContainer,
    TileLayer,
    useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

import EsriFeatureLayer from "./EsriFeatureLayer";
import MapExtentController from "./MapExtentController";

// Capture the Leaflet map instance from inside MapContainer.
// This avoids relying on the deprecated/unsupported whenCreated prop.
function MapInstanceCapture({ onMapReady }) {
    const map = useMap();

    useEffect(() => {
        console.warn("[MapInstanceCapture] Map instance captured:", !!map);
        onMapReady(map);
    }, [map, onMapReady]);

    return null;
}

function MapView({
    layers,
    featureService,
    selectedLayers = new Set(),
    serviceLayers = [],
    vectorStyles = {},
    layerDetails = {},
    selectedProject = null,
    panEnabled = true,
}) {
    const [map, setMap] = useState(null);

    const handleMapCreated = useCallback((mapInstance) => {
        setMap(mapInstance);
    }, []);

    // Convert ArcGIS color arrays [r, g, b, a] to CSS rgba().
    function colorArrToRgba(arr) {
        if (!Array.isArray(arr) || arr.length < 3) {
            return null;
        }

        const [r, g, b, a] = arr;
        const alpha = a == null ? 1 : a > 1 ? a / 255 : a;

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Extract a CSS color from an ArcGIS symbol.
    function getSymbolColor(symbol) {
        if (!symbol) return null;

        return colorArrToRgba(
            symbol.color || symbol.fill?.color || symbol.outline?.color
        );
    }

    // Convert an ArcGIS symbol to a Leaflet style object.
    function symbolToStyle(symbol, geometryType = null) {
        if (!symbol) return {};

        const symbolType = symbol.type || "";
        const outline = symbol.outline || {};
        const outlineColor = colorArrToRgba(outline.color) || "#333333";

        const outlineAlpha =
            Array.isArray(outline.color) && outline.color.length > 3
                ? outline.color[3] > 1
                    ? outline.color[3] / 255
                    : outline.color[3]
                : 1;

        const lineStyle = {
            color: outlineColor,
            opacity: outlineAlpha,
            weight: outline.width ?? 1,
        };

        if (
            symbolType.includes("fill") ||
            geometryType === "esriGeometryPolygon"
        ) {
            return {
                ...lineStyle,
                fillColor: getSymbolColor(symbol) || "#3388ff",
                fillOpacity:
                    Array.isArray(symbol.color) && symbol.color.length > 3
                        ? symbol.color[3] > 1
                            ? symbol.color[3] / 255
                            : symbol.color[3]
                        : 0.45,
            };
        }

        if (
            symbolType.includes("line") ||
            geometryType === "esriGeometryPolyline"
        ) {
            return {
                ...lineStyle,
                fill: false,
            };
        }

        return {
            ...lineStyle,
            fillColor: getSymbolColor(symbol) || "#3388ff",
            fillOpacity: 0.8,
            radius: symbol.size ? Math.max(3, symbol.size / 2) : 5,
        };
    }

    // Build a style function from an ArcGIS renderer.
    // Supports simple, unique-value and class-break renderers.
    function rendererToStyleFunc(renderer, geometryType = null) {
        if (!renderer) return null;

        if (renderer.type === "simple") {
            const style = symbolToStyle(renderer.symbol, geometryType);
            return () => style;
        }

        if (renderer.type === "uniqueValue") {
            const field = renderer.field1;
            const field2 = renderer.field2;
            const field3 = renderer.field3;
            const fieldDelimiter = renderer.fieldDelimiter ?? ", ";

            const valueStyles = new Map();

            (renderer.uniqueValueInfos || []).forEach((info) => {
                valueStyles.set(
                    String(info.value),
                    symbolToStyle(info.symbol, geometryType)
                );
            });

            const defaultStyle = renderer.defaultSymbol
                ? symbolToStyle(renderer.defaultSymbol, geometryType)
                : symbolToStyle(null, geometryType);

            return (properties) => {
                const values = [field, field2, field3]
                    .filter(Boolean)
                    .map((name) => properties?.[name]);

                const key = values
                    .map((value) => (value == null ? "" : String(value)))
                    .join(fieldDelimiter);

                return valueStyles.get(key) || defaultStyle;
            };
        }

        if (renderer.type === "classBreaks") {
            const field = renderer.field;
            const infos = renderer.classBreakInfos || [];

            const defaultStyle = renderer.defaultSymbol
                ? symbolToStyle(renderer.defaultSymbol, geometryType)
                : {};

            return (properties) => {
                const value = Number(properties?.[field]);

                if (!Number.isFinite(value)) {
                    return defaultStyle;
                }

                const match = infos.find(
                    (info) => value <= Number(info.classMaxValue)
                );

                return match
                    ? symbolToStyle(match.symbol, geometryType)
                    : defaultStyle;
            };
        }

        return null;
    }

    function escapeSqlString(value) {
        if (value == null) return value;
        return String(value).replace(/'/g, "''");
    }

    // Diagnostic logging: confirm the map and project state.
    useEffect(() => {
        console.warn(
            "[MapView] status",
            "map=",
            !!map,
            "selectedProject=",
            selectedProject,
            "selectedLayers=",
            Array.from(selectedLayers || [])
        );
    }, [map, selectedProject, selectedLayers]);

    // Apply the pan lock to the Leaflet map.
    useEffect(() => {
        if (!map) return;

        if (panEnabled) {
            map.dragging.enable();
        } else {
            map.dragging.disable();
        }
    }, [map, panEnabled]);

    return (
        <MapContainer
            center={[0, 0]}
            zoom={2}
            style={{ height: "100%", width: "100%" }}
        >
            <MapInstanceCapture onMapReady={handleMapCreated} />

            <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {Array.from(selectedLayers || []).map((id) => {
                const details = layerDetails?.[id] || null;
                const geometryType = details?.geometryType || null;

                // If a client-side style is configured, use it.
                const vectorStyle = vectorStyles?.[id];

                if (vectorStyle) {
                    const styleFunc = (properties) => {
                        const value = properties?.[vectorStyle.field];
                        const styleMap = vectorStyle.styleMap || {};
                        const color = styleMap[value] ?? "#3388ff";

                        if (
                            vectorStyle.geometryType === "esriGeometryPoint" ||
                            vectorStyle.geometryType === "esriGeometryMultipoint"
                        ) {
                            return {
                                color,
                                fillColor: color,
                                fillOpacity: 0.85,
                                radius: 5,
                                weight: 1,
                            };
                        }

                        if (
                            vectorStyle.geometryType === "esriGeometryPolyline"
                        ) {
                            return {
                                color,
                                weight: 3,
                                opacity: 0.9,
                            };
                        }

                        return {
                            color,
                            fillColor: color,
                            fillOpacity: 0.45,
                            weight: 1,
                        };
                    };

                    const where = selectedProject
                        ? `PROYECTO='${escapeSqlString(selectedProject)}'`
                        : null;

                    return (
                        <EsriFeatureLayer
                            key={id}
                            url={`${featureService}/${id}`}
                            visible={true}
                            styleFunc={styleFunc}
                            where={where}
                        />
                    );
                }

                // Otherwise, use the layer's default ArcGIS renderer when available.
                if (details?.drawingInfo?.renderer) {
                    const styleFunc = rendererToStyleFunc(
                        details.drawingInfo.renderer,
                        geometryType
                    );

                    if (styleFunc) {
                        const where = selectedProject
                            ? `PROYECTO='${escapeSqlString(selectedProject)}'`
                            : null;

                        return (
                            <EsriFeatureLayer
                                key={id}
                                url={`${featureService}/${id}`}
                                visible={true}
                                styleFunc={styleFunc}
                                where={where}
                            />
                        );
                    }
                }

                // Fallback: render the layer without a custom style function.
                const where = selectedProject
                    ? `PROYECTO='${escapeSqlString(selectedProject)}'`
                    : null;

                return (
                    <EsriFeatureLayer
                        key={id}
                        url={`${featureService}/${id}`}
                        visible={true}
                        where={where}
                    />
                );
            })}

            {/* Mount the extent controller only after Leaflet's map is available. */}
            {map && (
                <MapExtentController
                    map={map}
                    featureService={featureService}
                    selectedLayers={selectedLayers}
                    layerDetails={layerDetails}
                    selectedProject={selectedProject}
                    panEnabled={panEnabled}
                />
            )}
        </MapContainer>
    );
}

export default MapView;