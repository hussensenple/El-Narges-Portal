import { useState, useEffect } from 'react';
import Graphic from '@arcgis/core/Graphic';
import * as closestFacility from '@arcgis/core/rest/closestFacility';
import ClosestFacilityParameters from '@arcgis/core/rest/support/ClosestFacilityParameters';
import FeatureSet from '@arcgis/core/rest/support/FeatureSet';
import Point from '@arcgis/core/geometry/Point';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import SceneView from '@arcgis/core/views/SceneView';

// 🎨 أيقونات SVG عصرية (Dark Theme)
const Icons = {
  MapRoute: () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="21"></line></svg>,
  Target: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>,
  Trash: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  School: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>,
  Gym: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M6 5h2v14H6z"/><path d="M16 5h2v14h-2z"/><path d="M2 8h4v8H2z"/><path d="M18 8h4v8h-4z"/><path d="M8 11h8v2H8z"/></svg>,
  Commercial: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>,
  Cancel: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
};

interface RoutingWidgetProps {
  view: SceneView | null;
}

const RoutingWidget = ({ view }: RoutingWidgetProps) => {
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [routeLayer, setRouteLayer] = useState<GraphicsLayer | null>(null);

  const [routeInfo, setRouteInfo] = useState<{ [key: string]: string | null }>({
    school: null,
    gym: null,
    commercial: null
  });

  const routingServiceUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/ClosestFacility/NAServer/ClosestFacility_World";
  const TARGET_LAYERS = ["Residential", "Residential1"];

  // 1. إنشاء طبقة الرسم
  useEffect(() => {
    if (view && view.map) {
      const layer = new GraphicsLayer({
        title: "Closest Facilities", 
        elevationInfo: { mode: "relative-to-ground", offset: 4 },
        listMode: "hide"
      });
      view.map.add(layer);
      setRouteLayer(layer);

      return () => {
        if (view && view.map) {
          view.map.remove(layer);
        }
      };
    }
  }, [view]);

  // 2. تفعيل اختيار المبنى
  useEffect(() => {
    if (!view || !isSelecting || !routeLayer) return;

    (view as any).cursor = "crosshair";

    const clickHandle = view.on("click", async (event: any) => {
      event.stopPropagation();
      const response = await view.hitTest(event);
      
      const residentialHit = response.results.find(
        (res: any) => res.type === "graphic" && res.graphic.layer && TARGET_LAYERS.includes(res.graphic.layer.title)
      ) as any;

      if (residentialHit) {
        setIsSelecting(false);
        (view as any).cursor = "default";

        const clickedBuilding = residentialHit.graphic;
        const geom = clickedBuilding.geometry as any;
        const incidentPoint = geom.extent ? geom.extent.center : geom;

        calculateRouteToServices(incidentPoint, view, routeLayer);
      } else {
        console.log("Please click on a valid residential building.");
      }
    });

    return () => {
      clickHandle.remove();
      (view as any).cursor = "default";
    };
  }, [view, isSelecting, routeLayer]);

  // 3. حساب المسارات
  const calculateRouteToServices = async (incidentPoint: Point, currentView: SceneView, activeRouteLayer: GraphicsLayer) => {
    setIsCalculating(true);
    setRouteInfo({ school: null, gym: null, commercial: null });
    
    const serviceGroups: { [key: string]: { color: number[], solidColor: number[], features: Graphic[] } } = {
      "school": { color: [21, 255, 0, 1], solidColor: [21, 255, 0], features: [] },      
      "gym": { color: [255, 50, 50, 1], solidColor: [255, 50, 50], features: [] },        
      "commercial": { color: [50, 200, 255, 1], solidColor: [50, 200, 255], features: [] }  
    };
    
    const facilityLayerName = "Multi_Services"; 

    if (currentView && currentView.map) {
      for (const layer of currentView.map.layers.toArray()) {
        if (layer.title === facilityLayerName && (layer.type === "feature" || layer.type === "scene")) {
          const queryLayer = layer as any;
          const query = queryLayer.createQuery();
          query.where = "1=1"; 
          query.outSpatialReference = currentView.spatialReference;
          query.returnGeometry = true;
          query.outFields = ["*"]; 
          
          try {
            const featureSet = await queryLayer.queryFeatures(query);
            
            featureSet.features.forEach((feature: any) => {
              let matchedType: string | null = null;
              for (const key in feature.attributes) {
                const val = feature.attributes[key];
                if (val !== null && val !== undefined) {
                  const strVal = String(val).toLowerCase().trim();
                  if (strVal === "school") matchedType = "school";
                  else if (strVal === "gym") matchedType = "gym";
                  else if (strVal === "commercial" || strVal === "mall") matchedType = "commercial";
                  if (matchedType) break; 
                }
              }

              if (matchedType && serviceGroups[matchedType]) {
                const geom = feature.geometry as any;
                const centerPt = geom.extent ? geom.extent.center : geom;
                serviceGroups[matchedType].features.push(new Graphic({ geometry: centerPt }));
              }
            });
          } catch (error) {
            console.error(`Error reading data from layer ${layer.title}:`, error);
          }
        }
      }
    }

    const incidents = new FeatureSet({ features: [new Graphic({ geometry: incidentPoint })] });
    activeRouteLayer.removeAll(); 

    const routePromises = Object.keys(serviceGroups).map(async (typeKey) => {
      const typeData = serviceGroups[typeKey];
      if (typeData.features.length === 0) return null; 

      const facilities = new FeatureSet({ features: typeData.features });
      const params = new ClosestFacilityParameters({
        incidents: incidents,
        facilities: facilities,
        returnRoutes: true,
        defaultTargetFacilityCount: 1 
      });

      try {
        // حلينا مشكلة المتغير التالت هنا بإضافة {} كمتغير إضافي للـ TS
        const results = await closestFacility.solve(routingServiceUrl, params, {} as any);
        const features = results?.routes?.features;
        if (features && features.length > 0) {
          const routeGraphic = features[0];
          
          const totalKm = routeGraphic.attributes.Total_Kilometers || 0;
          const totalMinsFloat = routeGraphic.attributes.Total_Minutes || routeGraphic.attributes.Total_TravelTime || 0;
          
          const meters = Math.round(totalKm * 1000);
          let minutes = Math.floor(totalMinsFloat);
          let seconds = Math.round((totalMinsFloat - minutes) * 60);
          if (seconds === 60) { minutes += 1; seconds = 0; }

          let timeString = `${minutes} min`;
          if (seconds > 0) timeString += ` ${seconds} sec`;
          const formattedInfo = `${meters} m | ${timeString}`;

          routeGraphic.symbol = {
            type: "line-3d",
            symbolLayers: [{
              type: "path",
              profile: "circle", 
              width: 3.5,
              material: { color: typeData.color } 
            }]
          } as any;

          const routeGeom = routeGraphic.geometry as any;
          const lastPath = routeGeom.paths[routeGeom.paths.length - 1];
          const endPointCoords = lastPath[lastPath.length - 1];

          const targetFacilityPoint = new Point({
            x: endPointCoords[0],
            y: endPointCoords[1],
            z: endPointCoords.length > 2 ? endPointCoords[2] : 0,
            spatialReference: routeGeom.spatialReference
          });

          const facilityPin = new Graphic({
            geometry: targetFacilityPoint,
            symbol: {
              type: "point-3d",
              symbolLayers: [{
                type: "object",
                resource: { primitive: "inverted-cone" },
                height: 35, width: 12,
                material: { color: typeData.solidColor }
              }]
            } as any
          });

          return { routeGraphic, facilityPin, typeKey, infoText: formattedInfo };
        }
      } catch (error) {
        console.error(`Failed to calculate route for type ${typeKey}:`, error);
      }
      return null;
    });

    try {
      const routeResults = await Promise.all(routePromises);
      const validResults = routeResults.filter(r => r !== null);
      
      if (validResults.length > 0) {
        const newRouteInfo: { [key: string]: string | null } = { school: null, gym: null, commercial: null };
        const graphicsToAdd: any[] = [];
        
        validResults.forEach(res => {
          if(res) {
            graphicsToAdd.push(res.routeGraphic);
            graphicsToAdd.push(res.facilityPin); 
            newRouteInfo[res.typeKey] = res.infoText;
          }
        });

        activeRouteLayer.addMany(graphicsToAdd);
        activeRouteLayer.listMode = "show";
        setRouteInfo(newRouteInfo); 
      }
    } catch (e) {
      console.error("General error in route execution:", e);
    } finally {
      setIsCalculating(false);
    }
  };

  const clearRoutes = () => {
    if (routeLayer) {
      routeLayer.removeAll();
      routeLayer.listMode = "hide";
    }
    setRouteInfo({ school: null, gym: null, commercial: null });
    setIsSelecting(false);
    if (view) (view as any).cursor = "default";
  };

  return (
    <div className="widget-3d-routing" style={{ 
      backgroundColor: '#0d1117', 
      height: 'auto', 
      maxHeight: 'calc(100vh - 160px)', 
      overflowY: 'auto', // 👈 نخلي السكرول رأسي بس لو المحتوى كبر
      overflowX: 'hidden', // 👈 نقتل السكرول الأفقي المستفز ده
      fontFamily: "'Inter', 'Segoe UI', Roboto, sans-serif", 
      color: '#c9d1d9',
      borderRadius: '12px', // 👈 حواف أنعم شوية
      border: '1px solid #30363d', 
      width: '340px', // 👈 عرضناها شوية عشان المحتوى يتنفس
      padding: '20px',
      boxSizing: 'border-box', // 👈 السطر السحري اللي بيمنع الـ Padding إنه يبوظ العرض
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
    }}>
      <style>{`
        @keyframes pulse-anim { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.98); } 100% { opacity: 1; transform: scale(1); } }
        .is-selecting { animation: pulse-anim 1.5s infinite ease-in-out; border-color: #da3633 !important; background-color: rgba(218, 54, 51, 0.1) !important; color: #ff7b72 !important; }
        .action-btn { transition: all 0.2s ease; }
        .action-btn:hover:not(:disabled):not(.is-selecting) { background-color: #388bfd !important; transform: translateY(-1px); }
        .clear-btn:hover { background-color: rgba(218, 54, 51, 0.15) !important; color: #ff7b72 !important; border-color: #ff7b72 !important; }
        .route-card { transition: transform 0.2s; }
        .route-card:hover { transform: translateX(4px); }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #30363d' }}>
        <div style={{ color: '#58a6ff' }}><Icons.MapRoute /></div>
        <h5 style={{ fontWeight: 800, color: '#ffffff', margin: 0, fontSize: '16px', letterSpacing: '-0.3px' }}>3D Routing Analyzer</h5>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          className={`action-btn ${isSelecting ? 'is-selecting' : ''}`}
          onClick={() => {
            setIsSelecting(!isSelecting);
            if (isSelecting && view) (view as any).cursor = "default";
          }}
          disabled={!view}
          style={{
            flex: 2, padding: '12px',
            backgroundColor: !view ? '#21262d' : (isSelecting ? 'transparent' : '#1f6feb'),
            color: !view ? '#8b949e' : (isSelecting ? '#ff7b72' : '#ffffff'),
            border: isSelecting ? '1px solid #da3633' : '1px solid transparent',
            borderRadius: '8px', fontWeight: 600, fontSize: '13px',
            cursor: !view ? 'not-allowed' : 'pointer',
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
            boxShadow: (!view || isSelecting) ? 'none' : '0 4px 12px rgba(31, 111, 235, 0.2)'
          }}
        >
          {isSelecting ? <><Icons.Cancel /> Cancel Selection</> : <><Icons.Target /> Select Building</>}
        </button>

        <button 
          className="clear-btn" onClick={clearRoutes}
          style={{
            flex: 1, padding: '12px',
            backgroundColor: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
            borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', 
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px',
            transition: 'all 0.2s ease'
          }}
        >
          <Icons.Trash /> Clear
        </button>
      </div>

      {isSelecting && (
        <div style={{ textAlign: 'center', fontSize: '12px', color: '#ff7b72', fontWeight: 600, marginBottom: '20px', padding: '8px', backgroundColor: 'rgba(218, 54, 51, 0.1)', borderRadius: '6px', border: '1px solid rgba(218, 54, 51, 0.2)' }}>
          Target a residential building on the map...
        </div>
      )}

      {isCalculating && (
        <div style={{ textAlign: 'center', fontSize: '13px', color: '#f2cc60', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span style={{ animation: 'pulse-anim 1s infinite' }}>Finding Closest Services...</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {['school', 'gym', 'commercial'].map((type) => {
          const colors: any = { school: '#15ff00', gym: '#ff3232', commercial: '#32c8ff' };
          const TypeIcon: any = Icons[type.charAt(0).toUpperCase() + type.slice(1) as keyof typeof Icons];
          return (
            <div key={type} className="route-card" style={{ backgroundColor: '#161b22', padding: '16px', borderRadius: '10px', border: '1px solid #30363d', borderLeft: `4px solid ${colors[type]}`, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                 <div style={{ color: colors[type] }}><TypeIcon /></div>
                 <div style={{ fontSize: '12px', color: '#8b949e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{type}</div>
              </div>
              <div style={{ fontSize: '16px', color: '#ffffff', fontWeight: 800, direction: 'ltr', textAlign: 'left', paddingLeft: '24px' }}>
                {routeInfo[type] || '---'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

export default RoutingWidget;