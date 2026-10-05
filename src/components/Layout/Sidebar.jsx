import React, { useState, useEffect } from "react";
import FilterPanel from "../Dashboard/FilterPanel";
import MapLayers from "../Map/MapLayers";
import LayerFieldStyler from "../Map/LayerFieldStyler";
import layerStyleConfig from '../../config/layerStyleConfig';

function Sidebar({ layers, setLayers, featureService, serviceLayers, selectedLayers, onToggleLayer, onLayerClick, layerDetails, onApplyStyle, onClearStyle, vectorStyles, lastClickedLayer }) {
    const [filtersOpen, setFiltersOpen] = useState(false);
    // keep layers list visible by default so users see available layers
    const [layersOpen, setLayersOpen] = useState(true);

    // dispatch a resize event so map can adjust when sidebar sections collapse/expand
    useEffect(() => {
        const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
        return () => clearTimeout(t);
    }, [filtersOpen, layersOpen]);

    return (
        <aside className="sidebar">

            {/* Filters section (collapsible) */}
            <div className="collapsible">
                <div className="collapsible-header" onClick={() => setFiltersOpen((v) => !v)}>
                    <div style={{ fontWeight: 600 }}>Filters</div>
                    <div style={{ fontSize: 12, color: "var(--text)" }}>{filtersOpen ? 'Hide' : 'Show'}</div>
                </div>
                <div className="collapsible-content" style={{ maxHeight: filtersOpen ? '1000px' : '0' }}>
                    <div style={{ padding: 8 }}>
                        <FilterPanel
                            layers={layers}
                            setLayers={setLayers}
                            visibleLayerIds={Array.from(selectedLayers || [])}
                            serviceLayers={serviceLayers}
                            layerDetails={layerDetails}
                        />
                    </div>
                </div>
            </div>

            {/* Map Layers section (collapsible) */}
            <div className="collapsible" style={{ marginTop: 8 }}>
                <div className="collapsible-header" onClick={() => setLayersOpen((v) => !v)}>
                    <div style={{ fontWeight: 600 }}>Map Layers</div>
                    <div style={{ fontSize: 12, color: 'var(--text)' }}>{layersOpen ? 'Hide' : 'Show'}</div>
                </div>
                <div className="collapsible-content" style={{ maxHeight: layersOpen ? '1000px' : '0' }}>
                    <div style={{ padding: 8 }}>
                        <MapLayers serviceUrl={featureService} layersData={serviceLayers} selectedLayers={selectedLayers} onToggle={onToggleLayer} onLayerClick={onLayerClick} />

                        {lastClickedLayer && (
                            <div style={{ marginTop: 8 }}>
                                {layerDetails[lastClickedLayer.id] ? (
                                    <LayerFieldStyler
                                        layerId={lastClickedLayer.id}
                                        details={layerDetails[lastClickedLayer.id]}
                                        layerConfig={layerStyleConfig[lastClickedLayer.name] || layerStyleConfig[lastClickedLayer.title]}
                                        onApply={onApplyStyle}
                                        onClear={onClearStyle}
                                        currentStyle={vectorStyles[lastClickedLayer.id]}
                                    />
                                ) : (
                                    <div style={{ fontSize: 12 }}>Loading layer info...</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </aside>
    );
}

export default Sidebar;
