import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { io, Socket } from 'socket.io-client';
import BrokerUnitRequestsModal from './BrokerUnitRequestsModal';

interface BrokerCatalogProps {
  view?: any;
  onClose: () => void;
}

const BrokerCatalog = ({ view, onClose }: BrokerCatalogProps) => {
  const { user } = useContext(AuthContext) || {};
  const [units, setUnits] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState<any | null>(null);

  const fetchData = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('token');
      // Fetch assigned units
      const unitsRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/roles/user-units/${user.id}?role=broker`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnits(unitsRes.data);

      // Fetch pending requests for these units
      const reqsRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/bookings/broker-pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(reqsRes.data);

    } catch (error) {
      console.error('Error fetching broker catalog data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Socket.io Real-time sync
    const socket: Socket = io(`${import.meta.env.VITE_API_URL}`);
    socket.on('newBookingRequest', () => {
      fetchData(); // Auto-refresh when new request comes in
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const getRequestsForUnit = (arcgisId: string) => {
    return requests.filter(r => String(r.unitId) === String(arcgisId));
  };

  const handleZoom = async (e: React.MouseEvent, unit: any) => {
    e.stopPropagation();
    if (!view) return;
    try {
      if (unit.sourceLayer === 'Units' || unit.unitName !== 'فيلا') {
        let bldgFK = unit.buildingIdFk || unit.buildingFK || unit.BuildingID_FK;
        if (!bldgFK) {
          const UNITS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37';
          const res = await axios.get(`${UNITS_URL}/query`, {
            params: {
              where: `OBJECTID=${unit.objectId || unit.arcgisId}`,
              outFields: 'BuildingID_FK',
              f: 'json'
            }
          });
          bldgFK = res.data.features?.[0]?.attributes?.BuildingID_FK;
        }

        if (bldgFK) {
          const bldgLayer = view.map.layers.find((l: any) => l.title === 'Buildings_Global' || l.title === 'Buildings');
          if (bldgLayer) {
            const bldgQ = bldgLayer.createQuery();
            bldgQ.where = `GlobalID = '${bldgFK}' OR globalid = '${bldgFK}'`;
            const extentRes = await bldgLayer.queryExtent(bldgQ);
            if (extentRes && extentRes.extent) {
              view.goTo({ target: extentRes.extent, tilt: 60, zoom: 20 }, { animate: true, duration: 1500 });
              onClose();
              return;
            }
          }
        }
        alert("Could not locate the parent building for this apartment.");
      } else {
        const layer = view.map.layers.find((l: any) => l.title === 'Villas_Global');
        if (!layer) {
          alert("Villas layer not found.");
          return;
        }
        const query = layer.createQuery();
        query.where = `OBJECTID = ${unit.objectId || unit.arcgisId}`;
        const extentRes = await layer.queryExtent(query);
        if (extentRes && extentRes.extent) {
          view.goTo({ target: extentRes.extent, tilt: 60, zoom: 20 }, { animate: true, duration: 1500 });
          onClose();
        } else {
          alert("Could not locate this villa.");
        }
      }
    } catch(err) {
      console.error('Zoom error:', err);
    }
  };

  const statusLabel = (s: any) => {
    const v = String(s).toLowerCase();
    if (v === '1' || v === 'available') return { label: 'Available', color: 'var(--accent-green)' };
    if (v === '2' || v === 'interested') return { label: 'Interested', color: 'var(--accent-gold)' };
    if (v === '3' || v === 'reserved') return { label: 'Reserved', color: '#8957e5' };
    if (v === '4' || v === 'sold') return { label: 'Sold', color: 'var(--accent-red)' };
    return { label: 'Other', color: 'var(--text-muted)' };
  };

  const renderUnitCard = (unit: any, type: 'Apartment' | 'Villa') => {
    const unitRequests = getRequestsForUnit(unit.arcgisId);
    const s = statusLabel(unit.status);
    
    return (
      <div 
        key={unit._id} 
        onClick={() => setSelectedUnit(unit)}
        style={{ 
          position: 'relative',
          backgroundColor: 'var(--bg-primary)', 
          border: `1px solid ${unitRequests.length > 0 ? 'var(--accent-red)' : 'var(--border-color)'}`, 
          borderRadius: '10px', 
          padding: '16px',
          cursor: 'pointer',
          transition: 'transform 0.2s, boxShadow 0.2s',
          boxShadow: unitRequests.length > 0 ? '0 0 10px rgba(248, 81, 73, 0.2)' : 'none'
        }}
      >
        {unitRequests.length > 0 && (
          <div style={{ position: 'absolute', top: '-10px', right: '-10px', backgroundColor: 'var(--accent-red)', color: 'var(--text-primary)', borderRadius: '20px', padding: '4px 10px', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(0,0,0,0.5)', zIndex: 2 }}>
            {unitRequests.length} Request{unitRequests.length > 1 ? 's' : ''}
          </div>
        )}
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '15px' }}>
            {type} #{unit.objectId || unit.arcgisId}
          </span>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <button 
              onClick={(e) => handleZoom(e, unit)}
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
              title="Zoom to Unit"
            >
              🔍
            </button>
            <span style={{ color: s.color, fontSize: '12px', fontWeight: 'bold', backgroundColor: `${s.color}22`, padding: '2px 8px', borderRadius: '12px' }}>
              {s.label}
            </span>
          </div>
        </div>
        
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
          Click to view details and manage requests.
        </div>
      </div>
    );
  };

  const getCategorizedUnits = () => {
    const apts = units.filter(u => u.sourceLayer === 'Units' || (!u.sourceLayer && u.unitName !== 'فيلا'));
    const vils = units.filter(u => u.sourceLayer === 'Villas_Global' || (!u.sourceLayer && u.unitName === 'فيلا'));
    
    apts.sort((a, b) => getRequestsForUnit(b.arcgisId).length - getRequestsForUnit(a.arcgisId).length);
    vils.sort((a, b) => getRequestsForUnit(b.arcgisId).length - getRequestsForUnit(a.arcgisId).length);
    
    return { apts, vils };
  };

  const { apts, vils } = getCategorizedUnits();

  return (
    <div style={{ position: 'fixed', top: '50px', left: '50%', transform: 'translateX(-50%)', width: '850px', maxHeight: '80vh', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', zIndex: 1001, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)', borderRadius: '12px 12px 0 0' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--accent-blue)' }}>📋 My Property Catalog</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>View your assigned units and manage incoming requests.</p>
        </div>
        <button onClick={onClose} style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>✖ Close</button>
      </div>

      {/* Content */}
      <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading your properties...</div>
        ) : units.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>You have no properties assigned yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {apts.length > 0 && (
              <div>
                <h3 style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '15px' }}>Apartments</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '15px' }}>
                  {apts.map(u => renderUnitCard(u, 'Apartment'))}
                </div>
              </div>
            )}
            
            {vils.length > 0 && (
              <div>
                <h3 style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '15px' }}>Villas</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '15px' }}>
                  {vils.map(u => renderUnitCard(u, 'Villa'))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedUnit && (
        <BrokerUnitRequestsModal 
          unit={selectedUnit} 
          requests={getRequestsForUnit(selectedUnit.arcgisId)} 
          onClose={() => setSelectedUnit(null)}
          onRefresh={() => {
            fetchData();
            // Automatically close if no more requests (optional, but good UX)
            const remaining = getRequestsForUnit(selectedUnit.arcgisId);
            if (remaining.length <= 1) setSelectedUnit(null); // It will have 1 right before refresh, so <= 1 means it will be 0 after refresh. Actually safer to just leave it open or close if empty.
          }}
        />
      )}
    </div>
  );
};

export default BrokerCatalog;
