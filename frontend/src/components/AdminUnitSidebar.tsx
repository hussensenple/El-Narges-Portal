import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import ComplaintChatModal from './ComplaintChatModal';

interface AdminUnitSidebarProps {
  buildingId?: string | null;
  villaData?: any | null;
  onClose: () => void;
}

const BASE_URL = window.location.origin;

const getVillaDesignUrl = (attrs: any) => {
  if (attrs.Image_Name) return `${BASE_URL}/${attrs.Image_Name.replace('.png', '')}.png`;
  if (attrs.VillaModel) return `${BASE_URL}/${attrs.VillaModel}.png`;
  return null;
};

const getBuildingDesignUrl = (model: string) => {
  if (!model) return null;
  const m = model.toUpperCase();
  if (m.includes('S')) return `${BASE_URL}/S.png`;
  if (m.includes('U')) return `${BASE_URL}/U.png`;
  if (m.includes('X')) return `${BASE_URL}/X.png`;
  if (m.includes('Z')) return `${BASE_URL}/Z.png`;
  return `${BASE_URL}/S.png`;
};

const AdminUnitSidebar = ({ buildingId, villaData, onClose }: AdminUnitSidebarProps) => {
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [designImage, setDesignImage] = useState<string | null>(null);
  const [activeComplaint, setActiveComplaint] = useState<any | null>(null);
  const auth = useContext(AuthContext);

  const isEngineer = auth?.user?.role === 'engineer';
  const panelTitle = isEngineer ? '🛠️ Engineer Unit Panel' : '🛠️ Admin Unit Panel';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const complaintsUrl = isEngineer 
          ? `${import.meta.env.VITE_API_URL}/api/complaints/engineer`
          : `${import.meta.env.VITE_API_URL}/api/complaints/all`;

        const [mongoUnitsRes, complaintsRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/api/admin/all-units`, { headers: { 'x-auth-token': token } }),
          axios.get(complaintsUrl, { headers: { 'x-auth-token': token } })
        ]);

        const allComplaints = complaintsRes.data.complaints || complaintsRes.data || [];
        setComplaints(Array.isArray(allComplaints) ? allComplaints : []);

        let arcgisUnits: any[] = [];
        if (buildingId) {
          const UNITS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37';
          const res = await axios.get(`${UNITS_URL}/query`, {
            params: { where: `BuildingID_FK='${buildingId}'`, outFields: '*', f: 'json' }
          });
          arcgisUnits = res.data.features ? res.data.features.map((f: any) => f.attributes) : [];
          arcgisUnits.sort((a: any, b: any) => (a.OBJECTID || 0) - (b.OBJECTID || 0));
        } else if (villaData) {
          arcgisUnits = [villaData];
        }

        const backendUnits = mongoUnitsRes.data || [];

        const merged = arcgisUnits.map(arcUnit => {
          const uObj = String(arcUnit.OBJECTID);
          const uGlob = String(arcUnit.GlobalID || arcUnit.globalid || '');
          const backUnit = backendUnits.find((b: any) => {
            const bObj = String(b.objectId || b.OBJECTID || '');
            const bGlob = String(b.globalId || b.GlobalID || '');
            const bArcgis = String(b.arcgisId || '');
            return bObj === uObj || bArcgis === uObj || bArcgis === uGlob || (bGlob && uGlob && bGlob.toLowerCase() === uGlob.toLowerCase());
          });
          
          return { ...arcUnit, owner: backUnit?.ownerId || null };
        });

        setUnits(merged);
      } catch (err) {
        console.error("AdminUnitSidebar fetch error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [buildingId, villaData]);

  const handleUpdateStatus = async (complaintId: string, status: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL}/api/complaints/${complaintId}/status-name`, 
        { status },
        { headers: { 'x-auth-token': token } }
      );
      setComplaints(prev => prev.map(c => c._id === complaintId ? { ...c, status } : c));
    } catch (err) {
      console.error("Failed to update status", err);
      alert("Failed to update status");
    }
  };

  const renderComplaint = (c: any) => {
    return (
      <div key={c._id} style={{ backgroundColor: c.priority === 'High' ? '#2c1214' : '#161b22', border: `1px solid ${c.priority === 'High' ? '#f85149' : '#30363d'}`, borderRadius: '6px', padding: '10px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ color: '#58a6ff', fontSize: '14px' }}>{c.problemName || c.title}</strong>
          <span style={{ fontSize: '11px', color: '#8b949e' }}>{new Date(c.createdAt).toLocaleDateString()}</span>
        </div>
        <p style={{ margin: 0, color: '#c9d1d9', fontSize: '13px' }}>{c.description}</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select 
            value={c.status}
            onChange={(e) => handleUpdateStatus(c._id, e.target.value)}
            style={{ flex: 1, padding: '4px', borderRadius: '4px', backgroundColor: '#0d1117', color: '#fff', border: '1px solid #30363d', fontSize: '12px' }}
          >
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Solved">Solved</option>
          </select>
          <button onClick={() => setActiveComplaint(c)} style={{ padding: '4px 8px', backgroundColor: '#1f6feb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Chat</button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div style={{ 
        position: 'fixed', 
        top: '80px', 
        right: '26px', 
        bottom: '26px',
        width: '380px', 
        backgroundColor: '#0d1117', 
        borderRadius: '16px',
        border: '1px solid #30363d', 
        display: 'flex', 
        flexDirection: 'column', 
        zIndex: 9999, 
        boxShadow: '0 8px 32px rgba(0,0,0,0.8)', 
        overflow: 'hidden'
      }}>
        
        <div style={{ padding: '20px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#010409' }}>
          <h2 style={{ margin: 0, color: '#e6edf3', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {panelTitle}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {loading ? (
            <div style={{ color: '#8b949e', textAlign: 'center' }}>Loading unit data...</div>
          ) : (
            units.map((unit, idx) => {
              const hasMongoOwner = !!unit.owner;
              const isOccupied = hasMongoOwner || !!unit.OwnerName || unit.Status === '4' || unit.Status === 'Sold';
              
              // Match complaints by ArcGIS ID or Global ID instead of just ownerId
              // This ensures we catch external complaints and complaints where MongoDB ownerId is missing
              const unitComplaints = complaints.filter(c => {
                if (!c.arcgisId) return false;
                const cId = String(c.arcgisId).replace(/[{}]/g, '').toLowerCase();
                const uObj = String(unit.OBJECTID).toLowerCase();
                const uGlob = String(unit.GlobalID || unit.globalid || '').replace(/[{}]/g, '').toLowerCase();
                return cId === uObj || (uGlob && cId === uGlob) || cId === `${unit.BuildingID_FK}_${unit.OBJECTID}`.toLowerCase();
              });

              const arcgisId = unit.BuildingID_FK ? `${unit.BuildingID_FK}_${unit.OBJECTID}` : `VILLA_${unit.OBJECTID}`;
              const designUrl = unit.BuildingModel ? getBuildingDesignUrl(unit.BuildingModel) : getVillaDesignUrl(unit);

              return (
                <div key={idx} style={{ border: '1px solid #30363d', borderRadius: '8px', padding: '15px', backgroundColor: '#161b22' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '16px' }}>Unit {unit.OBJECTID}</h3>
                    <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: isOccupied ? '#8957e533' : '#3fb95033', color: isOccupied ? '#d2a8ff' : '#3fb950' }}>
                      {isOccupied ? 'Occupied' : 'Free'}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: '13px', color: '#8b949e', marginBottom: '10px' }}>
                    <strong>ID:</strong> {unit.GlobalID || unit.globalid || arcgisId}
                  </div>

                  {isOccupied && (
                    <div style={{ backgroundColor: '#0d1117', padding: '10px', borderRadius: '6px', border: '1px solid #30363d', marginBottom: '10px' }}>
                      <div style={{ color: '#c9d1d9', fontSize: '14px', marginBottom: '4px' }}>
                        👤 <strong>{hasMongoOwner ? unit.owner.name : (unit.OwnerName || 'Unknown Owner')}</strong>
                      </div>
                      <div style={{ color: '#8b949e', fontSize: '12px' }}>
                        {hasMongoOwner ? unit.owner.email : (unit.OwnerEmail || 'No Email')}
                      </div>
                      {(hasMongoOwner ? unit.owner.phone : unit.OwnerPhone) && (
                        <div style={{ color: '#8b949e', fontSize: '12px' }}>
                          {hasMongoOwner ? unit.owner.phone : unit.OwnerPhone}
                        </div>
                      )}
                    </div>
                  )}

                  <button 
                    onClick={() => setDesignImage(designUrl || '/A.png')}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#21262d', color: '#58a6ff', border: '1px solid #30363d', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '5px' }}
                  >
                    📐 Explore Plan
                  </button>

                  {unitComplaints.length > 0 && (
                    <div style={{ marginTop: '15px' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#e6edf3', fontSize: '14px', borderBottom: '1px solid #30363d', paddingBottom: '5px' }}>Complaints ({unitComplaints.length})</h4>
                      {unitComplaints.map(renderComplaint)}
                    </div>
                  )}
                  {unitComplaints.length === 0 && (
                    <div style={{ marginTop: '15px', color: '#8b949e', fontSize: '12px', textAlign: 'center' }}>No complaints filed for this unit.</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {designImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setDesignImage(null)}>
          <img src={designImage} alt="Unit Plan" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }} />
          <button style={{ position: 'absolute', top: '20px', right: '30px', background: 'transparent', border: 'none', color: '#fff', fontSize: '30px', cursor: 'pointer' }} onClick={() => setDesignImage(null)}>✕</button>
        </div>
      )}

      {activeComplaint && (
        <ComplaintChatModal 
          complaint={activeComplaint} 
          onClose={() => setActiveComplaint(null)}
          onRefresh={() => {}}
          currentUser={auth?.user as any}
        />
      )}
    </>
  );
};

export default AdminUnitSidebar;
