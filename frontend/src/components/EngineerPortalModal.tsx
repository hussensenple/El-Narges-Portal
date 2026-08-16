import { useState, useEffect, useContext, useRef } from 'react';
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

interface EngineerPortalModalProps {
  onClose: () => void;
  view?: any;
  onOpenUNModal?: (coords: {lat: number, lon: number}) => void;
}

const EngineerPortalModal = ({ onClose, view, onOpenUNModal }: EngineerPortalModalProps) => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeComplaint, setActiveComplaint] = useState<Complaint | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<{ [key: string]: string }>({});
  const [editingProblemName, setEditingProblemName] = useState<{ [key: string]: string }>({});
  const [designImage, setDesignImage] = useState<string | null>(null);
  
  // New States for Assignment
  const [selectedSpec, setSelectedSpec] = useState<{ [key: string]: string }>({});
  const [selectedTech, setSelectedTech] = useState<{ [key: string]: string }>({});
  
  // Navigation State
  const [activeTypeTab, setActiveTypeTab] = useState<'internal' | 'external'>('internal');

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
      setIsLoading(true);
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
      setIsLoading(false);
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
          material: { color: "#da3633" },
          outline: { color: "#ffffff", size: 2 },
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
        // Determine if arcgisId is numeric (apartment OBJECTID) or UUID (villa GlobalID)
        const arcgisIdRaw = String(complaint.arcgisId).trim();
        const isNumericId = /^\d+$/.test(arcgisIdRaw);

        const addRedDot = (extent: any) => {
          if (!view || !extent) return;
          const center = extent.center;
          if (!center) return;
          
          // Remove any previous marker
          const existingLayer = view.map?.findLayerById("complaint-marker-layer");
          if (existingLayer) view.map?.remove(existingLayer);

          // Use x/y only — let the elevation mode handle height above ground/buildings
          const point = new Point({ 
            x: center.x, 
            y: center.y, 
            spatialReference: center.spatialReference 
          });
          
          const markerSymbol = {
            type: "point-3d", 
            symbolLayers: [{
              type: "icon", 
              resource: { primitive: "circle" },
              material: { color: "#da3633" },
              outline: { color: "#ffffff", size: 3 },
              size: "28px"
            }]
          };
          
          const pointGraphic = new Graphic({ geometry: point, symbol: markerSymbol as any });
          // relative-to-scene + large offset floats above any building height
          const complaintLayer = new GraphicsLayer({ 
            id: "complaint-marker-layer",
            elevationInfo: { mode: "relative-to-scene", offset: 30 }
          });
          complaintLayer.add(pointGraphic);
          view.map?.add(complaintLayer);
        };

        if (isNumericId) {
          // It's an apartment unit — query Units layer for BuildingID_FK
          const UNITS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37';
          const unitRes = await axios.get(`${UNITS_URL}/query`, {
            params: { where: `OBJECTID = ${arcgisIdRaw}`, outFields: 'BuildingID_FK', f: 'json' }
          });
          
          const features = unitRes.data.features || [];
          if (features.length === 0) {
            alert(`DEBUG: No unit found in ArcGIS with OBJECTID = ${arcgisIdRaw}`);
            return;
          }
          
          const foreignKey = features[0].attributes.BuildingID_FK;
          if (!foreignKey) {
            alert(`DEBUG: Unit ${arcgisIdRaw} has no BuildingID_FK!`);
            return;
          }
          
          const buildingLayer = view.map?.layers.find((l: any) => l.title === "Buildings_Global" || l.title === "Buildings") as any;
          if (!buildingLayer) {
            alert(`DEBUG: Buildings layer not found on map!`);
            return;
          }
          
          const cleanFk = String(foreignKey).replace(/[{}]/g, '').trim();
          const bQuery = buildingLayer.createQuery();
          bQuery.where = `GlobalID = '{${cleanFk.toUpperCase()}}' OR GlobalID = '${cleanFk.toUpperCase()}' OR GlobalID = '{${cleanFk.toLowerCase()}}' OR GlobalID = '${cleanFk.toLowerCase()}' OR GlobalID = '{${cleanFk}}' OR GlobalID = '${cleanFk}'`;
          bQuery.returnGeometry = true;
          
          const extentRes = await buildingLayer.queryExtent(bQuery);
          if (!extentRes || !extentRes.extent) {
            alert(`DEBUG: Building extent null for FK: ${cleanFk}\nQuery: ${bQuery.where}`);
            return;
          }
          
          view.goTo({ target: extentRes.extent, tilt: 60, zoom: 20 }, { animate: true, duration: 1500 });
          addRedDot(extentRes.extent);
          const objIds = await buildingLayer.queryObjectIds(bQuery);
          if (objIds && objIds.length > 0) {
            const lv = await view.whenLayerView(buildingLayer) as any;
            (window as any).viewUnitHighlightHandle = lv.highlight(objIds);
          }
          onClose();
          return;

        } else {
          // UUID — could be a villa GlobalID, building GlobalID, or unit's globalId from MongoDB
          const cleanId = arcgisIdRaw.replace(/[{}]/g, '').trim();

          // 1. Try Villas_Global first
          const villaLayer = view.map?.layers.find((l: any) => l.title === "Villas_Global" || l.title === "Villas") as any;
          if (villaLayer) {
            const vQuery = villaLayer.createQuery();
            vQuery.where = `GlobalID = '{${cleanId.toUpperCase()}}' OR GlobalID = '${cleanId.toUpperCase()}' OR GlobalID = '{${cleanId.toLowerCase()}}' OR GlobalID = '${cleanId.toLowerCase()}' OR GlobalID = '{${cleanId}}' OR GlobalID = '${cleanId}'`;
            vQuery.returnGeometry = true;
            try {
              const vExtent = await villaLayer.queryExtent(vQuery);
              if (vExtent && vExtent.extent) {
                view.goTo({ target: vExtent.extent, tilt: 45, zoom: 19 }, { animate: true, duration: 2000 });
                addRedDot(vExtent.extent);
                const objIds = await villaLayer.queryObjectIds(vQuery);
                if (objIds && objIds.length > 0) {
                  const lv = await view.whenLayerView(villaLayer) as any;
                  (window as any).viewUnitHighlightHandle = lv.highlight(objIds);
                }
                onClose();
                return;
              }
            } catch (_) {}
          }

          // 2. Try Buildings_Global (the UUID might be the building's own GlobalID)
          const buildingLayer = view.map?.layers.find((l: any) => l.title === "Buildings_Global" || l.title === "Buildings") as any;
          if (buildingLayer) {
            const bQuery = buildingLayer.createQuery();
            bQuery.where = `GlobalID = '{${cleanId.toUpperCase()}}' OR GlobalID = '${cleanId.toUpperCase()}' OR GlobalID = '{${cleanId.toLowerCase()}}' OR GlobalID = '${cleanId.toLowerCase()}' OR GlobalID = '{${cleanId}}' OR GlobalID = '${cleanId}'`;
            bQuery.returnGeometry = true;
            try {
              const bExtent = await buildingLayer.queryExtent(bQuery);
              if (bExtent && bExtent.extent) {
                view.goTo({ target: bExtent.extent, tilt: 60, zoom: 20 }, { animate: true, duration: 1500 });
                addRedDot(bExtent.extent);
                const objIds = await buildingLayer.queryObjectIds(bQuery);
                if (objIds && objIds.length > 0) {
                  const lv = await view.whenLayerView(buildingLayer) as any;
                  (window as any).viewUnitHighlightHandle = lv.highlight(objIds);
                }
                onClose();
                return;
              }
            } catch (_) {}
          }

          // 3. Fallback: look up the unit in MongoDB to get its buildingIdFk
          const token = localStorage.getItem('token');
          const lookupRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/complaints/unit-lookup?id=${cleanId}`, {
            headers: { 'x-auth-token': token }
          });
          const unitMeta = lookupRes.data;
          
          if (unitMeta && unitMeta.buildingIdFk && buildingLayer) {
            const cleanFk = String(unitMeta.buildingIdFk).replace(/[{}]/g, '').trim();
            const fbQuery = buildingLayer.createQuery();
            fbQuery.where = `GlobalID = '{${cleanFk.toUpperCase()}}' OR GlobalID = '${cleanFk.toUpperCase()}' OR GlobalID = '{${cleanFk.toLowerCase()}}' OR GlobalID = '${cleanFk.toLowerCase()}' OR GlobalID = '{${cleanFk}}' OR GlobalID = '${cleanFk}'`;
            fbQuery.returnGeometry = true;
            const fbExtent = await buildingLayer.queryExtent(fbQuery);
            
            if (!fbExtent || !fbExtent.extent) {
              alert(`DEBUG: Building FK extent null. FK: ${cleanFk}`);
              return;
            }
            
            view.goTo({ target: fbExtent.extent, tilt: 60, zoom: 20 }, { animate: true, duration: 1500 });
            addRedDot(fbExtent.extent);
            const objIds = await buildingLayer.queryObjectIds(fbQuery);
            if (objIds && objIds.length > 0) {
              const lv = await view.whenLayerView(buildingLayer) as any;
              (window as any).viewUnitHighlightHandle = lv.highlight(objIds);
            }
            onClose();
            return;
          }

          alert(`DEBUG: Could not find location for ID: ${cleanId}`);
          return;
        }

      } catch (e: any) {
        alert(`DEBUG ERROR CAUGHT: ${e.message}`);
        console.error("Error finding unit location:", e);
      }
      onClose();
    } else {
      alert('Location not available for this issue.');
    }
  };

  const getTaskCount = (techId: string) => {
    return complaints.filter(c => c.assignedTechnician?._id === techId && c.status !== 'Solved' && c.status !== 'Resolved').length;
  };

  // 2. Only show New Complaints (unassigned and Pending)
  const isTask = (c: Complaint) => c.assignedTechnician || c.status !== 'Pending';
  const unassignedComplaints = complaints.filter(c => !isTask(c));

  // 3. Columns for "New Complaints" Tab (4-quadrants)
  const internalHigh = unassignedComplaints.filter(c => c.type === 'internal' && c.priority === 'High');
  const internalNormal = unassignedComplaints.filter(c => c.type === 'internal' && c.priority !== 'High');
  const externalHigh = unassignedComplaints.filter(c => c.type === 'external' && c.priority === 'High');
  const externalNormal = unassignedComplaints.filter(c => c.type === 'external' && c.priority !== 'High');

  const renderComplaintCard = (complaint: Complaint) => {
    const spec = selectedSpec[complaint._id] || '';
    const filteredTechs = technicians.filter(t => t.specialization === spec);

    return (
      <div key={complaint._id} style={{ backgroundColor: complaint.priority === 'High' ? '#2c1214' : '#161b22', border: `1px solid ${complaint.priority === 'High' ? '#f85149' : '#30363d'}`, borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <input 
            type="text" 
            value={editingProblemName[complaint._id] || ''}
            onChange={(e) => setEditingProblemName({...editingProblemName, [complaint._id]: e.target.value})}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #30363d', backgroundColor: '#0d1117', color: '#58a6ff', fontWeight: 'bold', fontSize: '16px', width: '60%' }}
          />
          <span style={{ fontSize: '12px', color: '#8b949e' }}>
            {new Date(complaint.createdAt).toLocaleDateString()}
          </span>
        </div>
        
        {complaint.ownerId && (
          <div style={{ fontSize: '13px', color: '#c9d1d9' }}>
            👤 <strong>{complaint.ownerId.name}</strong> 
            {complaint.ownerId.phone ? ` 📞 ${complaint.ownerId.phone}` : ''}
          </div>
        )}

        {complaint.type === 'internal' && (
          <div style={{ fontSize: '13px', color: '#c9d1d9' }}>
            🏠 <strong>Unit No:</strong> {complaint.arcgisId}
          </div>
        )}

        <p style={{ margin: 0, color: '#c9d1d9', fontSize: '14px', lineHeight: '1.4' }}>{complaint.description}</p>
        
        {complaint.images && complaint.images.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '5px' }}>
            {complaint.images.map((img, i) => (
              <img 
                key={i} 
                src={img} 
                alt="Complaint attached" 
                onClick={() => setDesignImage(img)}
                style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #30363d', cursor: 'pointer' }} 
              />
            ))}
          </div>
        )}

        {/* Status Section */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
          <select 
            value={selectedStatus[complaint._id] || complaint.status}
            onChange={(e) => setSelectedStatus({...selectedStatus, [complaint._id]: e.target.value})}
            style={{ flex: 1, padding: '8px', borderRadius: '6px', backgroundColor: '#0d1117', color: '#fff', border: '1px solid #30363d' }}
          >
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Solved">Solved</option>
          </select>
          <button onClick={() => handleUpdateStatusAndName(complaint._id)} style={{ padding: '8px 16px', backgroundColor: '#2ea043', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
        </div>

        {/* Technician Assignment Section */}
        <div style={{ backgroundColor: '#0d1117', padding: '12px', borderRadius: '8px', border: '1px solid #30363d', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '5px' }}>
          {complaint.assignedTechnician ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingBottom: '10px', borderBottom: '1px solid #30363d' }}>
              <div style={{ fontSize: '13px', color: '#8b949e', fontWeight: 'bold' }}>👷 Current Assignment</div>
              <div style={{ color: '#58a6ff', fontSize: '15px', fontWeight: 'bold' }}>{complaint.assignedTechnician.name}</div>
              <div style={{ color: '#c9d1d9', fontSize: '12px' }}>{complaint.assignedSpecialization}</div>
            </div>
          ) : null}

          <div style={{ fontSize: '13px', color: '#8b949e', fontWeight: 'bold' }}>
            {complaint.assignedTechnician ? '🔄 Reassign Technician' : 'Assign Technician'}
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <select 
              value={spec}
              onChange={(e) => {
                setSelectedSpec({...selectedSpec, [complaint._id]: e.target.value});
                setSelectedTech({...selectedTech, [complaint._id]: ''}); // Reset technician when spec changes
              }}
              style={{ flex: 1, padding: '8px', borderRadius: '6px', backgroundColor: '#161b22', color: '#c9d1d9', border: '1px solid #30363d', fontSize: '13px' }}
            >
              <option value="">-- Select Specialization --</option>
              {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select 
              value={selectedTech[complaint._id] || ''}
              onChange={(e) => setSelectedTech({...selectedTech, [complaint._id]: e.target.value})}
              style={{ flex: 1, padding: '8px', borderRadius: '6px', backgroundColor: '#161b22', color: '#c9d1d9', border: '1px solid #30363d', fontSize: '13px' }}
              disabled={!spec}
            >
              <option value="">-- Select Technician --</option>
              {filteredTechs.map(t => (
                <option key={t._id} value={t._id}>
                  {t.name} ({getTaskCount(t._id)} active tasks)
                </option>
              ))}
            </select>
            <button onClick={() => handleAssignTechnician(complaint._id)} style={{ padding: '8px 16px', backgroundColor: complaint.assignedTechnician ? '#d29922' : '#1f6feb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              {complaint.assignedTechnician ? 'Reassign' : 'Assign'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
          {complaint.type === 'internal' && (
            <button onClick={() => setDesignImage('/A.png')} style={{ flex: 1, backgroundColor: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>📐 Explore Plan</button>
          )}
          <button onClick={() => handleZoomToMap(complaint)} style={{ flex: 1, backgroundColor: '#1f6feb', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🗺️ 3D Map</button>
          {(spec === 'Infrastructure (بنية تحتية / شبكات المياه)' || complaint.assignedSpecialization === 'Infrastructure (بنية تحتية / شبكات المياه)') && (
             <button onClick={() => handleZoomToUNMap(complaint)} style={{ flex: 1, backgroundColor: '#8957e5', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>⚡ UN Map</button>
          )}
          <button onClick={() => setActiveComplaint(complaint)} style={{ flex: 1, backgroundColor: 'transparent', color: '#58a6ff', border: '1px solid #58a6ff', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>💬 Chat</button>
        </div>
      </div>
    );
  };

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(13, 17, 23, 0.85)', zIndex: 9999999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#0d1117', width: '95vw', maxWidth: '1600px', height: '95vh', borderRadius: '12px', border: '1px solid #30363d', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #30363d', padding: '20px' }}>
          <h2 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            🛠️ Engineer Portal 
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#ff7b72', fontSize: '28px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#0d1117' }}>
            
            {/* Internal / External Toggle Buttons */}
              <div style={{ display: 'flex', padding: '15px', gap: '15px', borderBottom: '1px solid #30363d', backgroundColor: '#010409' }}>
                <button 
                  onClick={() => setActiveTypeTab('internal')}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: activeTypeTab === 'internal' ? '1px solid #1f6feb' : '1px solid #30363d', backgroundColor: activeTypeTab === 'internal' ? '#1f6feb22' : '#161b22', color: activeTypeTab === 'internal' ? '#58a6ff' : '#c9d1d9', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', transition: '0.2s' }}
                >
                  🏠 Internal Complaints ({(internalHigh.length + internalNormal.length)})
                </button>
                <button 
                  onClick={() => setActiveTypeTab('external')}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: activeTypeTab === 'external' ? '1px solid #ff7b72' : '1px solid #30363d', backgroundColor: activeTypeTab === 'external' ? '#ff7b7222' : '#161b22', color: activeTypeTab === 'external' ? '#ff7b72' : '#c9d1d9', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', transition: '0.2s' }}
                >
                  🌳 External Complaints ({(externalHigh.length + externalNormal.length)})
                </button>
              </div>

              {/* Display Area for Selected Type */}
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                
                {activeTypeTab === 'internal' && (
                  <>
                    <div style={{ flex: 1, borderRight: '1px solid #30363d', display: 'flex', flexDirection: 'column', padding: '20px', overflowY: 'auto' }}>
                      <h3 style={{ color: '#f85149', margin: '0 0 15px 0', borderBottom: '1px solid #30363d', paddingBottom: '10px' }}>🚨 High Priority ({internalHigh.length})</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {internalHigh.length === 0 ? <div style={{color: '#8b949e'}}>No high priority internal complaints.</div> : internalHigh.map(renderComplaintCard)}
                      </div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', overflowY: 'auto' }}>
                      <h3 style={{ color: '#8b949e', margin: '0 0 15px 0', borderBottom: '1px solid #30363d', paddingBottom: '10px' }}>✅ Normal Priority ({internalNormal.length})</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {internalNormal.length === 0 ? <div style={{color: '#8b949e'}}>No normal priority internal complaints.</div> : internalNormal.map(renderComplaintCard)}
                      </div>
                    </div>
                  </>
                )}

                {activeTypeTab === 'external' && (
                  <>
                    <div style={{ flex: 1, borderRight: '1px solid #30363d', display: 'flex', flexDirection: 'column', padding: '20px', overflowY: 'auto' }}>
                      <h3 style={{ color: '#f85149', margin: '0 0 15px 0', borderBottom: '1px solid #30363d', paddingBottom: '10px' }}>🚨 High Priority ({externalHigh.length})</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {externalHigh.length === 0 ? <div style={{color: '#8b949e'}}>No high priority external complaints.</div> : externalHigh.map(renderComplaintCard)}
                      </div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', overflowY: 'auto' }}>
                      <h3 style={{ color: '#8b949e', margin: '0 0 15px 0', borderBottom: '1px solid #30363d', paddingBottom: '10px' }}>✅ Normal Priority ({externalNormal.length})</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {externalNormal.length === 0 ? <div style={{color: '#8b949e'}}>No normal priority external complaints.</div> : externalNormal.map(renderComplaintCard)}
                      </div>
                    </div>
                  </>
                )}

              </div>
            </div>

        </div>

      </div>

        {activeComplaint && (
          <ComplaintChatModal 
            complaint={activeComplaint} 
            onClose={() => setActiveComplaint(null)} 
            onUpdate={() => fetchComplaints()}
          />
        )}

      {designImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999999 }} onClick={() => setDesignImage(null)}>
          <div style={{ position: 'relative', backgroundColor: '#161b22', padding: '15px', borderRadius: '12px', border: '1px solid #30363d', maxWidth: '90%', maxHeight: '90%', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setDesignImage(null)} style={{ position: 'absolute', top: '-12px', right: '-12px', background: '#f85149', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '50%', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            <img src={designImage} alt="Plan/Image" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px' }} />
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default EngineerPortalModal;
