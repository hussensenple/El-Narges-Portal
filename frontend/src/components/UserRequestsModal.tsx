import { useState, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

interface BookingReq {
  _id: string;
  unitId: string;
  objectId?: number;
  sourceLayer?: string;
  buildingFK?: string;
  customerName: string;
  customerPhone: string;
  status: string;
  createdAt: string;
}

interface UserRequestsModalProps {
  onClose: () => void;
  view?: any; // The ArcGIS SceneView object
}

const UserRequestsModal = ({ onClose, view }: UserRequestsModalProps) => {
  const [requests, setRequests] = useState<BookingReq[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const auth = useContext(AuthContext);

  useEffect(() => {
    const fetchMyRequests = async () => {
      try {
        const token = auth?.token || localStorage.getItem('token');
        if (!token) return;

        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/bookings/my-requests`, {
          headers: { 'x-auth-token': token }
        });

        // The API returns all requests for this user
        setRequests(response.data);
      } catch (error) {
        console.error("Error fetching my requests:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMyRequests();
  }, [auth]);

  const handleViewUnit = async (req: BookingReq) => {
    if (!view || !view.map) {
      alert("Map is not ready yet.");
      return;
    }
    
    // Determine the source layer (Villas_Global or Units)
    const sourceLayer = req.sourceLayer;
    
    const getWhereClause = (id: string) => {
      if (/^\d+$/.test(id)) {
        return `OBJECTID = ${id}`;
      }
      const idUpper = id.toUpperCase();
      const idLower = id.toLowerCase();
      return `GlobalID = '{${idUpper}}' OR GlobalID = '${idUpper}' OR GlobalID = '{${idLower}}' OR GlobalID = '${idLower}' OR GlobalID = '{${id}}' OR GlobalID = '${id}'`;
    };

    try {
      if (sourceLayer === 'Villas_Global') {
        const layer = view.map.layers.find((l: any) => l.title === "Villas_Global");
        if (layer) {
          const query = layer.createQuery();
          const cleanId = String(req.unitId).replace(/[{}]/g, '').trim();
          query.where = getWhereClause(cleanId);
          query.returnGeometry = true;
          
          const extentRes = await layer.queryExtent(query);
          if (extentRes && extentRes.extent) {
            view.goTo({ target: extentRes.extent, tilt: 60, zoom: 20 }, { animate: true, duration: 1500 });
          }
          
          const objectIds = await layer.queryObjectIds(query);
          if (objectIds && objectIds.length > 0) {
            const layerView = await view.whenLayerView(layer);
            if ((window as any).viewUnitHighlightHandle) {
              (window as any).viewUnitHighlightHandle.remove();
            }
            (window as any).viewUnitHighlightHandle = layerView.highlight(objectIds);
          }
        }
      } else if (sourceLayer === 'Units') {
        const foreignKey = req.buildingFK;
        
        if (foreignKey) {
          const buildingLayer = view.map.layers.find((l: any) => l.title === "Buildings_Global");
          if (buildingLayer) {
            const query = buildingLayer.createQuery();
            const cleanId = String(foreignKey).replace(/[{}]/g, '').trim();
            query.where = getWhereClause(cleanId);
            query.returnGeometry = true;
            
            const extentRes = await buildingLayer.queryExtent(query);
            if (extentRes && extentRes.extent) {
              view.goTo({ target: extentRes.extent, tilt: 60, zoom: 20 }, { animate: true, duration: 1500 });
            }
            
            const objectIds = await buildingLayer.queryObjectIds(query);
            if (objectIds && objectIds.length > 0) {
              const layerView = await view.whenLayerView(buildingLayer);
              if ((window as any).viewUnitHighlightHandle) {
                (window as any).viewUnitHighlightHandle.remove();
              }
              (window as any).viewUnitHighlightHandle = layerView.highlight(objectIds);
            }
          }
        } else {
          alert("Building information is missing for this unit.");
        }
      }
      
      onClose(); // Close the modal so the user can see the map
    } catch (error) {
      console.error("Error viewing unit:", error);
    }
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        display: 'flex',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(13, 17, 23, 0.85)',
        zIndex: 9999999,
        justifyContent: 'center',
        alignItems: 'center',
        color: 'var(--text-secondary)',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-primary)',
          width: '75vw',
          maxWidth: '1000px',
          height: '75vh',
          maxHeight: '700px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          boxSizing: 'border-box',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px', flexShrink: 0 }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            🤝 My Requests
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#ff7b72', fontSize: '28px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '150px' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--accent-blue)', fontSize: '1.1rem' }}>Loading your requests... ⏳</div>
          ) : requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '1.1rem' }}>You haven't made any booking requests yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 10 }}>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '16px', color: 'var(--text-primary)' }}>Date</th>
                  <th style={{ padding: '16px', color: 'var(--text-primary)' }}>Unit Type</th>
                  <th style={{ padding: '16px', color: 'var(--text-primary)' }}>Unit ID</th>
                  <th style={{ padding: '16px', color: 'var(--text-primary)' }}>Status</th>
                  <th style={{ padding: '16px', color: 'var(--text-primary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req, index) => {
                  const date = new Date(req.createdAt).toLocaleDateString('en-GB');
                  const displayType = req.sourceLayer === 'Villas_Global' ? 'Villa' : 'Apartment';
                  
                  let statusStyles = { bg: 'var(--text-muted)22', color: 'var(--text-muted)', border: 'var(--text-muted)55', text: req.status };
                  
                  if (req.status === 'Pending') {
                    statusStyles = { bg: 'var(--accent-gold)22', color: 'var(--accent-gold)', border: 'var(--accent-gold)55', text: '⏳ Pending' };
                  } else if (req.status === 'Approved') {
                    statusStyles = { bg: 'var(--accent-green)22', color: 'var(--accent-green)', border: 'var(--accent-green)55', text: '✅ Approved' };
                  } else if (req.status === 'Rejected' || req.status === 'Declined') {
                    statusStyles = { bg: 'var(--accent-red)22', color: 'var(--accent-red)', border: 'var(--accent-red)55', text: '❌ ' + req.status };
                  } else if (req.status === 'Reserved') {
                    statusStyles = { bg: '#a371f722', color: '#a371f7', border: '#a371f755', text: '🔒 Reserved' };
                  }

                  return (
                    <tr key={req._id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: index % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)' }}>
                      <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{date}</td>
                      <td style={{ padding: '16px', color: 'var(--accent-blue)', fontWeight: 'bold' }}>{displayType}</td>
                      <td style={{ padding: '16px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{req.unitId}</td>
                      <td style={{ padding: '16px' }}>
                        <span style={{ backgroundColor: statusStyles.bg, color: statusStyles.color, padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 'bold', border: `1px solid ${statusStyles.border}` }}>
                          {statusStyles.text}
                        </span>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <button
                          onClick={() => handleViewUnit(req)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: 'var(--accent-blue-bg)',
                            color: 'var(--text-primary)',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '13px',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#388bfd'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-blue-bg)'}
                        >
                          👁️ View Unit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default UserRequestsModal;
