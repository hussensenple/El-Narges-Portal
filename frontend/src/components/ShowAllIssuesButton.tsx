import { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';

interface ShowAllIssuesButtonProps {
  view: any;
}

const UNITS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37';

const ShowAllIssuesButton = ({ view }: ShowAllIssuesButtonProps) => {
  const [isShowingAll, setIsShowingAll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const auth = useContext(AuthContext);

  if (auth?.user?.role !== 'engineer' && auth?.user?.role !== 'admin') return null;

  const clearAll = () => {
    if ((window as any).viewUnitHighlightHandle) {
      (window as any).viewUnitHighlightHandle.remove();
      (window as any).viewUnitHighlightHandle = null;
    }
    if (view && view.map) {
      const layersToRemove = view.map.layers.filter((l: any) => l.id === "complaint-marker-layer" || l.id === "all-issues-layer").toArray();
      layersToRemove.forEach((l: any) => view.map.remove(l));
    }
  };

  const makeRedDotLayer = (id: string) => new GraphicsLayer({
    id,
    elevationInfo: { mode: "relative-to-scene", offset: 30 }
  });

  const makeRedDotSymbol = () => ({
    type: "point-3d",
    symbolLayers: [{
      type: "icon",
      resource: { primitive: "circle" },
      material: { color: "#da3633" },
      outline: { color: "#ffffff", size: 3 },
      size: "28px"
    }]
  });

  const addDotAt = (layer: GraphicsLayer, x: number, y: number, spatialReference?: any) => {
    const point = new Point({ x, y, spatialReference });
    const graphic = new Graphic({ geometry: point, symbol: makeRedDotSymbol() as any });
    layer.add(graphic);
  };

  const handleToggleAllIssues = async () => {
    if (!view) return;

    if (isShowingAll) {
      clearAll();
      setIsShowingAll(false);
      return;
    }

    setIsLoading(true);
    clearAll();

    try {
      const token = localStorage.getItem('token');
      const endpoint = auth?.user?.role === 'admin'
        ? `${import.meta.env.VITE_API_URL}/api/complaints`
        : `${import.meta.env.VITE_API_URL}/api/complaints/engineer`;

      const res = await axios.get(endpoint, { headers: { 'x-auth-token': token } });
      const complaints = auth?.user?.role === 'admin' ? res.data : res.data.complaints;
      const activeComplaints = (complaints || []).filter((c: any) => c.status !== 'Solved' && c.status !== 'Resolved');

      // ── LAYER for all red dots ──
      const dotsLayer = makeRedDotLayer("all-issues-layer");
      view.map?.add(dotsLayer);

      // ── 1. EXTERNAL: use stored coordinates ──
      const externalComplaints = activeComplaints.filter((c: any) => c.type === 'external' && c.coordinates);
      externalComplaints.forEach((c: any) => {
        const coords = c.coordinates as any;
        const lng = coords.lng || coords.lon;
        const lat = coords.lat;
        if (lng && lat) {
          // external uses geographic coords — add a separate geographic-mode dot
          const geoLayer = new GraphicsLayer({
            id: `ext-dot-${c._id}`,
            elevationInfo: { mode: "relative-to-ground", offset: 5 }
          });
          const point = new Point({ longitude: lng, latitude: lat });
          const graphic = new Graphic({ geometry: point, symbol: makeRedDotSymbol() as any });
          geoLayer.add(graphic);
          view.map?.add(geoLayer);
        }
      });

      // ── 2. INTERNAL: resolve each to a building/villa and place dot ──
      const internalComplaints = activeComplaints.filter((c: any) => c.type === 'internal');

      const highlightHandles: any[] = [];

      for (const complaint of internalComplaints) {
        try {
          const arcgisIdRaw = String(complaint.arcgisId).trim();
          const isNumericId = /^\d+$/.test(arcgisIdRaw);

          const buildingLayer = view.map?.layers.find((l: any) =>
            l.title === "Buildings_Global" || l.title === "Buildings"
          ) as any;
          const villaLayer = view.map?.layers.find((l: any) =>
            l.title === "Villas_Global" || l.title === "Villas"
          ) as any;

          const getWhereForId = (id: string) => {
            const up = id.toUpperCase();
            const lo = id.toLowerCase();
            return `GlobalID = '{${up}}' OR GlobalID = '${up}' OR GlobalID = '{${lo}}' OR GlobalID = '${lo}' OR GlobalID = '{${id}}' OR GlobalID = '${id}'`;
          };

          const zoomToBuilding = async (globalId: string) => {
            if (!buildingLayer) return;
            const cleanFk = globalId.replace(/[{}]/g, '').trim();
            const q = buildingLayer.createQuery();
            q.where = getWhereForId(cleanFk);
            q.returnGeometry = true;
            const extRes = await buildingLayer.queryExtent(q);
            if (extRes && extRes.extent) {
              const c = extRes.extent.center;
              addDotAt(dotsLayer, c.x, c.y, c.spatialReference);
              const ids = await buildingLayer.queryObjectIds(q);
              if (ids && ids.length > 0) {
                const lv = await view.whenLayerView(buildingLayer) as any;
                highlightHandles.push(lv.highlight(ids));
              }
            }
          };

          if (isNumericId) {
            // Apartment by OBJECTID → get BuildingID_FK
            const unitRes = await axios.get(`${UNITS_URL}/query`, {
              params: { where: `OBJECTID = ${arcgisIdRaw}`, outFields: 'BuildingID_FK', f: 'json' }
            });
            const feat = (unitRes.data.features || [])[0];
            if (feat?.attributes?.BuildingID_FK) {
              await zoomToBuilding(feat.attributes.BuildingID_FK);
            }

          } else {
            const cleanId = arcgisIdRaw.replace(/[{}]/g, '').trim();

            // Try villas first
            let handled = false;
            if (villaLayer) {
              const vq = villaLayer.createQuery();
              vq.where = getWhereForId(cleanId);
              vq.returnGeometry = true;
              try {
                const vExt = await villaLayer.queryExtent(vq);
                if (vExt && vExt.extent) {
                  const c = vExt.extent.center;
                  addDotAt(dotsLayer, c.x, c.y, c.spatialReference);
                  const ids = await villaLayer.queryObjectIds(vq);
                  if (ids && ids.length > 0) {
                    const lv = await view.whenLayerView(villaLayer) as any;
                    highlightHandles.push(lv.highlight(ids));
                  }
                  handled = true;
                }
              } catch (_) {}
            }

            if (!handled && buildingLayer) {
              // Try Buildings_Global directly (building's own GlobalID)
              const bq = buildingLayer.createQuery();
              bq.where = getWhereForId(cleanId);
              bq.returnGeometry = true;
              try {
                const bExt = await buildingLayer.queryExtent(bq);
                if (bExt && bExt.extent) {
                  const c = bExt.extent.center;
                  addDotAt(dotsLayer, c.x, c.y, c.spatialReference);
                  const ids = await buildingLayer.queryObjectIds(bq);
                  if (ids && ids.length > 0) {
                    const lv = await view.whenLayerView(buildingLayer) as any;
                    highlightHandles.push(lv.highlight(ids));
                  }
                  handled = true;
                }
              } catch (_) {}
            }

            if (!handled) {
              // Fallback: look up in MongoDB by globalId → get buildingIdFk
              try {
                const lookupRes = await axios.get(
                  `${import.meta.env.VITE_API_URL}/api/complaints/unit-lookup?id=${cleanId}`,
                  { headers: { 'x-auth-token': token } }
                );
                if (lookupRes.data?.buildingIdFk) {
                  await zoomToBuilding(lookupRes.data.buildingIdFk);
                }
              } catch (_) {}
            }
          }
        } catch (err) {
          console.warn(`ShowAll: failed to place dot for complaint ${complaint._id}`, err);
        }
      }

      if (highlightHandles.length > 0) {
        (window as any).viewUnitHighlightHandle = {
          remove: () => highlightHandles.forEach(h => h.remove())
        };
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
        color: isShowingAll ? '#fff' : '#f85149',
        borderColor: '#f85149',
        fontSize: '20px'
      }}
      disabled={isLoading}
    >
      {isLoading ? '⏳' : isShowingAll ? '🚫' : '👁️'}
    </button>
  );
};

export default ShowAllIssuesButton;
