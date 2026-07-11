import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

interface BuildingSidebarProps {
  buildingId: string;
  onClose: () => void;
}

const BuildingSidebar = ({ buildingId, onClose }: BuildingSidebarProps) => {
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const auth = useContext(AuthContext);

  const handleBook = async (unit: any) => {
    const currentToken = auth?.token || localStorage.getItem('token');
    if (!currentToken || !auth?.user) {
      alert("❌ Please log in first to book an apartment.");
      return;
    }

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/bookings/request`, {
        unitId: String(unit.GlobalID || unit.OBJECTID),
        objectId: unit.OBJECTID,
        sourceLayer: 'Units',
        buildingFK: unit.BuildingID_FK,
        customerName: auth.user.name,
        customerPhone: (auth.user as any).phone || 'N/A',
        customerGmail: (auth.user as any).email || (auth.user as any).gmail || 'N/A'
      }, {
        headers: { 'x-auth-token': currentToken }
      });
      alert("🎉 Booking request sent successfully! Our sales team will review your request.");
    } catch (error: any) {
      if (error.response?.status === 400) {
        alert("❌ " + (error.response.data.error || error.response.data.msg));
      } else {
        alert("❌ An error occurred, please try again later.");
      }
    }
  };

  useEffect(() => {
    const fetchUnits = async () => {
      try {
        setLoading(true);
        const UNITS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37';
        const res = await axios.get(`${UNITS_URL}/query`, {
          params: {
            where: `BuildingID_FK='${buildingId}'`,
            outFields: '*',
            f: 'json'
          }
        });
        
        const buildingUnits = res.data.features ? res.data.features.map((f: any) => f.attributes) : [];

        // Sort by unit number if possible, assuming OBJECTID or a similar field
        buildingUnits.sort((a: any, b: any) => (a.OBJECTID || 0) - (b.OBJECTID || 0));

        setUnits(buildingUnits);
      } catch (error) {
        console.error("Error fetching units:", error);
      } finally {
        setLoading(false);
      }
    };

    if (buildingId) {
      fetchUnits();
    }
  }, [buildingId]);

  return (
    <div style={{
      position: 'absolute',
      top: '80px',
      right: '92px',
      width: '349px',
      maxHeight: 'calc(100vh - 140px)',
      height: 'auto',
      backgroundColor: 'rgba(22, 27, 34, 0.95)',
      backdropFilter: 'blur(10px)',
      border: '1px solid #30363d',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideInRight 0.3s ease-out',
      color: '#c9d1d9',
      fontFamily: 'sans-serif'
    }}>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid #30363d', backgroundColor: 'rgba(33, 38, 45, 0.6)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
        <h3 style={{ margin: 0, color: '#58a6ff', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>🏢 Building Details</h3>
        <button
          onClick={onClose}
          style={{ background: '#da3633', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1rem', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          title="Close Sidebar"
        >
          ✖
        </button>
      </div>

      <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#8b949e', marginTop: '20px' }}>Loading apartments...</div>
        ) : units.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8b949e', marginTop: '20px' }}>No apartments found for this building.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {units.map((unit, idx) => {
              const isSold = unit.Status === 'Sold' || unit.Status === '4' || unit.Status == 4 || unit.Status == 3;
              return (
                <div key={idx} style={{
                  backgroundColor: '#0d1117',
                  border: isSold ? '1px solid #da3633' : '1px solid #238636',
                  borderRadius: '10px',
                  padding: '15px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, color: '#e6edf3' }}>Apartment #{unit.OBJECTID}</h4>
                    <span style={{
                      backgroundColor: isSold ? 'rgba(218, 54, 51, 0.2)' : 'rgba(35, 134, 54, 0.2)',
                      color: isSold ? '#ff7b72' : '#3fb950',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold'
                    }}>
                      {isSold ? 'Sold / Reserved' : 'Available'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div style={{ fontSize: '0.9rem', color: '#8b949e' }}>
                      <p style={{ margin: '5px 0' }}>💰 Price: <strong style={{ color: '#fff' }}>{unit.Price ? (unit.Price / 1000000).toFixed(2) + ' M EGY' : 'N/A'}</strong></p>
                    </div>
                    {!isSold && (
                      <button
                        onClick={() => handleBook(unit)}
                        style={{ backgroundColor: '#1f6feb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', transition: '0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#388bfd'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1f6feb'}
                      >
                        🔖 Book Now
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BuildingSidebar;
