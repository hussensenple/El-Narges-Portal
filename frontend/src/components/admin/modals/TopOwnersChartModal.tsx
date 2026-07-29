import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

interface TopOwnersChartModalProps {
  owners: any[];
  onClose: () => void;
}

const TopOwnersChartModal: React.FC<TopOwnersChartModalProps> = ({ owners, onClose }) => {
  // Take top 25 owners, already sorted descending by totalPrice in AdminDashboardTab
  const top25Owners = owners.slice(0, 25);

  const chartData = top25Owners.map((owner) => ({
    name: owner.name,
    paid: owner.totalPrice ? Number((owner.totalPrice / 1000000).toFixed(2)) : 0,
    propertiesCount: owner.ownedUnits?.length || 0,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 5px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{label}</p>
          <p style={{ margin: '0 0 5px', color: '#ffc658' }}>Paid: {payload[0].value} M EGP</p>
          <p style={{ margin: 0, color: 'var(--accent-blue)' }}>Properties: {payload[0].payload.propertiesCount}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={onClose} />
      
      <div style={{ position: 'relative', width: '90%', maxWidth: '1000px', height: '80vh', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', zIndex: 3001, overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: '#ffc658' }}>
              📊 Top 25 Owners
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>✖</button>
        </div>

        {/* Chart Area */}
        <div style={{ flex: 1, padding: '20px', minHeight: 0 }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 30, right: 30, left: 20, bottom: 60 }}>
                <XAxis 
                  dataKey="name" 
                  stroke="var(--text-muted)" 
                  angle={-45} 
                  textAnchor="end" 
                  interval={0} 
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }} 
                  height={80}
                />
                <YAxis 
                  stroke="var(--text-muted)" 
                  tickFormatter={(val) => `${val}M`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-tertiary)' }} />
                <Bar dataKey="paid" fill="#ffc658" radius={[4, 4, 0, 0]}>
                  <LabelList 
                    dataKey="propertiesCount" 
                    position="top" 
                    fill="var(--accent-blue)" 
                    fontSize={12} 
                    fontWeight="bold"
                    formatter={(val: number) => `${val} units`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
              No owner data available.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default TopOwnersChartModal;
