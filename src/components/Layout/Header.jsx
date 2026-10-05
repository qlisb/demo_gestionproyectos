import React from 'react';

function Header({ projectOptions = [], selectedProject = null, onSelectProject = () => {}, panEnabled = true, onTogglePan = () => {} }) {
    return (
        <header className="app-header">
            <div className="app-title">GIS Dashboard</div>

            <div className="app-header-right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span className="text-muted">Geoportal Marco Bonilla</span>
                </div>

                <div style={{ minWidth: 160 }}>
                    <select className="styler-select" value={selectedProject || ''} onChange={(e) => onSelectProject(e.target.value || null)}>
                        <option value="">Project filter</option>
                        {projectOptions.map((p) => (<option key={p} value={p}>{p}</option>))}
                    </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 12, color: 'var(--text)' }}>Map interaction</label>
                    <button className={"btn " + (panEnabled ? 'btn-primary' : 'btn-ghost')} onClick={onTogglePan} style={{ padding: '6px 8px' }}>{panEnabled ? 'Enabled' : 'Locked'}</button>
                </div>
            </div>
        </header>
    );
}

export default Header;
