import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import WebScene from '@arcgis/core/WebScene';
import SceneView from '@arcgis/core/views/SceneView';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'; 
import { io } from 'socket.io-client'; 
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';
import ComplaintChatModal from './ComplaintChatModal'; 

interface Complaint {
  _id: string;
  arcgisId: string;
  problemName?: string;
  title?: string;
  type: string;
  description: string;
  specialization?: string;
  priority?: string;
  coordinates: { lat: number; lon?: number; lng?: number } | null;
  status: string;
  images?: string[];
  createdAt?: string;
  ownerId?: { name: string; email: string; phone?: string };
}

// 🚀 1. إضافة الـ Interface عشان الـ TypeScript يتعرف على الـ Prop الجديدة
interface AdminComplaintsTabProps {
  onCountUpdate?: (count: number) => void;
}

// 🚀 2. استلام الـ Prop جوه الكومبوننت
const AdminComplaintsTab = ({ onCountUpdate }: AdminComplaintsTabProps) => {
  const mapDiv = useRef<HTMLDivElement>(null);
  const highlightHandleRef = useRef<any>(null);
  const [view, setView] = useState<SceneView | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeComplaint, setActiveComplaint] = useState<Complaint | null>(null);
  const [designImage, setDesignImage] = useState<string | null>(null);
  const auth = useContext(AuthContext);

  // 🚀 دالة لتفريغ التحديد
  const clearSelection = () => {
    if (highlightHandleRef.current) {
      highlightHandleRef.current.remove();
      highlightHandleRef.current = null;
    }
    if (view) {
      const oldLayer = view.map?.findLayerById("complaint-marker-layer");
      if (oldLayer) view.map?.remove(oldLayer);
    }
  };

  // 🚀 3. تحديث الرقم في הـ Navbar أوتوماتيك كل ما الداتا (complaints) تتغير
  useEffect(() => {
    if (onCountUpdate) {
      onCountUpdate(complaints.length);
    }
  }, [complaints, onCountUpdate]);

  // 🚀 بناء الخريطة الـ 3D
  useEffect(() => {
    if (mapDiv.current) {
      const webScene = new WebScene({
        portalItem: {
          id: "fd0297b6f0034d63a58d42c7ffef11e3"
        }
      });

      const _view = new SceneView({
        container: mapDiv.current,
        map: webScene,
      });

      _view.when(() => {
        setView(_view);
        _view.on('click', () => {
          if (highlightHandleRef.current) {
            highlightHandleRef.current.remove();
            highlightHandleRef.current = null;
          }
          const oldLayer = _view.map?.findLayerById("complaint-marker-layer");
          if (oldLayer) _view.map?.remove(oldLayer);
        });
      });

      return () => {
        if (_view) _view.destroy();
      };
    }
  }, []);

  // 🚀 دالة جلب الشكاوى وتصفيتها
  const fetchComplaints = async () => {
    setIsLoading(true); 
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/complaints/all`, {
        headers: { 'x-auth-token': token }
      });
      
      const activeComplaints = response.data.filter((c: any) => 
        c.status?.toLowerCase() !== 'dismissed' && 
        c.status?.toLowerCase() !== 'maintenance' &&
        c.status?.toLowerCase() !== 'resolved'
      );
      
      setComplaints(activeComplaints);
    } catch (error) {
      console.error("Error fetching complaints:", error);
    } finally {
      setIsLoading(false); 
    }
  };

  // 🚀 الـ WebSockets
  useEffect(() => {
    fetchComplaints(); 

    const socket = io(`${import.meta.env.VITE_API_URL}`);
    
    socket.on('newComplaint', () => {
      console.log("🔔 New complaint received via Socket!");
      fetchComplaints(); 
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // 🚀 الطيران لمكان الشكوى
  const handleZoomToMap = async (complaint: Complaint) => {
    if (!view) return;

    clearSelection();

    if (complaint.type === 'external' && complaint.coordinates) {
      
      const lng = complaint.coordinates.lng || complaint.coordinates.lon;
      const lat = complaint.coordinates.lat;

      if (!lng || !lat) {
        alert("❌ عذراً، إحداثيات هذه الشكوى غير صالحة!");
        return;
      }

      const point = new Point({
        longitude: lng,
        latitude: lat
      });

      const markerSymbol = {
        type: "point-3d", 
        symbolLayers: [{
          type: "icon", 
          resource: { primitive: "circle" },
          material: { color: "red" },
          outline: { color: "white", size: 2 },
          size: "20px"
        }]
      };

      const pointGraphic = new Graphic({ geometry: point, symbol: markerSymbol as any });

      const complaintLayer = new GraphicsLayer({
        id: "complaint-marker-layer",
        elevationInfo: {
            mode: "relative-to-ground",
            offset: 5 
        }
      });

      complaintLayer.add(pointGraphic);
      view.map?.add(complaintLayer);

      view.goTo({ target: pointGraphic, zoom: 19, tilt: 60, heading: 0 }, { duration: 1500 });
    } else if (complaint.type === 'internal') {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/roles/catalog?mode=all`);
        const allFeatures = [...(res.data.units || []), ...(res.data.villas || [])];
        const complaintCleanId = String(complaint.arcgisId).replace(/[{}]/g, '').trim().toLowerCase();
        
        const unitData = allFeatures.find(u => {
          const uObj = String(u.OBJECTID).replace(/[{}]/g, '').trim().toLowerCase();
          const uGlob = String(u.GlobalID || '').replace(/[{}]/g, '').trim().toLowerCase();
          const uArc = String(u.arcgisId || '').replace(/[{}]/g, '').trim().toLowerCase();
          return uObj === complaintCleanId || (u.GlobalID && uGlob === complaintCleanId) || (u.arcgisId && uArc === complaintCleanId);
        });

        if (unitData) {
          const source = unitData.sourceLayer || unitData.SourceName;
          if (source === 'Villas_Global') {
            const villaLayer = view.map?.layers.find((l: any) => l.title === "Villas_Global" || l.title === "Villas") as any;
            if (villaLayer) {
              const query = villaLayer.createQuery();
              const gID = unitData.GlobalID || unitData.globalid;
              const oID = unitData.OBJECTID;
              query.where = `GlobalID = '${gID}' OR OBJECTID = ${oID}`;
              query.returnGeometry = true;
              const extentRes = await villaLayer.queryExtent(query);
              if (extentRes && extentRes.extent) {
                view.goTo({ target: extentRes.extent, tilt: 45, zoom: 19 }, { animate: true, duration: 2000 });
                const objectIds = await villaLayer.queryObjectIds(query);
                if (objectIds && objectIds.length > 0) {
                  const layerView = await view.whenLayerView(villaLayer) as any;
                  highlightHandleRef.current = layerView.highlight(objectIds);
                }
                return;
              }
            }
          } else if (source === 'Units') {
            const foreignKey = unitData.BuildingID_FK;
            if (foreignKey) {
              const buildingLayer = view.map?.layers.find((l: any) => l.title === "Buildings_Global") as any;
              if (buildingLayer) {
                const query = buildingLayer.createQuery();
                query.where = `GlobalID = '${foreignKey}'`;
                query.returnGeometry = true;
                const extentRes = await buildingLayer.queryExtent(query);
                if (extentRes && extentRes.extent) {
                  view.goTo({ target: extentRes.extent, tilt: 60, zoom: 20 }, { animate: true, duration: 1500 });
                  const objectIds = await buildingLayer.queryObjectIds(query);
                  if (objectIds && objectIds.length > 0) {
                    const layerView = await view.whenLayerView(buildingLayer) as any;
                    highlightHandleRef.current = layerView.highlight(objectIds);
                  }
                  return;
                }
              }
            }
          }
        }
      } catch (e) {
        console.error("Error finding unit location:", e);
      }
      alert(`🏠 Internal issue for Unit ID: \n${complaint.arcgisId}\n\nSearch for this unit on the main map.`);
    }
  };

  // 🚀 تحديث الأولوية
  const handleTogglePriority = async (complaintId: string, currentPriority: string) => {
    try {
      const token = localStorage.getItem('token');
      const newPriority = currentPriority === 'High' ? 'Normal' : 'High';
      await axios.put(`${import.meta.env.VITE_API_URL}/api/complaints/${complaintId}/priority`, 
        { priority: newPriority }, 
        { headers: { 'x-auth-token': token } }
      );
      setComplaints(prev => prev.map(c => c._id === complaintId ? { ...c, priority: newPriority } : c));
    } catch (error) {
      console.error("Error updating priority:", error);
      alert("Failed to update priority.");
    }
  };

  // 🚀 تنفيذ أمر الـ Dismiss للباك إند
  const handleAction = async (complaintId: string, action: 'raise' | 'dismiss') => {
    setComplaints(prev => prev.filter(c => c._id !== complaintId));
    
    if (view) {
      const oldLayer = view.map?.findLayerById("complaint-marker-layer");
      if (oldLayer) view.map?.remove(oldLayer);
      view.graphics.removeAll();
    }

    try {
      const token = localStorage.getItem('token');
      const newStatus = action === 'raise' ? 'Maintenance' : 'Dismissed';
      
      await axios.put(`${import.meta.env.VITE_API_URL}/api/complaints/resolve/${complaintId}`, 
        { status: newStatus }, 
        { headers: { 'x-auth-token': token } }
      );
      
      alert(action === 'raise' ? "✅ Raised to maintenance!" : "❌ Dismissed and removed.");
    } catch (error) {
      console.error("Error updating complaint status:", error);
      alert("⚠️ تم إخفاء الشكوى محلياً، ولكن حدث خطأ في تحديث قاعدة البيانات.");
    }
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: 'var(--bg-primary)' }}>
      
      <div style={{ width: '450px', height: '100%', overflowY: 'auto', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem' }}>🛡️ Admin Complaints</h2>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', color: 'var(--accent-blue)' }}>Loading complaints... ⏳</div>
          ) : complaints.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No pending complaints found. 🎉</div>
          ) : (
            complaints.map((complaint) => (
              <div key={complaint._id} style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: complaint.type === 'external' ? '#a371f722' : '#f0883e22', color: complaint.type === 'external' ? '#a371f7' : '#f0883e', border: `1px solid ${complaint.type === 'external' ? '#a371f755' : '#f0883e55'}` }}>
                    {complaint.specialization || (complaint.type === 'external' ? '🛣️ External' : '🏠 Internal')}
                  </span>
                  <button 
                    onClick={() => handleTogglePriority(complaint._id, complaint.priority || 'Normal')}
                    style={{ backgroundColor: complaint.priority === 'High' ? 'var(--accent-red-bg)' : 'var(--border-color)', color: 'var(--text-primary)', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' }}
                  >
                    {complaint.priority === 'High' ? '🚨 High Priority' : '⬇️ Normal Priority'}
                  </button>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {complaint.createdAt ? new Date(complaint.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                  {(complaint as any).problemName || complaint.title} <span style={{color: 'var(--accent-blue)', fontSize: '12px', fontWeight: 'normal'}}>({complaint.status})</span>
                </div>
                {complaint.ownerId && (
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '-4px', marginBottom: '4px' }}>
                    👤 <strong>{complaint.ownerId.name}</strong> 
                    {complaint.ownerId.phone ? ` 📞 ${complaint.ownerId.phone}` : ''}
                  </div>
                )}
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.5' }}>{complaint.description}</p>
                
                {complaint.images && complaint.images.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '5px' }}>
                    {complaint.images.map((img, i) => (
                      <img 
                        key={i} 
                        src={img} 
                        alt="Complaint attached" 
                        onClick={() => setDesignImage(img)}
                        style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer' }} 
                      />
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                  {complaint.type === 'internal' && (
                    <button onClick={() => setDesignImage('/A.png')} style={{ flex: 1, backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>📐 Explore Plan</button>
                  )}
                  <button 
                    onClick={() => handleZoomToMap(complaint)}
                    style={{ flex: 1, backgroundColor: 'var(--accent-blue-bg)', color: 'var(--text-primary)', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    🗺️ Map
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <button onClick={() => setActiveComplaint(complaint)} style={{ flex: 1, backgroundColor: 'transparent', color: 'var(--accent-blue)', border: '1px solid var(--accent-blue)', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>💬 Chat</button>
                  <button onClick={() => handleAction(complaint._id, 'dismiss')} style={{ flex: 1, backgroundColor: 'transparent', color: 'var(--accent-red-bg)', border: '1px solid var(--accent-red-bg)', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>❌ Dismiss</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        <div ref={mapDiv} style={{ width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(13,17,23,0.85)', padding: '10px 20px', borderRadius: '20px', color: 'var(--text-primary)', border: '1px solid var(--border-color)', pointerEvents: 'none', backdropFilter: 'blur(5px)' }}>
          Click "Explore on 3D Map" to locate the issue 📍
        </div>
      </div>

      {activeComplaint && (
        <ComplaintChatModal
          complaint={activeComplaint}
          onClose={() => setActiveComplaint(null)}
          onRefresh={fetchComplaints}
          currentUser={{ 
            id: auth?.user?.id || 'admin_id', 
            name: auth?.user?.name || 'Admin', 
            role: 'admin' 
          }}
        />
      )}

      {designImage && (
        <div 
          onClick={() => setDesignImage(null)}
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        >
          <img src={designImage} alt="Enlarged design" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '12px', border: '2px solid var(--accent-blue)' }} />
          <button onClick={() => setDesignImage(null)} style={{ position: 'absolute', top: '20px', right: '30px', background: 'transparent', color: '#ff7b72', border: 'none', fontSize: '30px', cursor: 'pointer' }}>✕</button>
        </div>
      )}
    </div>
  );
};

export default AdminComplaintsTab;