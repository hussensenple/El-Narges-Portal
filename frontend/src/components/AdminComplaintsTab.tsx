import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import WebScene from '@arcgis/core/WebScene';
import SceneView from '@arcgis/core/views/SceneView';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'; 
import { io } from 'socket.io-client'; 

interface Complaint {
  _id: string;
  arcgisId: string;
  type: string;
  description: string;
  coordinates: { lat: number; lon?: number; lng?: number } | null;
  status: string;
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
  const [view, setView] = useState<SceneView | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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
  const handleZoomToMap = (complaint: Complaint) => {
    if (!view) return;

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
          material: { color: "#da3633" },
          outline: { color: "#ffffff", size: 2 },
          size: "20px"
        }]
      };

      const pointGraphic = new Graphic({ geometry: point, symbol: markerSymbol as any });

      const oldLayer = view.map?.findLayerById("complaint-marker-layer");
      if (oldLayer) {
        view.map?.remove(oldLayer);
      }

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
      alert(`🏠 Internal issue for Unit ID: \n${complaint.arcgisId}\n\nSearch for this unit on the main map.`);
    }
  };

  // 🚀 تنفيذ أمر الـ Dismiss والـ Raise للباك إند
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
    <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#0d1117' }}>
      
      <div style={{ width: '450px', height: '100%', overflowY: 'auto', borderRight: '1px solid #30363d', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', backgroundColor: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 10 }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.4rem' }}>🛡️ Admin Complaints</h2>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', color: '#58a6ff' }}>Loading complaints... ⏳</div>
          ) : complaints.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8b949e' }}>No pending complaints found. 🎉</div>
          ) : (
            complaints.map((complaint) => (
              <div key={complaint._id} style={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: complaint.type === 'external' ? '#a371f722' : '#f0883e22', color: complaint.type === 'external' ? '#a371f7' : '#f0883e', border: `1px solid ${complaint.type === 'external' ? '#a371f755' : '#f0883e55'}` }}>
                    {complaint.type === 'external' ? '🛣️ External' : '🏠 Internal'}
                  </span>
                  <span style={{ fontSize: '12px', color: '#8b949e' }}>
                    {complaint.createdAt ? new Date(complaint.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
                {complaint.ownerId && (
                  <div style={{ fontSize: '13px', color: '#c9d1d9', marginTop: '-4px', marginBottom: '4px' }}>
                    👤 <strong>{complaint.ownerId.name}</strong> 
                    {complaint.ownerId.phone ? ` 📞 ${complaint.ownerId.phone}` : ''}
                  </div>
                )}
                <p style={{ margin: 0, color: '#c9d1d9', fontSize: '15px', lineHeight: '1.5' }}>{complaint.description}</p>
                <button 
                  onClick={() => handleZoomToMap(complaint)}
                  style={{ backgroundColor: '#1f6feb', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  🗺️ Explore on 3D Map
                </button>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px', borderTop: '1px solid #30363d', paddingTop: '16px' }}>
                  <button onClick={() => handleAction(complaint._id, 'raise')} style={{ flex: 1, backgroundColor: '#2ea043', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>✅ Raise</button>
                  <button onClick={() => handleAction(complaint._id, 'dismiss')} style={{ flex: 1, backgroundColor: 'transparent', color: '#da3633', border: '1px solid #da3633', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>❌ Dismiss</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        <div ref={mapDiv} style={{ width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(13,17,23,0.85)', padding: '10px 20px', borderRadius: '20px', color: '#fff', border: '1px solid #30363d', pointerEvents: 'none', backdropFilter: 'blur(5px)' }}>
          Click "Explore on 3D Map" to locate the issue 📍
        </div>
      </div>
    </div>
  );
};

export default AdminComplaintsTab;