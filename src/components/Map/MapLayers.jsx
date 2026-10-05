import React, { useEffect, useState } from 'react';

export default function MapLayers({ serviceUrl, layersData = null, selectedLayers = new Set(), onToggle, onLayerClick }) {
  const [layersTree, setLayersTree] = useState(layersData || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (layersData) {
      setLayersTree(layersData);
      return;
    }
    if (!serviceUrl) return;
    setLoading(true);
    setError(null);
    fetch(`${serviceUrl}?f=json`)
      .then((r) => r.json())
      .then((data) => {
        const byId = new Map();
        (data.layers || []).forEach((l) => byId.set(l.id, { ...l, children: [] }));
        const roots = [];
        byId.forEach((val) => {
          if (val.parentLayerId != null && val.parentLayerId !== -1 && byId.has(val.parentLayerId)) {
            byId.get(val.parentLayerId).children.push(val);
          } else {
            roots.push(val);
          }
        });
        setLayersTree(roots);
      })
      .catch((err) => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, [serviceUrl, layersData]);

  function renderNode(node) {
    const checked = selectedLayers.has(node.id);
    return (
      <li key={node.id}>
        <div className="layer-item" onClick={() => onLayerClick && onLayerClick(node)}>
          <div className="layer-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.85 }}>
              <rect x="3" y="3" width="10" height="10" rx="3" fill="rgba(255,255,255,0.5)" />
            </svg>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-h)' }}>{node.name || node.title || `Layer ${node.id}`}</div>
            </div>
          </div>
          <div className={"checkbox-custom" + (checked ? ' checked' : '')} onClick={(e) => { e.stopPropagation(); onToggle && onToggle(node.id, !checked); }}>
            <input type="checkbox" checked={checked} readOnly />
            <div className="checkmark" />
          </div>
        </div>
        {node.children && node.children.length > 0 && (
          <div className="layer-children">
            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
              {node.children.map((c) => renderNode(c))}
            </ul>
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="map-layers" style={{ padding: 8, maxHeight: '40vh', overflow: 'auto' }}>
      {/*<strong>Service Layers</strong>*/}
      {/* <div style={{ fontSize: 12, color: '#666' }}>{serviceUrl}</div> */}
      {loading && <div>Loading layers...</div>}
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
      {!loading && !error && layersTree.length === 0 && <div>No layers found</div>}
      <ul style={{ listStyle: 'none', paddingLeft: 8 }}>
        {layersTree.map((n) => renderNode(n))}
      </ul>
    </div>
  );
}
