import { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { PieChart, Pie, Cell, Tooltip as PieTooltip, Legend as PieLegend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip, Legend as BarLegend, ResponsiveContainer } from 'recharts';
import MapViewer from '../MapViewer';
import BrokerPerformanceModal from './modals/BrokerPerformanceModal';

const renderCustomizedLabel = (props: any) => {
  const { cx, percent, index, x, y } = props;
  const COLORS = ['#8957e5', '#3fb950'];
  return (
    <text x={x + (x > cx ? 4 : -4)} y={y} fill={COLORS[index % COLORS.length]} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="13px" fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const AdminDashboardTab = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBroker, setSelectedBroker] = useState<any>(null);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/dashboard-stats`, {
        headers: { 'x-auth-token': token }
      });
      setStats(res.data);
    } catch (error) {
      console.error('Error fetching admin dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // 🔴 Real-time WebSocket connection
    const socket = io(import.meta.env.VITE_API_URL);
    socket.on('requestUpdated', () => {
      console.log('Real-time update triggered for dashboard stats');
      fetchStats();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const COLORS = ['#8957e5', '#3fb950'];
  
  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#8b949e' }}>Loading Analytics...</div>;
  }

  if (!stats) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#f85149' }}>Failed to load data.</div>;
  }

  return (
    <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px', height: 'calc(100% - 15px)', overflow: 'hidden' }}>
      
      {/* Top Indicators Row */}
      <div style={{ display: 'flex', gap: '15px' }}>
        <div style={{ flex: 1, backgroundColor: '#21262d', padding: '10px 15px', borderRadius: '16px', border: '1px solid #30363d', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 5px 0', color: '#8b949e', fontSize: '14px' }}>Total Revenue (M EGP)</h4>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ffc658' }}>$ {stats.indicators.totalRevenue}</div>
        </div>
        <div style={{ flex: 1, backgroundColor: '#21262d', padding: '10px 15px', borderRadius: '16px', border: '1px solid #30363d', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 5px 0', color: '#8b949e', fontSize: '14px' }}>Total Sold Units</h4>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#da3633' }}>{stats.indicators.totalSoldUnits}</div>
        </div>
        <div style={{ flex: 1, backgroundColor: '#21262d', padding: '10px 15px', borderRadius: '16px', border: '1px solid #30363d', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 5px 0', color: '#8b949e', fontSize: '14px' }}>Total Reserved Units</h4>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#d29922' }}>{stats.indicators.totalReservedUnits}</div>
        </div>
        <div style={{ flex: 1, backgroundColor: '#21262d', padding: '10px 15px', borderRadius: '16px', border: '1px solid #30363d', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 5px 0', color: '#8b949e', fontSize: '14px' }}>Total Available Units</h4>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3fb950' }}>{stats.indicators.totalAvailableUnits}</div>
        </div>
      </div>

      {/* Main Content Area (3 Columns spanning remaining height) */}
      <div style={{ display: 'flex', gap: '15px', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT COLUMN: Bar Chart + Recent Sales */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px', overflow: 'hidden' }}>
          
          {/* Bar Chart */}
          <div style={{ flex: 1, backgroundColor: '#21262d', padding: '15px', borderRadius: '16px', border: '1px solid #30363d', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#fff', textAlign: 'center', fontSize: '14px' }}>Property Status</h4>
            <div style={{ flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey="name" stroke="#8b949e" tick={{fontSize: 12}} />
                  <YAxis stroke="#8b949e" allowDecimals={false} tick={{fontSize: 12}} domain={[0, 300]} allowDataOverflow={true} />
                  <BarTooltip contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#fff' }} cursor={{fill: '#30363d'}} />
                  <BarLegend wrapperStyle={{fontSize: '12px'}} />
                  <Bar dataKey="Available" fill="#3fb950" />
                  <Bar dataKey="Sold" fill="#da3633" />
                  <Bar dataKey="Reserved" fill="#d29922" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Sales List */}
          <div style={{ flex: 1, backgroundColor: '#21262d', padding: '15px', borderRadius: '16px', border: '1px solid #30363d', display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
            <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#fff', textAlign: 'left', borderBottom: '1px solid #30363d', paddingBottom: '8px', fontSize: '14px' }}>
              🛒 Recent Sales
            </h4>
            {stats.recentSales && stats.recentSales.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {stats.recentSales.map((sale: any) => (
                  <div key={sale._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#161b22', padding: '10px', borderRadius: '6px', border: '1px solid #30363d' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ color: '#e6edf3', fontWeight: 'bold', fontSize: '13px' }}>{sale.customerName}</span>
                      <span style={{ color: '#8b949e', fontSize: '11px' }}>{sale.type} #{sale.unitId}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'block', color: '#3fb950', fontWeight: 'bold', fontSize: '13px' }}>{sale.price}</span>
                      <span style={{ color: '#8b949e', fontSize: '10px' }}>{new Date(sale.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#8b949e', textAlign: 'center', padding: '10px', fontSize: '13px' }}>No recent sales.</div>
            )}
          </div>

        </div>

        {/* CENTER COLUMN: 3D Map */}
        <div style={{ flex: 2, backgroundColor: '#21262d', borderRadius: '16px', border: '1px solid #30363d', overflow: 'hidden', position: 'relative' }}>
          <MapViewer 
            onViewReady={() => {}} 
            isLayersOpen={false} 
            isWeatherOpen={false} 
            setIsWeatherOpen={() => {}} 
            isBasemapOpen={false} 
          />
        </div>

        {/* RIGHT COLUMN: Pie Chart + Top Brokers */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px', overflow: 'hidden' }}>
          
          {/* Pie Chart */}
          <div style={{ flex: 1, backgroundColor: '#21262d', padding: '15px', borderRadius: '16px', border: '1px solid #30363d', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#fff', textAlign: 'center', fontSize: '14px' }}>Sold Units Ratio</h4>
            <div style={{ flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.pieChartData}
                    cx="50%"
                    cy="50%"
                    startAngle={90}
                    endAngle={-270}
                    innerRadius="30%"
                    outerRadius="55%"
                    paddingAngle={5}
                    dataKey="value"
                    labelLine={{ stroke: '#8b949e', strokeWidth: 1 }}
                    label={renderCustomizedLabel}
                  >
                    {stats.pieChartData.map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <PieTooltip contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#fff', fontSize: '12px' }} />
                  <PieLegend verticalAlign="bottom" height={24} wrapperStyle={{fontSize: '12px'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Brokers Leaderboard */}
          <div style={{ flex: 1, backgroundColor: '#21262d', padding: '15px', borderRadius: '16px', border: '1px solid #30363d', display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
            <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#fff', textAlign: 'left', borderBottom: '1px solid #30363d', paddingBottom: '8px', fontSize: '14px' }}>
              🏆 Top Brokers
            </h4>
            {stats.topBrokers && stats.topBrokers.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {stats.topBrokers.map((broker: any, index: number) => (
                  <div 
                    key={broker._id} 
                    onClick={() => setSelectedBroker(broker)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#161b22', padding: '10px', borderRadius: '12px', border: '1px solid #30363d', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ backgroundColor: index === 0 ? '#d29922' : index === 1 ? '#8b949e' : index === 2 ? '#b06500' : '#30363d', color: '#fff', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                        {index + 1}
                      </div>
                      <div>
                        <span style={{ color: '#e6edf3', fontWeight: 'bold', display: 'block', fontSize: '13px' }}>{broker.name}</span>
                        <span style={{ color: '#8b949e', fontSize: '10px' }}>Req: {broker.totalRequests}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', textAlign: 'center' }}>
                      <div>
                        <span style={{ display: 'block', color: '#3fb950', fontWeight: 'bold', fontSize: '12px' }}>{broker.sold}</span>
                        <span style={{ color: '#8b949e', fontSize: '9px', textTransform: 'uppercase' }}>Sold</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', color: '#d29922', fontWeight: 'bold', fontSize: '12px' }}>{broker.raisedToAdmin}</span>
                        <span style={{ color: '#8b949e', fontSize: '9px', textTransform: 'uppercase' }}>Raised</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', color: '#f85149', fontWeight: 'bold', fontSize: '12px' }}>{broker.declined}</span>
                        <span style={{ color: '#8b949e', fontSize: '9px', textTransform: 'uppercase' }}>Declined</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#8b949e', textAlign: 'center', padding: '10px', fontSize: '13px' }}>No brokers found.</div>
            )}
          </div>

        </div>

      </div>

      {selectedBroker && (
        <BrokerPerformanceModal broker={selectedBroker} onClose={() => setSelectedBroker(null)} />
      )}

    </div>
  );
};

export default AdminDashboardTab;
