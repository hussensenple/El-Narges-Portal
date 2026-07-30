import { useState, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import ComplaintChatModal from './ComplaintChatModal';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';

interface Complaint {
  _id: string;
  arcgisId: string;
  title: string;
  problemName?: string;
  type: string;
  description: string;
  priority: string;
  status: string;
  images?: string[];
  createdAt: string;
  ownerId?: { name: string; phone?: string; email: string };
  coordinates?: { lat: number; lng?: number; lon?: number };
  assignedSpecialization?: string;
  assignedTechnician?: { _id: string; name: string };
}

interface Technician {
  _id: string;
  name: string;
  specialization: string;
}

const SPECIALIZATIONS = [
  'Plumbing (سباكة)', 
  'Electrical (كهرباء)', 
  'Carpentry (نجارة)', 
  'HVAC / Air Conditioning (تكييف وتبريد)', 
  'Landscaping / Agriculture (زراعة ولاند سكيب)', 
  'Structural / Construction (إنشاءات ومباني)', 
  'Sanitation / Cleaning (نظافة وصرف صحي)',
  'Elevators (مصاعد)',
  'Infrastructure (بنية تحتية / شبكات المياه)',
  'Other (أخرى)'
];

interface ActiveTasksModalProps {
  onClose: () => void;
  view?: any;
  onOpenUNModal?: (coords: {lat: number, lon: number}) => void;
}

const ActiveTasksModal = ({ onClose, view, onOpenUNModal }: ActiveTasksModalProps) => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  const [activeComplaint, setActiveComplaint] = useState<Complaint | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<{ [key: string]: string }>({});
  const [editingProblemName, setEditingProblemName] = useState<{ [key: string]: string }>({});
  const [designImage, setDesignImage] = useState<string | null>(null);
  
  // New States for Assignment
  const [selectedSpec, setSelectedSpec] = useState<{ [key: string]: string }>({});
  const [selectedTech, setSelectedTech] = useState<{ [key: string]: string }>({});
  


  const clearSelection = () => {
    if ((window as any).viewUnitHighlightHandle) {
      (window as any).viewUnitHighlightHandle.remove();
      (window as any).viewUnitHighlightHandle = null;
    }
    if (view && view.map) {
      const layersToRemove = view.map.layers.filter((l: any) => l.id === "complaint-marker-layer").toArray();
      layersToRemove.forEach((l: any) => view.map.remove(l));
    }
  };

  const auth = useContext(AuthContext);

  const fetchComplaints = async () => {
    try {

      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/complaints/engineer`, {
        headers: { 'x-auth-token': token }
      });
      
      const { complaints: fetchedComplaints } = res.data;
      setComplaints(fetchedComplaints);
      
      const statuses: any = {};
      const names: any = {};
      const specs: any = {};
      const techs: any = {};

      fetchedComplaints.forEach((c: Complaint) => {
        statuses[c._id] = c.status;
        names[c._id] = c.problemName || c.title;
        specs[c._id] = c.assignedSpecialization || '';
        techs[c._id] = c.assignedTechnician?._id || '';
      });
      setSelectedStatus(statuses);
      setEditingProblemName(names);
      setSelectedSpec(specs);
      setSelectedTech(techs);

      if (activeComplaint) {
        const updated = fetchedComplaints.find((c: Complaint) => c._id === activeComplaint._id);
        if (updated) setActiveComplaint(updated);
      }
    } catch (error) {
      console.error("Error fetching engineer complaints:", error);
    } finally {

    }
  };

  const fetchTechnicians = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/technicians`, {
        headers: { 'x-auth-token': token }
      });
      setTechnicians(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Error fetching technicians:", error);
    }
  };

  useEffect(() => {
    fetchComplaints();
    fetchTechnicians();
  }, []);

  const handleUpdateStatusAndName = async (complaintId: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL}/api/complaints/${complaintId}/status-name`, {
        status: selectedStatus[complaintId],
        problemName: editingProblemName[complaintId]
      }, {
        headers: { 'x-auth-token': token }
      });
      alert('Updated successfully!');
      fetchComplaints();
    } catch (error) {
      console.error("Error updating complaint:", error);
      alert('Failed to update complaint.');
    }
  };

  const handleAssignTechnician = async (complaintId: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL}/api/complaints/${complaintId}/assign`, {
        assignedSpecialization: selectedSpec[complaintId],
        assignedTechnician: selectedTech[complaintId]
      }, {
        headers: { 'x-auth-token': token }
      });
      alert('Technician assigned successfully!');
      fetchComplaints();
    } catch (error) {
      console.error("Error assigning complaint:", error);
      alert('Failed to assign technician.');
    }
  };

  const handleZoomToUNMap = (complaint: Complaint) => {
    if (complaint.type === 'external' && complaint.coordinates) {
      const lng = complaint.coordinates.lng || complaint.coordinates.lon;
      const lat = complaint.coordinates.lat;
      if (!lng || !lat) {
        alert("❌ عذراً، إحداثيات هذه الشكوى غير صالحة!");
        return;
      }
      if (onOpenUNModal) {
        onOpenUNModal({ lat, lon: lng });
        onClose();
      }
    }
  };

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
      onClose();
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
                  (window as any).viewUnitHighlightHandle = layerView.highlight(objectIds);
                }
                onClose();
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
                    (window as any).viewUnitHighlightHandle = layerView.highlight(objectIds);
                  }
                  onClose();
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
      onClose();
    } else {
      alert('Location not available for this issue.');
    }
  };

  const getTaskCount = (techId: string) => {
    return complaints.filter(c => c.assignedTechnician?._id === techId && c.status !== 'Solved' && c.status !== 'Resolved').length;
  };

  // 2. Separate into "New Complaints" and "Active Tasks"
  // A complaint is "unassigned" if it has no technician and is Pending.
  const isTask = (c: Complaint) => c.assignedTechnician || c.status !== 'Pending';
  
  const activeTasks = complaints.filter(c => isTask(c));

  // Columns for "Active Tasks" Modal (In Progress vs Solved)
  const inProgressTasks = activeTasks.filter(c => c.status === 'In Progress');
  const solvedTasks = activeTasks.filter(c => c.status === 'Solved' || c.status === 'Resolved');

  const renderComplaintCard = (complaint: Complaint) => {
    const spec = selectedSpec[complaint._id] || '';
    const filteredTechs = technicians.filter(t => t.specialization === spec);

    return (
      <div key={complaint._id} style={{ backgroundColor: complaint.priority === 'High' ? '#2c1214' : 'var(--bg-secondary)', border: `1px solid ${complaint.priority === 'High' ? 'var(--accent-red)' : 'var(--border-color)'}`, borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <input 
            type="text" 
            value={editingProblemName[complaint._id] || ''}
            onChange={(e) => setEditingProblemName({...editingProblemName, [complaint._id]: e.target.value})}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--accent-blue)', fontWeight: 'bold', fontSize: '16px', width: '60%' }}
          />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {new Date(complaint.createdAt).toLocaleDateString()}
          </span>
        </div>
        
        {complaint.ownerId && (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            👤 <strong>{complaint.ownerId.name}</strong> 
            {complaint.ownerId.phone ? ` 📞 ${complaint.ownerId.phone}` : ''}
          </div>
        )}

        {complaint.type === 'internal' && (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            🏠 <strong>Unit No:</strong> {complaint.arcgisId}
          </div>
        )}

        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.4' }}>{complaint.description}</p>
        
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

        {/* Status Section */}
        {complaint.status !== 'Solved' && complaint.status !== 'Resolved' && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
            <select 
              value={selectedStatus[complaint._id] || complaint.status}
              onChange={(e) => setSelectedStatus({...selectedStatus, [complaint._id]: e.target.value})}
              style={{ flex: 1, padding: '8px', borderRadius: '6px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
            >
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Solved">Solved</option>
            </select>
            <button onClick={() => handleUpdateStatusAndName(complaint._id)} style={{ padding: '8px 16px', backgroundColor: 'var(--accent-green)', color: 'var(--text-primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
          </div>
        )}

        {/* Technician Assignment Section */}
        <div style={{ backgroundColor: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '5px' }}>
          {complaint.assignedTechnician ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingBottom: complaint.status === 'Solved' || complaint.status === 'Resolved' ? '0' : '10px', borderBottom: complaint.status === 'Solved' || complaint.status === 'Resolved' ? 'none' : '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 'bold' }}>👷 {complaint.status === 'Solved' || complaint.status === 'Resolved' ? 'Solved By' : 'Current Assignment'}</div>
              <div style={{ color: 'var(--accent-blue)', fontSize: '15px', fontWeight: 'bold' }}>{complaint.assignedTechnician.name}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{complaint.assignedSpecialization}</div>
            </div>
          ) : null}

          {complaint.status !== 'Solved' && complaint.status !== 'Resolved' && (
            <>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                {complaint.assignedTechnician ? '🔄 Reassign Technician' : 'Assign Technician'}
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <select 
                  value={spec}
                  onChange={(e) => {
                    setSelectedSpec({...selectedSpec, [complaint._id]: e.target.value});
                    setSelectedTech({...selectedTech, [complaint._id]: ''}); // Reset technician when spec changes
                  }}
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', fontSize: '13px' }}
                >
                  <option value="">-- Select Specialization --</option>
                  {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select 
                  value={selectedTech[complaint._id] || ''}
                  onChange={(e) => setSelectedTech({...selectedTech, [complaint._id]: e.target.value})}
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', fontSize: '13px' }}
                  disabled={!spec}
                >
                  <option value="">-- Select Technician --</option>
                  {filteredTechs.map(t => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({getTaskCount(t._id)} active tasks)
                    </option>
                  ))}
                </select>
                <button onClick={() => handleAssignTechnician(complaint._id)} style={{ padding: '8px 16px', backgroundColor: complaint.assignedTechnician ? 'var(--accent-gold)' : 'var(--accent-blue-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                  {complaint.assignedTechnician ? 'Reassign' : 'Assign'}
                </button>
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
          {complaint.type === 'internal' && (
            <button onClick={() => setDesignImage('/A.png')} style={{ flex: 1, backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>📐 Explore Plan</button>
          )}
          <button onClick={() => handleZoomToMap(complaint)} style={{ flex: 1, backgroundColor: 'var(--accent-blue-bg)', color: 'var(--text-primary)', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🗺️ 3D Map</button>
          {(spec === 'Infrastructure (بنية تحتية / شبكات المياه)' || complaint.assignedSpecialization === 'Infrastructure (بنية تحتية / شبكات المياه)') && (
             <button onClick={() => handleZoomToUNMap(complaint)} style={{ flex: 1, backgroundColor: '#8957e5', color: 'var(--text-primary)', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>⚡ UN Map</button>
          )}
          <button onClick={() => setActiveComplaint(complaint)} style={{ flex: 1, backgroundColor: 'transparent', color: 'var(--accent-blue)', border: '1px solid var(--accent-blue)', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>💬 Chat</button>
        </div>
      </div>
    );
  };

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(13, 17, 23, 0.85)', zIndex: 9999999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'var(--bg-primary)', width: '95vw', maxWidth: '1600px', height: '95vh', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', padding: '20px' }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            📋 Active Tasks 
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#ff7b72', fontSize: '28px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* LEFT COLUMN: In Progress Tasks */}
          <div style={{ flex: 1, borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
            <div style={{ padding: '15px', backgroundColor: 'var(--accent-gold)22', borderBottom: '1px solid var(--accent-gold)55', color: 'var(--accent-gold)', fontWeight: 'bold', textAlign: 'center', fontSize: '18px' }}>
              ⏳ In Progress ({inProgressTasks.length})
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {inProgressTasks.length === 0 ? <div style={{color: 'var(--text-muted)', textAlign: 'center'}}>No tasks currently in progress.</div> : inProgressTasks.map(renderComplaintCard)}
            </div>
          </div>

          {/* RIGHT COLUMN: Solved Tasks */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
            <div style={{ padding: '15px', backgroundColor: 'var(--accent-green)22', borderBottom: '1px solid var(--accent-green)55', color: '#3fb950', fontWeight: 'bold', textAlign: 'center', fontSize: '18px' }}>
              🎉 Solved & Resolved ({solvedTasks.length})
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {solvedTasks.length === 0 ? <div style={{color: 'var(--text-muted)', textAlign: 'center'}}>No solved tasks yet.</div> : solvedTasks.map(renderComplaintCard)}
            </div>
          </div>

      </div>
      </div>

        {activeComplaint && (
          <ComplaintChatModal 
            complaint={activeComplaint} 
            onClose={() => setActiveComplaint(null)} 
            onRefresh={() => fetchComplaints()}
            currentUser={{ id: auth?.user?.id || '', name: auth?.user?.name || '', role: auth?.user?.role || '' }}
          />
        )}

      {designImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999999 }} onClick={() => setDesignImage(null)}>
          <div style={{ position: 'relative', backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-color)', maxWidth: '90%', maxHeight: '90%', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setDesignImage(null)} style={{ position: 'absolute', top: '-12px', right: '-12px', background: 'var(--accent-red)', border: 'none', color: 'var(--text-primary)', fontSize: '18px', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '50%', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            <img src={designImage} alt="Plan/Image" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px' }} />
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default ActiveTasksModal;
