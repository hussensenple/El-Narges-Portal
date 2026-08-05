import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { PieChart, Pie, Cell, Tooltip as PieTooltip, Legend as PieLegend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip, Legend as BarLegend, ResponsiveContainer } from 'recharts';
import MapViewer from '../MapViewer';
import BrokerPerformanceModal from './modals/BrokerPerformanceModal';
import OwnerPropertiesModal from './modals/OwnerPropertiesModal';
import TopOwnersChartModal from './modals/TopOwnersChartModal';
import RegionClientsModal from './modals/RegionClientsModal';
import RegionsWebMapModal from './modals/RegionsWebMapModal';


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
  const [owners, setOwners] = useState<any[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<any>(null);
  const [isTopOwnersChartOpen, setIsTopOwnersChartOpen] = useState(false);

  const [mapView, setMapView] = useState<any>(null);
  const extentRef = useRef<any>(null);
  const [regionsStats, setRegionsStats] = useState<any[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<any>(null);
  const [isRegionsChartOpen, setIsRegionsChartOpen] = useState(false);

  const fetchStats = async (extent?: any) => {
    try {
      const token = localStorage.getItem('token');
      const params = extent ? { extent: JSON.stringify(extent) } : {};
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/dashboard-stats`, {
        headers: { 'x-auth-token': token },
        params
      });
      setStats(res.data);
    } catch (error) {
      console.error('Error fetching admin dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegionsStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/regions-stats`, {
        headers: { 'x-auth-token': token }
      });
      setRegionsStats(res.data);
    } catch (error) {
      console.error('Error fetching regions stats:', error);
    }
  };

  const fetchOwners = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/roles/owner`);
      const ownersList = res.data;

      // Collect unit IDs to query prices
      const aptIds: number[] = [];
      const villaIds: string[] = [];

      ownersList.forEach((owner: any) => {
        owner.ownedUnits?.forEach((unit: any) => {
          if (unit.sourceLayer === 'Units' && unit.objectId) {
            aptIds.push(unit.objectId);
          } else if (unit.sourceLayer === 'Villas_Global' && unit.arcgisId) {
            villaIds.push(unit.arcgisId);
          }
        });
      });

      const priceMap: { [key: string]: number } = {};
      const promises: Promise<void>[] = [];

      const UNITS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37';
      const VILLAS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WSL3/FeatureServer/8';

      if (aptIds.length > 0) {
        const where = `OBJECTID IN (${aptIds.join(',')})`;
        promises.push(
          axios.get(`${UNITS_URL}/query`, { params: { where, outFields: 'OBJECTID,Price', f: 'json' } })
            .then(r => {
              r.data.features?.forEach((f: any) => {
                if (f.attributes.Price) {
                  priceMap[`Units_${f.attributes.OBJECTID}`] = Number(f.attributes.Price);
                }
              });
            })
        );
      }

      if (villaIds.length > 0) {
        const formattedVillaIds = villaIds.map(id => `'${id}'`).join(',');
        const where = `GlobalID IN (${formattedVillaIds})`;
        promises.push(
          axios.get(`${VILLAS_URL}/query`, { params: { where, outFields: 'GlobalID,Price', f: 'json' } })
            .then(r => {
              r.data.features?.forEach((f: any) => {
                if (f.attributes.Price) {
                  priceMap[`Villas_Global_${f.attributes.GlobalID}`] = Number(f.attributes.Price);
                }
              });
            })
        );
      }

      try {
        await Promise.all(promises);
      } catch (err) {
        console.error('Error fetching prices from ArcGIS for owners:', err);
      }

      const ownersWithPrices = ownersList.map((owner: any) => {
        let totalPrice = 0;
        owner.ownedUnits?.forEach((unit: any) => {
          const key = unit.sourceLayer === 'Villas_Global'
            ? `Villas_Global_${unit.arcgisId}`
            : `Units_${unit.objectId}`;
          totalPrice += priceMap[key] || 0;
        });
        return { ...owner, totalPrice };
      });

      const sortedOwners = ownersWithPrices.sort((a: any, b: any) => (b.totalPrice || 0) - (a.totalPrice || 0));
      setOwners(sortedOwners);
    } catch (error) {
      console.error('Error fetching owners:', error);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchOwners();
    fetchRegionsStats();

    const socket = io(import.meta.env.VITE_API_URL);
    socket.on('newBookingRequest', () => {
      console.log('Real-time update triggered for dashboard stats');
      fetchStats(extentRef.current);
      fetchOwners();
      fetchRegionsStats();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleViewReady = (view: any) => {
    setMapView(view);
    // Removed reactiveUtils.watch to prevent numbers changing on map movement
  };

  const COLORS = ['#8957e5', '#3fb950'];

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading Analytics...</div>;
  }

  if (!stats) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--accent-red)' }}>Failed to load data.</div>;
  }

  return (
    <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px', height: 'calc(100% - 15px)', overflow: 'hidden' }}>

      {/* Main Content Area (3 Columns spanning full height now) */}
      <div style={{ display: 'flex', gap: '15px', flex: 1, overflow: 'hidden' }}>

        {/* LEFT COLUMN: Top Selling Regions + Top Owners + Recent Sales */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px', overflow: 'hidden' }}>

          {/* Top Owners (Scroll down list) */}
          <div style={{ flex: 1, backgroundColor: 'var(--bg-tertiary)', padding: '15px', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '10px' }}>
              <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '14px' }}>
                👑 Top Owners
              </h4>
              <button
                onClick={() => setIsTopOwnersChartOpen(true)}
                style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px' }}
                title="View Top Owners Chart"
              >
                📊
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {owners.length > 0 ? (
                owners.map(owner => (
                  <div
                    key={owner._id}
                    onClick={() => setSelectedOwner(owner)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background-color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                  >
                    <div>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '13px', display: 'block' }}>{owner.name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{owner.phone}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'block', color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '13px' }}>
                        {owner.totalPrice !== undefined && owner.totalPrice > 0 ? (owner.totalPrice / 1000000).toFixed(2) + ' M EGP' : '—'}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{owner.ownedUnits?.length || 0} units</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '10px', fontSize: '13px' }}>No owners found.</div>
              )}
            </div>
          </div>

          {/* Top Brokers Leaderboard */}
          <div style={{ flex: 1, backgroundColor: 'var(--bg-tertiary)', padding: '15px', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <h4 style={{ marginTop: 0, marginBottom: '10px', color: 'var(--text-primary)', textAlign: 'left', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontSize: '14px' }}>
              🏆 Top Brokers
            </h4>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.topBrokers && stats.topBrokers.length > 0 ? (
                stats.topBrokers.map((broker: any, index: number) => (
                  <div
                    key={broker._id}
                    onClick={() => setSelectedBroker(broker)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background-color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                  >
                    {/* Left: rank circle + name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        backgroundColor: index === 0 ? 'var(--accent-gold)' : index === 1 ? 'var(--text-muted)' : index === 2 ? '#b06500' : 'var(--border-color)',
                        color: 'var(--text-primary)', width: '28px', height: '28px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: 'bold', flexShrink: 0
                      }}>
                        {index + 1}
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 'bold', display: 'block', fontSize: '13px' }}>{broker.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Req: {broker.totalRequests}</span>
                      </div>
                    </div>

                    {/* Right: three stat columns */}
                    <div style={{ display: 'flex', gap: '14px', textAlign: 'center' }}>
                      <div>
                        <span style={{ display: 'block', color: '#3fb950', fontWeight: 'bold', fontSize: '15px', lineHeight: 1.1 }}>{broker.sold}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sold</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '15px', lineHeight: 1.1 }}>{broker.raisedToAdmin}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Raised</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', color: 'var(--accent-red)', fontWeight: 'bold', fontSize: '15px', lineHeight: 1.1 }}>{broker.declined}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Declined</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '10px', fontSize: '13px' }}>No brokers found.</div>
              )}
            </div>
          </div>

          {/* Recent Sales List */}
          <div style={{ flex: 1, backgroundColor: 'var(--bg-tertiary)', padding: '15px', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            <h4 style={{ marginTop: 0, marginBottom: '10px', color: 'var(--text-primary)', textAlign: 'left', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontSize: '14px' }}>
              🛒 Recent Sales
            </h4>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.recentSales && stats.recentSales.length > 0 ? (
                stats.recentSales.map((sale: any) => (
                  <div key={sale._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '13px' }}>{sale.customerName}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{sale.type} #{sale.unitId}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'block', color: '#3fb950', fontWeight: 'bold', fontSize: '13px' }}>{sale.price}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{new Date(sale.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '10px', fontSize: '13px' }}>No recent sales.</div>
              )}
            </div>
          </div>


        </div>

        {/* CENTER COLUMN: Indicators row + 3D Map */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '15px', overflow: 'hidden' }}>

          {/* Indicators row aligned directly with the map frame */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1, backgroundColor: 'var(--bg-tertiary)', padding: '10px 15px', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <h4 style={{ margin: '0 0 5px 0', color: 'var(--text-primary)', fontSize: '12px' }}>Total Available Units</h4>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3fb950' }}>{stats.indicators.totalAvailableUnits}</div>
            </div>
            <div style={{ flex: 1, backgroundColor: 'var(--bg-tertiary)', padding: '10px 15px', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <h4 style={{ margin: '0 0 5px 0', color: 'var(--text-primary)', fontSize: '12px' }}>Total Reserved Units</h4>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-gold)' }}>{stats.indicators.totalReservedUnits}</div>
            </div>
            <div style={{ flex: 1, backgroundColor: 'var(--bg-tertiary)', padding: '10px 15px', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <h4 style={{ margin: '0 0 5px 0', color: 'var(--text-primary)', fontSize: '12px' }}>Total Sold Units</h4>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-red-bg)' }}>{stats.indicators.totalSoldUnits}</div>
            </div>
            <div style={{ flex: 1, backgroundColor: 'var(--bg-tertiary)', padding: '10px 15px', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <h4 style={{ margin: '0 0 5px 0', color: 'var(--text-primary)', fontSize: '12px' }}>Total Revenue <span style={{ fontSize: '10px', fontWeight: 'normal', color: 'var(--text-muted)' }}>(M EGY)</span></h4>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-gold)' }}>{Number(stats.indicators.totalRevenue).toFixed(2)}</div>
            </div>
          </div>
          {/* 3D Map Container */}
          <div style={{ flex: 1, backgroundColor: 'var(--bg-tertiary)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', position: 'relative' }}>
            <MapViewer
              onViewReady={handleViewReady}
              isLayersOpen={false}
              isWeatherOpen={false}
              setIsWeatherOpen={() => { }}
              isBasemapOpen={false}
            />
          </div>

        </div>

        {/* RIGHT COLUMN: Charts + Top Brokers */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px', overflow: 'hidden' }}>

          {/* Pie Chart: Sold Units Ratio */}
          <div style={{ flex: 1.2, backgroundColor: 'var(--bg-tertiary)', padding: '15px', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <h4 style={{ marginTop: 0, marginBottom: '10px', color: 'var(--text-primary)', textAlign: 'center', fontSize: '14px' }}>Sold Units Ratio</h4>
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
                    labelLine={{ stroke: 'var(--text-muted)', strokeWidth: 1 }}
                    label={renderCustomizedLabel}
                  >
                    {stats.pieChartData.map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <PieTooltip contentStyle={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '12px' }} />
                  <PieLegend verticalAlign="bottom" height={24} wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart: Property Status */}
          <div style={{ flex: 1.2, backgroundColor: 'var(--bg-tertiary)', padding: '15px', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <h4 style={{ marginTop: 0, marginBottom: '10px', color: 'var(--text-primary)', textAlign: 'center', fontSize: '14px' }}>Property Status</h4>
            <div style={{ flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                  <YAxis stroke="var(--text-muted)" allowDecimals={false} tick={{ fontSize: 12 }} domain={[0, 300]} allowDataOverflow={true} />
                  <BarTooltip contentStyle={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} cursor={{ fill: 'var(--border-color)' }} />
                  <BarLegend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="Available" fill="#3fb950" />
                  <Bar dataKey="Sold" fill="var(--accent-red-bg)" />
                  <Bar dataKey="Reserved" fill="var(--accent-gold)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>


        </div>

      </div>

      {selectedBroker && (
        <BrokerPerformanceModal broker={selectedBroker} onClose={() => setSelectedBroker(null)} />
      )}

      {selectedOwner && (
        <OwnerPropertiesModal owner={selectedOwner} view={mapView} onClose={() => setSelectedOwner(null)} />
      )}

      {isTopOwnersChartOpen && (
        <TopOwnersChartModal
          owners={owners}
          onClose={() => setIsTopOwnersChartOpen(false)}
        />
      )}

      {selectedRegion && (
        <RegionClientsModal
          region={selectedRegion}
          view={mapView}
          onClose={() => setSelectedRegion(null)}
        />
      )}

      {isRegionsChartOpen && (
        <RegionsWebMapModal
          regionsStats={regionsStats}
          onClose={() => setIsRegionsChartOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminDashboardTab;
