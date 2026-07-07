import { useState, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom'; 
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import ComplaintForm from './ComplaintForm'; 

interface Unit {
  _id: string;
  unitName: string;
  globalId?: string;
  arcgisId?: string;
  status: string;
}

interface OwnerUnitsTabProps {
  onClose: () => void;
}

const OwnerUnitsTab = ({ onClose }: OwnerUnitsTabProps) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showComplaintForm, setShowComplaintForm] = useState<boolean>(false); 
  const auth = useContext(AuthContext);

  useEffect(() => {
    const fetchMyUnits = async () => {
      try {
        const token = auth?.token || localStorage.getItem('token');
        if (!token) return;

        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/users/my-units`, {
          headers: { 'x-auth-token': token }
        });
        
        setUnits(response.data);
      } catch (error) {
        console.error("Error fetching units:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMyUnits();
  }, [auth]);

  const handleComplaintClick = () => {
    setShowComplaintForm(true); 
  };

  return createPortal(
    <div 
      onClick={onClose} // يقفل لو دوست في الخلفية السودا
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        backgroundColor: 'rgba(13, 17, 23, 0.85)', // شفافية أهدى شوية
        zIndex: 9999999, 
        display: 'flex', 
        justifyContent: 'center',
        alignItems: 'center',
        color: '#c9d1d9', 
        fontFamily: 'sans-serif',
        pointerEvents: 'auto' // 👈 بيعالج مشكلة الضغطات الضايعة
      }}
    >
      
      <div 
        onClick={(e) => e.stopPropagation()} 
        style={{
          backgroundColor: '#0d1117',
          width: '75vw', // 👈 صغرنا العرض عشان متبقاش ممطوطة
          maxWidth: '1000px', // 👈 أقصى عرض للشاشة
          height: '75vh', // 👈 صغرنا الطول
          maxHeight: '700px', // 👈 أقصى طول
          borderRadius: '12px',
          border: '1px solid #30363d',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px', // 👈 صغرنا المسافات الداخلية
          boxSizing: 'border-box',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
        }}
      >
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #30363d', paddingBottom: '16px', marginBottom: '20px', flexShrink: 0 }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            🏠 Owner Dashboard
          </h2>
          
          {/* 🚀 زرار الـ X اتعالج جذرياً وتم تصغيره */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: '#ff7b72', 
              fontSize: '28px', // 👈 صغرنا حجم الزرار
              cursor: 'pointer', 
              fontWeight: 'bold',
              pointerEvents: 'auto', // 👈 إجباري يلقط الضغطة
              padding: '5px'
            }}
          >
            ✕
          </button>
        </div>

        <h3 style={{ marginTop: 0, color: '#8b949e', fontSize: '1.1rem', marginBottom: '16px', flexShrink: 0 }}>🏢 My Owned Units</h3>

        {/* Table Container */}
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#010409', borderRadius: '8px', border: '1px solid #30363d' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#58a6ff', fontSize: '1.1rem' }}>Loading your units... ⏳</div>
          ) : units.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e', fontSize: '1.1rem' }}>You do not own any units yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}> {/* 👈 صغرنا خط الجدول */}
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#161b22', zIndex: 10 }}>
                <tr style={{ borderBottom: '2px solid #30363d' }}>
                  <th style={{ padding: '16px', color: '#fff' }}>#</th> {/* 👈 صغرنا المسافات */}
                  <th style={{ padding: '16px', color: '#fff' }}>Unit Type</th>
                  <th style={{ padding: '16px', color: '#fff' }}>Map Identifier (ID)</th>
                  <th style={{ padding: '16px', color: '#fff' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit, index) => {
                  const rawName = String(unit.unitName || '');
                  const displayType = rawName.includes('فيلا') ? 'Villa' : (rawName.includes('شقة') ? 'Apartment' : 'Building');
                  const displayId = unit.globalId || unit.arcgisId || 'N/A';
                  
                  return (
                    <tr key={unit._id} style={{ borderBottom: '1px solid #30363d', backgroundColor: index % 2 === 0 ? '#0d1117' : '#161b22' }}>
                      <td style={{ padding: '16px', color: '#8b949e' }}>{index + 1}</td>
                      <td style={{ padding: '16px', color: '#58a6ff', fontWeight: 'bold' }}>{displayType}</td>
                      <td style={{ padding: '16px', color: '#c9d1d9', fontFamily: 'monospace' }}>{displayId}</td>
                      <td style={{ padding: '16px' }}>
                        <span style={{ backgroundColor: '#2ea04322', color: '#2ea043', padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #2ea04355' }}>
                          ✅ Owned
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Action Button */}
        {units.length > 0 && (
          <div style={{ borderTop: '1px solid #30363d', paddingTop: '16px', marginTop: '16px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              onClick={handleComplaintClick} 
              style={{ 
                padding: '10px 20px', // 👈 صغرنا زرار الشكوى
                backgroundColor: '#da3633', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                fontWeight: 'bold', 
                fontSize: '14px', // 👈 صغرنا خط زرار الشكوى
                transition: 'background 0.2s', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                pointerEvents: 'auto'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b62324'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#da3633'}
            >
              🛠️ Submit Maintenance / Complaint Request
            </button>
          </div>
        )}

      </div>

      {showComplaintForm && (
        <ComplaintForm 
          onClose={() => setShowComplaintForm(false)} 
          arcgisId={units.length > 0 ? (units[0].globalId || units[0].arcgisId || "") : ""} 
        />
      )}

    </div>,
    document.body
  );
};

export default OwnerUnitsTab;