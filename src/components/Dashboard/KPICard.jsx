import React from 'react';

export default function KPICard({ title = 'KPI', value = '-' }) {
  return (
    <div className="kpi-card">
      <h3>{title}</h3>
      <p>{value}</p>
    </div>
  );
}
