import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip as PieTooltip, Legend as PieLegend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip, Legend as BarLegend, ResponsiveContainer } from 'recharts';

interface BrokerPerformanceModalProps {
  broker: any;
  onClose: () => void;
}

const BrokerPerformanceModal: React.FC<BrokerPerformanceModalProps> = ({ broker, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/roles/broker/${broker._id}/performance`);
        setData(res.data);
      } catch (error) {
        console.error('Error fetching broker performance:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPerformance();
  }, [broker._id]);

  const COLORS = ['#8957e5', 'var(--accent-gold)', 'var(--accent-red-bg)', 'var(--text-muted)'];

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ backgroundColor: 'var(--bg-primary)', padding: '30px', borderRadius: '12px', width: '1100px', maxWidth: '96vw', border: '1px solid var(--border-color)', color: 'var(--text-primary)', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#8957e5' }}>📊 Performance Dashboard: {broker.name}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading performance data...</div>
        ) : data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

            {/* Indicators Section — all 5 in a single row */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'nowrap' }}>
              <div style={{ flex: 1, minWidth: 0, backgroundColor: 'var(--bg-tertiary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)' }}>Available Units</h4>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3fb950' }}>{data.indicators.availableUnits}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0, backgroundColor: 'var(--bg-tertiary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)' }}>Reserved Units</h4>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-gold)' }}>{data.indicators.reservedUnits}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0, backgroundColor: 'var(--bg-tertiary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)' }}>Sold Units</h4>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-red-bg)' }}>{data.indicators.soldUnits}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0, backgroundColor: 'var(--bg-tertiary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)' }}>Total Revenue <span style={{ fontSize: '10px', fontWeight: 'normal', textTransform: 'none' }}>(M EGY)</span></h4>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ffc658' }}>{data.indicators.revenueMEGP.toFixed(2)}</div>
              </div>
              {/* Commission Card — 1.5% of total revenue */}
              <div style={{
                flex: 1,
                minWidth: 0,
                background: 'linear-gradient(135deg, rgba(86, 211, 100, 0.15) 0%, var(--bg-tertiary) 100%)',
                padding: '15px',
                borderRadius: '8px',
                border: '1px solid var(--accent-green)',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, var(--accent-green), #56d364)'
                }} />
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent-green)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Commission <span style={{ fontSize: '10px', fontWeight: 'normal', textTransform: 'none' }}>(M EGY)</span>
                </div>
                <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)' }}>1.5% of Revenue</h4>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: 'var(--accent-green)' }}>
                  💰 {(data.indicators.revenueMEGP * 0.015).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div style={{ display: 'flex', gap: '20px' }}>

              {/* Pie Chart */}
              <div style={{ flex: 1, backgroundColor: 'var(--bg-tertiary)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--text-primary)', textAlign: 'center' }}>Requests Conversion</h4>
                <div style={{ height: '280px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {data.pieChartData.map((_entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <PieTooltip contentStyle={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
                      <PieLegend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bar Chart */}
              <div style={{ flex: 1, backgroundColor: 'var(--bg-tertiary)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--text-primary)', textAlign: 'center' }}>Client Requests by Property Type</h4>
                <div style={{ height: '280px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.barChartData}
                      margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="name" stroke="var(--text-muted)" />
                      <YAxis stroke="var(--text-muted)" allowDecimals={false} />
                      <BarTooltip contentStyle={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} cursor={{ fill: 'var(--border-color)' }} />
                      <BarLegend />
                      <Bar dataKey="Available" fill="#3fb950" />
                      <Bar dataKey="Sold" fill="var(--accent-red-bg)" />
                      <Bar dataKey="Reserved" fill="var(--accent-gold)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--accent-red)' }}>Failed to load performance data.</div>
        )}
      </div>
    </div>
  );
};

export default BrokerPerformanceModal;
