import React from 'react';
import '../../index.css';

export default function StackedBarChart({ data = [], categoryKey, seriesKeys = ['lotes','departamentos','other'], colors = ['#7cb342','#42a5f5','#888888'], labelKey }) {
  const maxTotal = Math.max(1, ...(data || []).map(d => d.total || seriesKeys.reduce((s,k)=>s+(d[k]||0),0)));

  return (
    <div className="chart-card">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{fontWeight:600}}>{labelKey}</div>
        <div style={{fontSize:12, color:'var(--text)'}}>Total: {(data || []).reduce((s,d)=>s+(d.total||0),0)}</div>
      </div>

      <svg className="bar-chart" viewBox={`0 0 ${Math.max(300,(data || []).length*80)} 220`} preserveAspectRatio="none">
        {(data || []).map((d, i) => {
          const x = i * 80 + 40;
          let acc = 0;
          return (
            <g key={i} transform={`translate(${x},10)`}> 
              {seriesKeys.map((k, si) => {
                const v = d[k] || 0;
                const h = (v / maxTotal) * 160;
                const y = 180 - acc - h;
                acc += h;
                return <rect key={k} x={-20} y={y} width={40} height={h} fill={colors[si] || '#666'} rx={3} />;
              })}
              <text x={0} y={196} fontSize={11} fill="var(--text)" textAnchor="middle">{String(d[categoryKey] ?? d.tipo ?? d.estado ?? '')}</text>
            </g>
          );
        })}
      </svg>

      <div className="chart-legend">
        {seriesKeys.map((k, i) => (
          <div className="legend-item" key={k}><span className="legend-swatch" style={{background: colors[i]}}></span>{k}</div>
        ))}
      </div>
    </div>
  );
}
