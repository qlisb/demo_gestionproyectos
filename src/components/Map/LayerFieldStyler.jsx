import React, { useEffect, useState } from 'react';

export default function LayerFieldStyler({ layerId, details, onApply, onClear, currentStyle, layerConfig = null }) {
    const [field, setField] = useState('');
    // prefer configured fields when available
    const fields = (layerConfig && layerConfig.fields) ? layerConfig.fields : (details && details.fields) || [];

    useEffect(() => {
        if (!field && fields.length) setField(fields[0].name || fields[0].name);
    }, [details, layerConfig]);
    // If no layerConfig is provided for this layer, styling is not allowed
    if (!layerConfig) {
        const rendererType = details && details.drawingInfo && details.drawingInfo.renderer && details.drawingInfo.renderer.type;
        return (
            <div>
            </div>
        );
    }

    return (
        <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>Style by field</div>
            <select className="styler-select" value={field} onChange={(e) => setField(e.target.value)}>
                {fields.map((f) => (
                    <option key={f.name} value={f.name}>{f.alias || f.name} {f.type ? `(${f.type})` : ''}</option>
                ))}
            </select>
            <div className="styler-actions">
                <button className="btn btn-primary" onClick={() => {
                    const cfgField = (layerConfig && layerConfig.fields) ? layerConfig.fields.find(f => f.name === field) : null;
                    if (cfgField && cfgField.mapping) onApply(layerId, field, cfgField.mapping);
                    else onApply(layerId, field);
                }}>Apply</button>
                <button className="btn btn-ghost" onClick={() => onClear(layerId)}>Clear</button>
            </div>

            {currentStyle && (
                <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>Legend</div>
                    <div style={{ maxHeight: 120, overflow: 'auto', marginTop: 6 }}>
                        {Object.entries(currentStyle.styleMap).map(([val, color]) => (
                            <div key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                                <div style={{ width: 18, height: 12, background: color, border: '1px solid rgba(255,255,255,0.06)' }} />
                                <div style={{ fontSize: 12 }}>{String(val)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
