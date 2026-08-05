import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import BrokerUnitRequestsModal from './BrokerUnitRequestsModal';

interface BrokerMapPopupProps {
  buildingId?: string;      
  villaData?: any;          
  onClose: () => void;
}




const BrokerMapPopup = ({ buildingId, villaData, onClose }: BrokerMapPopupProps) => {
  const { user } = useContext(AuthContext) || {};
  const [units, setUnits] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnitForRequests, setSelectedUnitForRequests] = useState<any | null>(null);

  const fetchData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      // Fetch assigned units
      const unitsRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/roles/user-units/${user.id}?role=broker`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let relevantUnits = [];
      if (villaData) {
        const oId = villaData.OBJECTID;
        const gId = villaData.GlobalID || villaData.globalid;
        relevantUnits = unitsRes.data.filter((u: any) => 
          u.sourceLayer === 'Villas_Global' && 
          (String(u.objectId) === String(oId) || String(u.globalId).toUpperCase() === String(gId).toUpperCase())
        );
      } else if (buildingId) {
        // Query ArcGIS to get all units for this building
        const cleanId = String(buildingId).replace(/[{}]/g, '').trim();
        const upper = cleanId.toUpperCase();
        const lower = cleanId.toLowerCase();
        
        const permutations = [
          `'${cleanId}'`, `'{${cleanId}}'`, 
          `'${upper}'`, `'{${upper}}'`, 
          `'${lower}'`, `'{${lower}}'`
        ];

        const UNITS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37';
        try {
          const arcgisRes = await axios.get(`${UNITS_URL}/query`, {
            params: { 
              where: `BuildingID_FK IN (${permutations.join(',')})`, 
              outFields: 'OBJECTID', 
              f: 'json' 
            }
          });
          
          const buildingAptIds = arcgisRes.data.features ? arcgisRes.data.features.map((f: any) => Number(f.attributes.OBJECTID)) : [];

          relevantUnits = unitsRes.data.filter((u: any) => 
            u.sourceLayer === 'Units' && buildingAptIds.includes(Number(u.objectId))
          );
        } catch (err) {
          console.error("Error querying ArcGIS for building apartments:", err);
        }
      }
      setUnits(relevantUnits);

      // Fetch pending requests
      if (relevantUnits.length > 0) {
        const reqsRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/bookings/broker-pending`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Only keep requests for these relevant units
        const relUnitIds = relevantUnits.map(u => String(u.arcgisId || u.globalId));
        setRequests(reqsRes.data.filter((r: any) => relUnitIds.includes(String(r.unitId))));
      } else {
        setRequests([]);
      }

    } catch (error) {
      console.error('Error fetching broker catalog data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [buildingId, villaData, user]);

  const getRequestsForUnit = (arcgisId: string) => {
    return requests.filter(r => String(r.unitId) === String(arcgisId));
  };



  const title = villaData ? 'Broker Villa Details' : 'Broker Apartment Details';

  return (
    <>
      <div style={{
        position: 'absolute',
        top: '80px',
        right: '20px',
        width: '360px',
        maxHeight: '80vh',
        background: 'rgba(22,27,34,0.92)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-color)',
        borderRadius: '14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInRight 0.25s ease-out',
        color: 'var(--text-secondary)',
        fontFamily: "'Inter', sans-serif",
        overflow: 'hidden'
      }}>
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(110%); opacity: 0; }
            to   { transform: translateX(0);   opacity: 1; }
          }
        `}</style>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 18px',
          borderBottom: '1px solid var(--bg-tertiary)',
          background: 'rgba(33,38,45,0.7)',
          borderTopLeftRadius: '14px',
          borderTopRightRadius: '14px',
          flexShrink: 0
        }}>
          <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '1rem', fontWeight: 700 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'var(--accent-red-bg)', border: 'none', color: 'var(--text-primary)', cursor: 'pointer',
              fontSize: '0.85rem', width: '26px', height: '26px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: '0.2s', boxShadow: '0 2px 6px rgba(0,0,0,0.4)', flexShrink: 0
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.12)'}
            onMouseOut={e  => e.currentTarget.style.transform = 'scale(1)'}
            title="Close"
          >✖</button>
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Loading your property details...</div>
          ) : units.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              You do not manage any units at this location.
            </div>
          ) : (
            units.map(unit => {
              const unitRequests = getRequestsForUnit(unit.arcgisId || unit.globalId);
              
              return (
                <div 
                  key={unit._id} 
                  style={{ 
                    position: 'relative',
                    backgroundColor: 'var(--bg-primary)', 
                    border: `1px solid ${unitRequests.length > 0 ? 'var(--accent-red)' : 'var(--border-color)'}`, 
                    borderRadius: '10px', 
                    padding: '16px',
                    boxShadow: unitRequests.length > 0 ? '0 0 15px rgba(248, 81, 73, 0.15)' : 'none'
                  }}
                >
                  {unitRequests.length > 0 && (
                    <div style={{ position: 'absolute', top: '-10px', right: '-10px', backgroundColor: 'var(--accent-red)', color: 'var(--text-primary)', borderRadius: '20px', padding: '4px 10px', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                      {unitRequests.length} Request{unitRequests.length > 1 ? 's' : ''}
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '15px' }}>
                      {villaData ? 'Villa' : 'Apartment'} #{unit.objectId || unit.arcgisId}
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedUnitForRequests(unit)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: unitRequests.length > 0 ? 'var(--accent-red-bg)' : 'var(--accent-green-bg)',
                      color: 'var(--text-primary)',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      transition: '0.2s',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                    }}
                    onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.2)'}
                    onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
                  >
                    Manage Requests {unitRequests.length > 0 ? `(${unitRequests.length})` : ''}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedUnitForRequests && (
        <BrokerUnitRequestsModal 
          unit={selectedUnitForRequests} 
          requests={getRequestsForUnit(selectedUnitForRequests.arcgisId || selectedUnitForRequests.globalId)} 
          onClose={() => setSelectedUnitForRequests(null)}
          onRefresh={fetchData}
        />
      )}
    </>
  );
};

export default BrokerMapPopup;
