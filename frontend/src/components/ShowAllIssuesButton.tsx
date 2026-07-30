import { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';

interface ShowAllIssuesButtonProps {
  view: any;
}

const ShowAllIssuesButton = ({ view }: ShowAllIssuesButtonProps) => {
  const [isShowingAll, setIsShowingAll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const auth = useContext(AuthContext);

  if (auth?.user?.role !== 'engineer' && auth?.user?.role !== 'admin') return null;

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

  const handleToggleAllIssues = async () => {
    if (!view) return;

    if (isShowingAll) {
      clearSelection();
      setIsShowingAll(false);
      return;
    }
    
    setIsLoading(true);
    clearSelection();
    
    try {
      const token = localStorage.getItem('token');
      // Admin sees all, Engineer sees engineer complaints
      const endpoint = auth?.user?.role === 'admin' 
        ? `${import.meta.env.VITE_API_URL}/api/complaints`
        : `${import.meta.env.VITE_API_URL}/api/complaints/engineer`;

      const res = await axios.get(endpoint, {
        headers: { 'x-auth-token': token }
      });
      const complaints = auth?.user?.role === 'admin' ? res.data : res.data.complaints;

      const activeComplaints = complaints.filter((c: any) => c.status !== 'Solved' && c.status !== 'Resolved');

      const externalComplaints = activeComplaints.filter((c: any) => c.type === 'external' && c.coordinates);
      if (externalComplaints.length > 0) {
        const complaintLayer = new GraphicsLayer({
          id: "complaint-marker-layer",
          elevationInfo: { mode: "relative-to-ground", offset: 5 }
        });
        externalComplaints.forEach((c: any) => {
          const coords = c.coordinates as any;
          const lng = coords.lng || coords.lon;
          const lat = coords.lat;
          if (lng && lat) {
            const point = new Point({ longitude: lng, latitude: lat });
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
            complaintLayer.add(pointGraphic);
          }
        });
        view.map?.add(complaintLayer);
      }
      
      const internalComplaints = activeComplaints.filter((c: any) => c.type === 'internal');
      if (internalComplaints.length > 0) {
        const catalogRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/roles/catalog?mode=all`);
        const allFeatures = [...(catalogRes.data.units || []), ...(catalogRes.data.villas || [])];
        
        const villaObjectIds: number[] = [];
        const buildingGlobalIds: string[] = [];
        
        internalComplaints.forEach((c: any) => {
          const complaintCleanId = String(c.arcgisId).replace(/[{}]/g, '').trim().toLowerCase();
          const unitData = allFeatures.find(u => {
            const uObj = String(u.OBJECTID).replace(/[{}]/g, '').trim().toLowerCase();
            const uGlob = String(u.GlobalID || '').replace(/[{}]/g, '').trim().toLowerCase();
            const uArc = String(u.arcgisId || '').replace(/[{}]/g, '').trim().toLowerCase();
            return uObj === complaintCleanId || (u.GlobalID && uGlob === complaintCleanId) || (u.arcgisId && uArc === complaintCleanId);
          });
          
          if (unitData) {
            const source = unitData.sourceLayer || unitData.SourceName;
            if (source === 'Villas_Global') {
              villaObjectIds.push(unitData.OBJECTID);
            } else if (source === 'Units') {
              if (unitData.BuildingID_FK) {
                buildingGlobalIds.push(unitData.BuildingID_FK);
              }
            }
          }
        });
        
        const highlightHandles: any[] = [];
        
        if (villaObjectIds.length > 0) {
          const villaLayer = view.map?.layers.find((l: any) => l.title === "Villas_Global" || l.title === "Villas") as any;
          if (villaLayer) {
            const layerView = await view.whenLayerView(villaLayer) as any;
            highlightHandles.push(layerView.highlight(villaObjectIds));
          }
        }
        
        if (buildingGlobalIds.length > 0) {
          const buildingLayer = view.map?.layers.find((l: any) => l.title === "Buildings_Global") as any;
          if (buildingLayer) {
            const query = buildingLayer.createQuery();
            const quotes = buildingGlobalIds.map(id => `'${id}'`).join(',');
            query.where = `GlobalID IN (${quotes})`;
            const objectIds = await buildingLayer.queryObjectIds(query);
            if (objectIds && objectIds.length > 0) {
              const layerView = await view.whenLayerView(buildingLayer) as any;
              highlightHandles.push(layerView.highlight(objectIds));
            }
          }
        }
        
        if (highlightHandles.length > 0) {
          (window as any).viewUnitHighlightHandle = {
            remove: () => highlightHandles.forEach(h => h.remove())
          };
        }
      }
      
      setIsShowingAll(true);
    } catch (e) {
      console.error("Error highlighting issues:", e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      title={isShowingAll ? "Hide All Issues" : "Show All Issues"}
      onClick={handleToggleAllIssues}
      className={`map-icon-btn ${isShowingAll ? 'active' : 'inactive'}`}
      style={{ 
        color: isShowingAll ? 'var(--text-primary)' : 'var(--accent-red)', 
        borderColor: 'var(--accent-red)',
        fontSize: '20px'
      }}
      disabled={isLoading}
    >
      {isLoading ? '⏳' : isShowingAll ? '🚫' : '👁️'}
    </button>
  );
};

export default ShowAllIssuesButton;
