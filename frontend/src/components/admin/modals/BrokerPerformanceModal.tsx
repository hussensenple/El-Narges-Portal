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

  const COLORS = ['#8957e5', '#d29922', '#da3633', '#8b949e'];

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ backgroundColor: '#0d1117', padding: '30px', borderRadius: '12px', width: '1100px', maxWidth: '96vw', border: '1px solid #30363d', color: '#fff', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#8957e5' }}>📊 Performance Dashboard: {broker.name}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#8b949e' }}>Loading performance data...</div>
        ) : data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

            {/* Indicators Section — all 5 in a single row */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'nowrap' }}>
              <div style={{ flex: 1, minWidth: 0, backgroundColor: '#21262d', padding: '15px', borderRadius: '8px', border: '1px solid #30363d', textAlign: 'center' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#8b949e' }}>Available Units</h4>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3fb950' }}>{data.indicators.availableUnits}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0, backgroundColor: '#21262d', padding: '15px', borderRadius: '8px', border: '1px solid #30363d', textAlign: 'center' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#8b949e' }}>Reserved Units</h4>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#d29922' }}>{data.indicators.reservedUnits}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0, backgroundColor: '#21262d', padding: '15px', borderRadius: '8px', border: '1px solid #30363d', textAlign: 'center' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#8b949e' }}>Sold Units</h4>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#da3633' }}>{data.indicators.soldUnits}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0, backgroundColor: '#21262d', padding: '15px', borderRadius: '8px', border: '1px solid #30363d', textAlign: 'center' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#8b949e' }}>Total Revenue (M EGP)</h4>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ffc658' }}>$ {data.indicators.revenueMEGP}</div>
              </div>
              {/* Commission Card — 1.5% of total revenue */}
              <div style={{
                flex: 1,
                minWidth: 0,
                background: 'linear-gradient(135deg, #1a2a1a 0%, #21262d 100%)',
                padding: '15px',
                borderRadius: '8px',
                border: '1px solid #2ea043',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #2ea043, #56d364)'
                }} />
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#56d364', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Commission</div>
                <h4 style={{ margin: '0 0 10px 0', color: '#8b949e' }}>1.5% of Revenue</h4>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#56d364' }}>
                  💰 {(data.indicators.revenueMEGP * 15).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </div>
                <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '4px' }}>Thousand EGP</div>
              </div>
            </div>

            {/* Charts Section */}
            <div style={{ display: 'flex', gap: '20px' }}>

              {/* Pie Chart */}
              <div style={{ flex: 1, backgroundColor: '#21262d', padding: '20px', borderRadius: '8px', border: '1px solid #30363d' }}>
                <h4 style={{ marginTop: 0, marginBottom: '20px', color: '#fff', textAlign: 'center' }}>Requests Conversion</h4>
                <div style={{ height: '420px' }}>
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
                      <PieTooltip contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#fff' }} />
                      <PieLegend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bar Chart */}
              <div style={{ flex: 1, backgroundColor: '#21262d', padding: '20px', borderRadius: '8px', border: '1px solid #30363d' }}>
                <h4 style={{ marginTop: 0, marginBottom: '20px', color: '#fff', textAlign: 'center' }}>Client Requests by Property Type</h4>
                <div style={{ height: '420px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.barChartData}
                      margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                      <XAxis dataKey="name" stroke="#8b949e" />
                      <YAxis stroke="#8b949e" allowDecimals={false} />
                      <BarTooltip contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#fff' }} cursor={{ fill: '#30363d' }} />
                      <BarLegend />
                      <Bar dataKey="Available" fill="#3fb950" />
                      <Bar dataKey="Sold" fill="#da3633" />
                      <Bar dataKey="Reserved" fill="#d29922" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: '#f85149' }}>Failed to load performance data.</div>
        )}
      </div>
    </div>
  );
};

export default BrokerPerformanceModal;
