import React, { useEffect, useMemo, useState } from 'react';
import filterValuesConfig from '../../config/filterValuesConfig';

function FilterPanel({ layers, setLayers, visibleLayerIds = [], serviceLayers = [], layerDetails = {} }) {
    // visibleLayerIds: array of numeric layer ids currently enabled in sidebar
    const [selectedLayerId, setSelectedLayerId] = useState(null);
    const [fieldsForLayer, setFieldsForLayer] = useState([]);
    const [selectedField, setSelectedField] = useState('');
    const [selectedValue, setSelectedValue] = useState('');

    // map serviceLayers list (which contains objects with id,name,title) by id for quick lookup
    const serviceLayersById = useMemo(() => {
        const map = new Map();
        (serviceLayers || []).forEach((l) => map.set(Number(l.id), l));
        return map;
    }, [serviceLayers]);

    useEffect(() => {
        // when visible layers change, if selected layer is no longer visible clear selection
        if (selectedLayerId && !visibleLayerIds.includes(selectedLayerId)) {
            setSelectedLayerId(null);
            setFieldsForLayer([]);
            setSelectedField('');
            setSelectedValue('');
        }
    }, [visibleLayerIds]);

    useEffect(() => {
        if (!selectedLayerId) return;
        // load fields from layerDetails if available otherwise from serviceLayers metadata
        const details = layerDetails && layerDetails[selectedLayerId];
        const fields = (details && details.fields) ? details.fields.map(f => ({ name: f.name, alias: f.alias || f.name, type: f.type })) : (serviceLayersById.get(Number(selectedLayerId)) && serviceLayersById.get(Number(selectedLayerId)).fields) || [];
        setFieldsForLayer(fields);
        if (fields.length) setSelectedField(fields[0].name);
    }, [selectedLayerId, layerDetails, serviceLayersById]);

    const layerOptions = (visibleLayerIds || []).map((id) => {
        const l = serviceLayersById.get(Number(id));
        return { id, name: l ? (l.name || l.title || (`Layer ${id}`)) : `Layer ${id}` };
    });

    function applyFilter() {
        // For now just log selection; integration with map queries can be added later
        // applying filter
    }

    function toggleLayer(layerName) {
        setLayers({ ...layers, [layerName]: !layers[layerName] });
    }

    // values for selected field come from config, avoid querying service at runtime
    const possibleValues = useMemo(() => {
        if (!selectedLayerId || !selectedField) return [];
        const layerMeta = serviceLayersById.get(Number(selectedLayerId));
        const layerKey = layerMeta ? (layerMeta.name || layerMeta.title) : null;
        if (layerKey && filterValuesConfig[layerKey] && filterValuesConfig[layerKey][selectedField]) {
            return filterValuesConfig[layerKey][selectedField];
        }
        return [];
    }, [selectedLayerId, selectedField, serviceLayersById]);

    return (
        <div className="p-2">
            <div style={{ marginTop: 2 }}>
                <label style={{ fontSize: 12, color: 'var(--text)' }}>Layer</label>
                <select className="styler-select" value={selectedLayerId || ''} onChange={(e) => setSelectedLayerId(Number(e.target.value) || null)}>
                    <option value="">Select visible layer</option>
                    {layerOptions.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                </select>
            </div>

            <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--text)' }}>Detail (field)</label>
                <select className="styler-select" value={selectedField || ''} onChange={(e) => setSelectedField(e.target.value)} disabled={!fieldsForLayer.length}>
                    {fieldsForLayer.length === 0 && <option value="">No fields available</option>}
                    {fieldsForLayer.map((f) => (
                        <option key={f.name} value={f.name}>{f.alias || f.name}</option>
                    ))}
                </select>
            </div>

            <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--text)' }}>Value</label>
                <select className="styler-select" value={selectedValue || ''} onChange={(e) => setSelectedValue(e.target.value)} disabled={!possibleValues.length}>
                    {possibleValues.length === 0 && <option value="">No values configured</option>}
                    {possibleValues.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
            </div>

            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={applyFilter} disabled={!selectedLayerId || !selectedField || !selectedValue}>Apply</button>
                <button className="btn btn-ghost" onClick={() => { setSelectedLayerId(null); setSelectedField(''); setSelectedValue(''); }}>Clear</button>
            </div>

            <hr style={{ marginTop: 12, marginBottom: 8, borderColor: 'rgba(255,255,255,0.03)' }} />

        </div>
    );
}

export default FilterPanel;
