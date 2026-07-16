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
  objectId?: number;
  sourceLayer?: string;
  status: string;
}

interface Complaint {
  _id: string;
  title: string;
  arcgisId: string;
  type: string;
  description: string;
  status: string;
  createdAt: string;
}

interface BookingReq {
  _id: string;
  unitId: string;
  sourceLayer?: string;
  buildingFK?: string;
  customerName: string;
  customerPhone: string;
  status: string;
  createdAt: string;
}

interface OwnerUnitsTabProps {
  onClose: () => void;
  view?: any;
}

const OwnerUnitsTab = ({ onClose, view }: OwnerUnitsTabProps) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [allComplaints, setAllComplaints] = useState<Complaint[]>([]);
  const [bookingRequests, setBookingRequests] = useState<BookingReq[]>([]);
  const [isLoadingComplaints, setIsLoadingComplaints] = useState<boolean>(true);
  const [isLoadingRequests, setIsLoadingRequests] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'units' | 'my-requests' | 'complaints'>('units');
  const [showComplaintForm, setShowComplaintForm] = useState<boolean>(false);
  const [selectedArcgisId, setSelectedArcgisId] = useState<string>('');
  const [isPickingLocation, setIsPickingLocation] = useState<boolean>(false);

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

    const fetchMyComplaints = async () => {
      try {
        const token = auth?.token || localStorage.getItem('token');
        if (!token) return;

        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/complaints/my`, {
          headers: { 'x-auth-token': token }
        });

        setAllComplaints(response.data);
      } catch (error) {
        console.error("Error fetching complaints:", error);
      } finally {
        setIsLoadingComplaints(false);
      }
    };

    const fetchMyRequests = async () => {
      try {
        const token = auth?.token || localStorage.getItem('token');
        if (!token) return;

        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/bookings/my-requests`, {
          headers: { 'x-auth-token': token }
        });

        setBookingRequests(response.data);
      } catch (error) {
        console.error("Error fetching booking requests:", error);
      } finally {
        setIsLoadingRequests(false);
      }
    };

    fetchMyUnits();
    fetchMyComplaints();
    fetchMyRequests();
  }, [auth]);

  const handleComplaintClick = (arcgisId: string) => {
    setSelectedArcgisId(arcgisId);
    setShowComplaintForm(true);
  };

  const handleViewMyUnit = async (unit: any) => {
    if (!view || !view.map) {
      alert("Map is not ready yet.");
      return;
    }
    
    let sourceLayer = unit.sourceLayer;
    if (!sourceLayer) {
      if (unit.unitType === 'Villa' || unit.unitName === 'Villa') {
        sourceLayer = 'Villas_Global';
      } else if (unit.unitType === 'Apartment' || unit.unitName === 'Apartment') {
        sourceLayer = 'Units';
      } else {
        sourceLayer = 'Units'; // default assumption
      }
    }
    
    const cleanId = String(unit.globalId || unit.arcgisId || '').replace(/[{}]/g, '').trim();
    
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
          query.where = getWhereClause(cleanId);
          query.returnGeometry = true;
          
          const extentRes = await layer.queryExtent(query);
          if (extentRes && extentRes.extent) {
            view.goTo({ target: extentRes.extent, tilt: 60, zoom: 20 }, { animate: true, duration: 1500 });
          }
          
          const objectIds = await layer.queryObjectIds(query);
          if (objectIds && objectIds.length > 0) {
            const layerView = await view.whenLayerView(layer) as any;
            if ((window as any).viewUnitHighlightHandle) {
              (window as any).viewUnitHighlightHandle.remove();
            }
            (window as any).viewUnitHighlightHandle = layerView.highlight(objectIds);
          }
        }
      } else if (sourceLayer === 'Units') {
        let foreignKey = unit.buildingIdFk || unit.buildingFK;
        
        if (!foreignKey) {
          const unitsTable = view.map.tables?.find((t:any) => t.title === "Units") || view.map.layers.find((l:any) => l.title === "Units");
          if (unitsTable) {
            const query = unitsTable.createQuery();
            query.where = getWhereClause(cleanId);
            query.outFields = ["BuildingID_FK"];
            const results = await unitsTable.queryFeatures(query);
            if (results.features && results.features.length > 0) {
              foreignKey = results.features[0].attributes.BuildingID_FK;
            }
          }
        }
        
        if (foreignKey) {
          const buildingLayer = view.map.layers.find((l: any) => l.title === "Buildings_Global");
          if (buildingLayer) {
            try {
              const bQuery = buildingLayer.createQuery();
              const cleanFk = String(foreignKey).replace(/[{}]/g, '').trim();
              bQuery.where = getWhereClause(cleanFk);
              bQuery.returnGeometry = true;
              
              const extentRes = await buildingLayer.queryExtent(bQuery);
              if (extentRes && extentRes.extent) {
                view.goTo({ target: extentRes.extent, tilt: 60, zoom: 20 }, { animate: true, duration: 1500 });
              }
              
              const objectIds = await buildingLayer.queryObjectIds(bQuery);
              if (objectIds && objectIds.length > 0) {
                const layerView = await view.whenLayerView(buildingLayer);
                if ((window as any).viewUnitHighlightHandle) {
                  (window as any).viewUnitHighlightHandle.remove();
                }
                (window as any).viewUnitHighlightHandle = layerView.highlight(objectIds);
              }
            } catch (err) {
              console.error("Error highlighting building:", err);
            }
          }
        } else {
          alert("Building information is missing for this unit.");
        }

      }
      
      onClose();
    } catch (error) {
      console.error("Error viewing unit:", error);
    }
  };

  const handleViewUnit = async (req: BookingReq) => {
    if (!view || !view.map) {
      alert("Map is not ready yet.");
      return;
    }
    
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
            const layerView = await view.whenLayerView(layer) as any;
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
              const layerView = await view.whenLayerView(buildingLayer) as any;
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
      
      onClose();
    } catch (error) {
      console.error("Error viewing unit:", error);
    }
  };

  return createPortal(
    <>
      {/* 🚀 إخفاء الشاشة بالـ CSS بدل مسحها عشان متعملش بج */}
      <div
        onClick={onClose}
        style={{
          display: isPickingLocation ? 'none' : 'flex', // 👈 الحل السحري هنا
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(13, 17, 23, 0.85)',
          zIndex: 9999999,
          justifyContent: 'center',
          alignItems: 'center',
          color: '#c9d1d9',
          fontFamily: 'sans-serif',
          pointerEvents: 'auto'
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: '#0d1117',
            width: '75vw',
            maxWidth: '1000px',
            height: '75vh',
            maxHeight: '700px',
            borderRadius: '12px',
            border: '1px solid #30363d',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
            boxSizing: 'border-box',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #30363d', paddingBottom: '16px', marginBottom: '20px', flexShrink: 0 }}>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              🏠 Owner Dashboard
            </h2>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              style={{ background: 'transparent', border: 'none', color: '#ff7b72', fontSize: '28px', cursor: 'pointer', fontWeight: 'bold', pointerEvents: 'auto', padding: '5px' }}
            >
              ✕
            </button>
          </div>

          {/* Tabs Navigation */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #30363d', paddingBottom: '10px' }}>
            <button
              onClick={() => setActiveTab('units')}
              style={{
                padding: '10px 16px',
                backgroundColor: activeTab === 'units' ? '#1f6feb' : 'transparent',
                color: activeTab === 'units' ? '#fff' : '#8b949e',
                border: '1px solid',
                borderColor: activeTab === 'units' ? '#1f6feb' : 'transparent',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                transition: 'all 0.2s',
              }}
            >
              🏢 My Units
            </button>
            <button
              onClick={() => setActiveTab('my-requests')}
              style={{
                padding: '10px 16px',
                backgroundColor: activeTab === 'my-requests' ? '#1f6feb' : 'transparent',
                color: activeTab === 'my-requests' ? '#fff' : '#8b949e',
                border: '1px solid',
                borderColor: activeTab === 'my-requests' ? '#1f6feb' : 'transparent',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                transition: 'all 0.2s',
              }}
            >
              🤝 My Requests
            </button>
            <button
              onClick={() => setActiveTab('complaints')}
              style={{
                padding: '10px 16px',
                backgroundColor: activeTab === 'complaints' ? '#1f6feb' : 'transparent',
                color: activeTab === 'complaints' ? '#fff' : '#8b949e',
                border: '1px solid',
                borderColor: activeTab === 'complaints' ? '#1f6feb' : 'transparent',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                transition: 'all 0.2s',
              }}
            >
              📋 Complaints
            </button>
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#010409', borderRadius: '8px', border: '1px solid #30363d', minHeight: '150px' }}>
            
            {/* Units Tab */}
            {activeTab === 'units' && (
              <>
                {isLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#58a6ff', fontSize: '1.1rem' }}>Loading your units... ⏳</div>
                ) : units.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e', fontSize: '1.1rem' }}>You do not own any units yet.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#161b22', zIndex: 10 }}>
                      <tr style={{ borderBottom: '2px solid #30363d' }}>
                        <th style={{ padding: '16px', color: '#fff' }}>#</th>
                        <th style={{ padding: '16px', color: '#fff' }}>Unit Type</th>
                        <th style={{ padding: '16px', color: '#fff' }}>Map Identifier (ID)</th>
                        <th style={{ padding: '16px', color: '#fff' }}>Status</th>
                        <th style={{ padding: '16px', color: '#fff' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {units.map((unit, index) => {
                        const displayType = unit.sourceLayer === 'Villas_Global' ? 'Villa' : 'Apartment';
                        const displayId = unit.objectId || unit.globalId || unit.arcgisId || 'N/A';
                        const arcgisId = unit.globalId || unit.arcgisId || '';

                        return (
                          <tr key={unit._id} style={{ borderBottom: '1px solid #30363d', backgroundColor: index % 2 === 0 ? '#0d1117' : '#161b22' }}>
                            <td style={{ padding: '16px', color: '#8b949e' }}>{index + 1}</td>
                            <td style={{ padding: '16px', color: '#58a6ff', fontWeight: 'bold' }}>{displayType}</td>
                            <td style={{ padding: '16px', color: '#c9d1d9', fontFamily: 'monospace' }}>{displayId}</td>
                            <td style={{ padding: '16px' }}>
                              <span style={{ backgroundColor: '#2ea04322', color: '#2ea043', padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #2ea04355', whiteSpace: 'nowrap' }}>
                                ✅ Owned
                              </span>
                            </td>
                            <td style={{ padding: '16px', display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => handleComplaintClick(arcgisId)}
                                style={{ padding: '6px 12px', backgroundColor: '#da3633', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', transition: 'background 0.2s', pointerEvents: 'auto' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b62324'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#da3633'}
                              >
                                🛠️ Submit Complaint
                              </button>
                              <button
                                onClick={() => handleViewMyUnit(unit)}
                                style={{ padding: '6px 12px', backgroundColor: '#1f6feb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', transition: 'background 0.2s', pointerEvents: 'auto' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#388bfd'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1f6feb'}
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
              </>
            )}

            {/* My Requests Tab */}
            {activeTab === 'my-requests' && (
              <>
                {isLoadingRequests ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#58a6ff', fontSize: '1.1rem' }}>Loading your requests... ⏳</div>
                ) : bookingRequests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e', fontSize: '1.1rem' }}>You do not have any booking requests yet.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#161b22', zIndex: 10 }}>
                      <tr style={{ borderBottom: '2px solid #30363d' }}>
                        <th style={{ padding: '16px', color: '#fff' }}>Date</th>
                        <th style={{ padding: '16px', color: '#fff' }}>Customer Name</th>
                        <th style={{ padding: '16px', color: '#fff' }}>Phone</th>
                        <th style={{ padding: '16px', color: '#fff' }}>Unit ID</th>
                        <th style={{ padding: '16px', color: '#fff' }}>Status</th>
                        <th style={{ padding: '16px', color: '#fff' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookingRequests.map((req, index) => {
                        const date = new Date(req.createdAt).toLocaleDateString('en-GB');
                        let statusStyles = { bg: '#8b949e22', color: '#8b949e', border: '#8b949e55', text: req.status };
                        
                        if (req.status === 'Pending') {
                          statusStyles = { bg: '#d2992222', color: '#d29922', border: '#d2992255', text: '⏳ Pending' };
                        } else if (req.status === 'Approved') {
                          statusStyles = { bg: '#2ea04322', color: '#2ea043', border: '#2ea04355', text: '✅ Approved' };
                        } else if (req.status === 'Rejected' || req.status === 'Declined') {
                          statusStyles = { bg: '#f8514922', color: '#f85149', border: '#f8514955', text: '❌ ' + req.status };
                        } else if (req.status === 'Reserved') {
                          statusStyles = { bg: '#a371f722', color: '#a371f7', border: '#a371f755', text: '🔒 Reserved' };
                        }

                        return (
                          <tr key={req._id} style={{ borderBottom: '1px solid #30363d', backgroundColor: index % 2 === 0 ? '#0d1117' : '#161b22' }}>
                            <td style={{ padding: '16px', color: '#8b949e' }}>{date}</td>
                            <td style={{ padding: '16px', color: '#58a6ff', fontWeight: 'bold' }}>{req.customerName}</td>
                            <td style={{ padding: '16px', color: '#c9d1d9' }}>{req.customerPhone}</td>
                            <td style={{ padding: '16px', color: '#c9d1d9', fontFamily: 'monospace' }}>{req.unitId}</td>
                            <td style={{ padding: '16px' }}>
                              <span style={{ backgroundColor: statusStyles.bg, color: statusStyles.color, padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 'bold', border: `1px solid ${statusStyles.border}`, whiteSpace: 'nowrap' }}>
                                {statusStyles.text}
                              </span>
                            </td>
                            <td style={{ padding: '16px' }}>
                              <button
                                onClick={() => handleViewUnit(req)}
                                style={{ padding: '8px 16px', backgroundColor: '#1f6feb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', transition: 'background 0.2s', pointerEvents: 'auto' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#388bfd'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1f6feb'}
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
              </>
            )}

            {/* Complaints Tabs */}
            {activeTab === 'complaints' && (() => {
              const displayedComplaints = allComplaints;

              return (
                <>
                  {isLoadingComplaints ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#58a6ff', fontSize: '1.1rem' }}>Loading your complaints... ⏳</div>
                  ) : displayedComplaints.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e', fontSize: '1.1rem' }}>
                      You do not have any complaints.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#161b22', zIndex: 10 }}>
                        <tr style={{ borderBottom: '2px solid #30363d' }}>
                          <th style={{ padding: '16px', color: '#fff' }}>Date</th>
                          <th style={{ padding: '16px', color: '#fff' }}>Title</th>
                          <th style={{ padding: '16px', color: '#fff' }}>Unit ID</th>
                          <th style={{ padding: '16px', color: '#fff' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedComplaints.map((complaint, index) => {
                          const date = new Date(complaint.createdAt).toLocaleDateString('en-GB');
                          let statusStyles = { bg: '#8b949e22', color: '#8b949e', border: '#8b949e55', text: complaint.status };
                          
                          if (complaint.status === 'Pending') {
                            statusStyles = { bg: '#d2992222', color: '#d29922', border: '#d2992255', text: '⏳ Pending' };
                          } else if (complaint.status === 'Resolved' || complaint.status === 'Maintenance') {
                            statusStyles = { bg: '#2ea04322', color: '#2ea043', border: '#2ea04355', text: '✅ ' + complaint.status };
                          } else if (complaint.status === 'Dismissed') {
                            statusStyles = { bg: '#f8514922', color: '#f85149', border: '#f8514955', text: '❌ Dismissed' };
                          }

                          return (
                            <tr key={complaint._id} style={{ borderBottom: '1px solid #30363d', backgroundColor: index % 2 === 0 ? '#0d1117' : '#161b22' }}>
                              <td style={{ padding: '16px', color: '#8b949e' }}>{date}</td>
                              <td style={{ padding: '16px', color: '#58a6ff', fontWeight: 'bold' }}>{complaint.title}</td>
                              <td style={{ padding: '16px', color: '#c9d1d9', fontFamily: 'monospace' }}>{complaint.arcgisId}</td>
                              <td style={{ padding: '16px' }}>
                                <span style={{ backgroundColor: statusStyles.bg, color: statusStyles.color, padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 'bold', border: `1px solid ${statusStyles.border}`, whiteSpace: 'nowrap' }}>
                                  {statusStyles.text}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {showComplaintForm && (
        <ComplaintForm
          onClose={() => setShowComplaintForm(false)}
          arcgisId={selectedArcgisId}
          view={view}
          onPickingChange={(isPicking) => setIsPickingLocation(isPicking)}
        />
      )}
    </>,
    document.body
  );
};

export default OwnerUnitsTab;