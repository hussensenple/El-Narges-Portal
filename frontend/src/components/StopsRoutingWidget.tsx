import { useState, useEffect, useRef } from 'react';
import Graphic from '@arcgis/core/Graphic';
import * as route from '@arcgis/core/rest/route';
import RouteParameters from '@arcgis/core/rest/support/RouteParameters';
import FeatureSet from '@arcgis/core/rest/support/FeatureSet';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Point from '@arcgis/core/geometry/Point';
import SceneView from '@arcgis/core/views/SceneView';

// 🎨 أيقونات SVG عصرية (Dark Theme)
const Icons = {
  MapRoute: () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="21"></line></svg>,
  PinAdd: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle><line x1="12" y1="2" x2="12" y2="6"></line><line x1="8" y1="6" x2="16" y2="6"></line></svg>,
  Cancel: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>,
  Play: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>,
  Trash: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  Car: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a2 2 0 0 0-1.6-.8H5a2 2 0 0 0-2 2v7.4"></path><circle cx="6.5" cy="16.5" r="2.5"></circle><circle cx="16.5" cy="16.5" r="2.5"></circle></svg>,
  Truck: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="12" height="14" rx="1"></rect><path d="M14 9h4l3 3v7h-7"></path><circle cx="6.5" cy="19.5" r="1.5"></circle><circle cx="17.5" cy="19.5" r="1.5"></circle></svg>,
  DirUp: () => <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>,
  DirRight: () => <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>,
  DirLeft: () => <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>,
  DirRoundabout: () => <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 4.93l2.83 2.83"></path></svg>,
  DirFlag: () => <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>,
  DirUTurn: () => <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M9 10a5 5 0 0 1 10 0v11"></path><polyline points="5 14 9 10 13 14"></polyline></svg>
};

interface StopsRoutingWidgetProps {
  view: SceneView | null;
}

const StopsRoutingWidget = ({ view }: StopsRoutingWidgetProps) => {
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(false);
  
  const [stops, setStops] = useState<Graphic[]>([]);
  const stopsRef = useRef<Graphic[]>([]);
  
  const [routingMode, setRoutingMode] = useState<string>("default");
  const [travelMode, setTravelMode] = useState<string>("Driving");
  
  const [routeLayer, setRouteLayer] = useState<GraphicsLayer | null>(null);
  const [stopsLayer, setStopsLayer] = useState<GraphicsLayer | null>(null);
  const [highlightLayer, setHighlightLayer] = useState<GraphicsLayer | null>(null);

  const [routeResult, setRouteResult] = useState<string | null>(null);
  const [directions, setDirections] = useState<any[]>([]);

  const routingServiceUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";

  useEffect(() => {
    stopsRef.current = stops;
  }, [stops]);

  useEffect(() => {
    if (view && view.map) {
      const rLayer = new GraphicsLayer({
        title: "Proposed Route", 
        elevationInfo: { mode: "relative-to-scene", offset: 2 },
        listMode: "hide"
      });

      const hLayer = new GraphicsLayer({
        title: "Highlighted Directions", 
        elevationInfo: { mode: "relative-to-scene", offset: 2.5 }, 
        listMode: "hide"
      });
      
      const sLayer = new GraphicsLayer({
        title: "Stops",
        elevationInfo: { mode: "relative-to-scene", offset: 3 },
        listMode: "hide"
      });

      view.map.addMany([rLayer, hLayer, sLayer]);
      setRouteLayer(rLayer);
      setHighlightLayer(hLayer);
      setStopsLayer(sLayer);

      return () => {
        if (view && view.map) {
          view.map.removeMany([rLayer, hLayer, sLayer]);
        }
      };
    }
  }, [view]);

  useEffect(() => {
    if (!view || !isActive || !stopsLayer) return;

    (view as any).cursor = "crosshair";

    const clickHandle = view.on("click", (event) => {
      event.stopPropagation();

      const currentStopsCount = stopsRef.current.length;

      const stopPoint = new Point({
        x: event.mapPoint.x,
        y: event.mapPoint.y,
        z: 0,
        spatialReference: view.spatialReference
      });

      const stopColor = currentStopsCount === 0 ? [46, 204, 113] : [88, 166, 255]; 

      const stopGraphic = new Graphic({
        geometry: stopPoint,
        symbol: {
          type: "point-3d",
          symbolLayers: [{
            type: "object",
            resource: { primitive: "sphere" },
            height: 8,
            width: 8,
            material: { color: stopColor }
          }]
        } as any,
        attributes: {
          Name: `Stop ${currentStopsCount + 1}`
        }
      });

      stopsLayer.add(stopGraphic);
      stopsLayer.listMode = "show";
      
      setStops(prevStops => [...prevStops, stopGraphic]);
    });

    return () => {
      clickHandle.remove();
      (view as any).cursor = "default";
    };
  }, [view, isActive, stopsLayer]); 

  const calculateRoute = async () => {
    if (stops.length < 2 || !routeLayer) {
      alert("Please add at least two stops (start and end) to calculate the route.");
      return;
    }

    setIsCalculating(true);
    routeLayer.removeAll(); 
    if (highlightLayer) highlightLayer.removeAll();
    setRouteResult(null);
    setDirections([]);

    const clonedStops = stops.map(stopGraphic => stopGraphic.clone());

    const routeParams = new RouteParameters({
      stops: new FeatureSet({ features: clonedStops }),
      returnDirections: true, 
      directionsLengthUnits: "meters", 
      returnRoutes: true
    });

    routeParams.impedanceAttribute = "TravelTime";

    if (routingMode !== "default") {
      routeParams.findBestSequence = true; 
      if (routingMode === "optimize") {
        routeParams.preserveFirstStop = false;
        routeParams.preserveLastStop = false;
      } else if (routingMode === "preserve_first") {
        routeParams.preserveFirstStop = true;
        routeParams.preserveLastStop = false;
      } else if (routingMode === "preserve_first_last") {
        routeParams.preserveFirstStop = true;
        routeParams.preserveLastStop = true;
      }
    } else {
      routeParams.findBestSequence = false; 
    }

    try {
      const data = await route.solve(routingServiceUrl, routeParams);
      
      if (data.routeResults && data.routeResults.length > 0) {
        const routeGraphic = data.routeResults[0].route;
        const resultDirections = data.routeResults[0].directions;
        
        // 👈 ضفنا الحماية هنا: لو routeGraphic مش موجود، وقف وماتكملش
        if (!routeGraphic) return;

        let routeColor = travelMode === "Trucking" ? [243, 156, 18, 0.9] : [46, 204, 113, 0.9];
        let routeWidth = travelMode === "Trucking" ? 4.5 : 3.5;

        routeGraphic.symbol = {
          type: "line-3d",
          symbolLayers: [{
            type: "path",
            profile: "circle",
            width: routeWidth, 
            material: { color: routeColor } 
          }]
        } as any;

        // 👈 حماية تانية للـ routeLayer
        if (routeLayer) {
          routeLayer.add(routeGraphic);
          routeLayer.listMode = "show"; 
        }

        const totalKm = routeGraphic.attributes?.Total_Kilometers || 0;
        let baseTimeFloat = 0;
        
        if (resultDirections && resultDirections.totalTime) {
           baseTimeFloat = resultDirections.totalTime;
        } else {
           baseTimeFloat = routeGraphic.attributes?.Total_TravelTime || routeGraphic.attributes?.Total_Minutes || 0;
        }

        let finalTimeFloat = baseTimeFloat;
        if (travelMode === "Trucking") {
          finalTimeFloat = baseTimeFloat * 1.4; 
        }
        
        const meters = Math.round(totalKm * 1000);
        let minutes = Math.floor(finalTimeFloat);
        let seconds = Math.round((finalTimeFloat - minutes) * 60);
        
        if (seconds === 60) { minutes += 1; seconds = 0; }

        let timeString = `${minutes} min`;
        if (seconds > 0) timeString += ` ${seconds} sec`;

        setRouteResult(`${meters} m | ${timeString}`);

        if (resultDirections && resultDirections.features) {
          setDirections(resultDirections.features);
        }
      }
    } catch (error) {
      console.error("Route calculation failed:", error);
      alert("Error calculating the route. The stops might be outside the road network.");
    } finally {
      setIsCalculating(false);
      setIsActive(false);
    }
  };

  const clearRoute = () => {
    setStops([]);
    setRouteResult(null);
    setDirections([]); 
    
    if (routeLayer) {
      routeLayer.removeAll(); 
      routeLayer.listMode = "hide"; 
    }
    if (highlightLayer) highlightLayer.removeAll();
    if (stopsLayer) {
      stopsLayer.removeAll(); 
      stopsLayer.listMode = "hide"; 
    }
    
    setIsActive(false);
  };

  const handleMouseEnter = (dirFeature: any) => {
    if (!highlightLayer || !dirFeature.geometry) return;
    
    highlightLayer.removeAll();
    const highlightGraphic = new Graphic({
      geometry: dirFeature.geometry,
      symbol: {
        type: "line-3d",
        symbolLayers: [{
          type: "path",
          profile: "circle",
          width: 7, 
          material: { color: [255, 235, 59, 0.9] } 
        }]
      } as any
    });
    highlightLayer.add(highlightGraphic);
  };

  const handleMouseLeave = () => {
    if (highlightLayer) highlightLayer.removeAll();
  };

  const getThemeColor = () => {
    if (travelMode === "Trucking") return "#f39c12"; 
    return "#2ecc71"; 
  };

  return (
    <div className="widget-multi-stop-routing" style={{ 
      backgroundColor: '#0d1117',
      height: 'auto', 
      maxHeight: 'calc(100vh - 160px)', 
      overflowY: 'auto',
      overflowX: 'hidden',
      fontFamily: "'Inter', 'Segoe UI', Roboto, sans-serif",
      color: '#c9d1d9',
      borderRadius: '12px',
      border: '1px solid #30363d',
      width: '340px',
      padding: '20px',
      boxSizing: 'border-box',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
    }}>
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes pulse-anim { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.98); } 100% { opacity: 1; transform: scale(1); } }
        .is-selecting { animation: pulse-anim 1.5s infinite ease-in-out; border-color: #da3633 !important; background-color: rgba(218, 54, 51, 0.1) !important; color: #ff7b72 !important; }
        .action-btn { transition: all 0.2s ease; }
        .action-btn:hover:not(:disabled):not(.is-selecting) { background-color: #2ea043 !important; color: #ffffff !important; transform: translateY(-1px); }
        .action-btn.trucking:hover:not(:disabled):not(.is-selecting) { background-color: #d68910 !important; color: #ffffff !important; }
        .clear-btn:hover { background-color: rgba(218, 54, 51, 0.15) !important; color: #ff7b72 !important; border-color: #ff7b72 !important; }
        .modern-select { background-color: #21262d; color: #c9d1d9; border: 1px solid #30363d; outline: none; transition: all 0.2s; }
        .modern-select:focus { border-color: #58a6ff; }
        .modern-select option { background-color: #161b22; color: #c9d1d9; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #30363d' }}>
        <div style={{ color: getThemeColor(), transition: 'color 0.3s' }}><Icons.MapRoute /></div>
        <h5 style={{ fontWeight: 800, color: '#ffffff', margin: 0, fontSize: '16px', letterSpacing: '-0.3px' }}>Fleet & Stops Routing</h5>
      </div>

      {/* زر تحديد النقاط */}
      <button 
        className={`action-btn ${isActive ? 'is-selecting' : ''}`}
        onClick={() => setIsActive(!isActive)}
        disabled={!view}
        style={{
          width: '100%', padding: '12px',
          backgroundColor: !view ? '#21262d' : (isActive ? 'transparent' : '#161b22'),
          color: !view ? '#8b949e' : (isActive ? '#ff7b72' : '#58a6ff'),
          border: isActive ? '1px solid #da3633' : '1px solid #30363d',
          borderRadius: '8px', fontWeight: 600, fontSize: '14px',
          cursor: !view ? 'not-allowed' : 'pointer',
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
          fontFamily: 'inherit', transition: 'all 0.3s ease', marginBottom: '20px'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isActive ? <Icons.Cancel /> : <Icons.PinAdd />}
          {isActive ? 'Stop Selecting' : 'Add Stops on Map'}
        </span>
      </button>

      {/* الفلاتر (Dropdowns) */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#8b949e', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            {travelMode === 'Trucking' ? <Icons.Truck /> : <Icons.Car />} Travel Mode:
          </label>
          <select 
            value={travelMode} 
            onChange={(e) => setTravelMode(e.target.value)}
            className="modern-select"
            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
          >
            <option value="Driving">Standard (Car)</option>
            <option value="Trucking">Heavy (Truck)</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#8b949e', display: 'block', marginBottom: '6px' }}>Routing Strategy:</label>
          <select 
            value={routingMode} 
            onChange={(e) => setRoutingMode(e.target.value)}
            className="modern-select"
            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
          >
            <option value="default">Sequential</option>
            <option value="optimize">Optimize Sequence</option>
            <option value="preserve_first_last">Preserve First & Last</option>
          </select>
        </div>
      </div>

      {/* أزرار الحساب والمسح */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={calculateRoute}
          disabled={stops.length < 2 || isCalculating}
          className={`action-btn ${travelMode === "Trucking" ? 'trucking' : ''}`}
          style={{
            flex: 2, padding: '12px', 
            backgroundColor: stops.length < 2 ? '#21262d' : (travelMode === "Trucking" ? '#f39c12' : '#2ecc71'),
            color: stops.length < 2 ? '#8b949e' : 'white', 
            border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px',
            cursor: stops.length < 2 ? 'not-allowed' : 'pointer',
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontFamily: 'inherit'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isCalculating ? <span style={{ animation: 'pulse-anim 1s infinite' }}>Calculating...</span> : <><Icons.Play /> Calculate Route</>}
          </span>
        </button>
        <button 
          className="clear-btn"
          onClick={clearRoute}
          style={{
            flex: 1, padding: '12px', backgroundColor: '#21262d', color: '#c9d1d9',
            border: '1px solid #30363d', borderRadius: '8px', fontWeight: 600, fontSize: '13px',
            cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', fontFamily: 'inherit', transition: 'all 0.2s ease'
          }}
        >
          <Icons.Trash /> Clear
        </button>
      </div>

      {/* لوحة المعلومات (Summary Panel) */}
      <div style={{ padding: '16px', backgroundColor: '#161b22', borderRadius: '10px', border: '1px solid #30363d', marginBottom: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#8b949e' }}>Total Stops:</span>
          <span style={{ color: getThemeColor(), fontSize: '16px', fontWeight: 800, transition: 'color 0.3s' }}>{stops.length}</span>
        </div>
        {routeResult && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#8b949e', fontWeight: 600 }}>Total Route:</span>
            <span style={{ fontSize: '15px', color: '#ffffff', fontWeight: 800, direction: 'ltr' }}>{routeResult}</span>
          </div>
        )}
      </div>

      {/* قائمة الاتجاهات (Directions List) */}
      {directions.length > 0 && (
        <div style={{ border: '1px solid #30363d', borderRadius: '10px', backgroundColor: '#0d1117', overflow: 'hidden' }}>
          {directions.map((dir, idx) => {
            const maneuver = dir.attributes.maneuverType || "";
            const text = dir.attributes.text;
            const length = Math.round(dir.attributes.length);
            
            let stepTimeFloat = dir.attributes.time;
            if (travelMode === "Trucking") stepTimeFloat = stepTimeFloat * 1.4;

            const timeMins = Math.floor(stepTimeFloat);
            const timeSecs = Math.round((stepTimeFloat - timeMins) * 60);
            
            let timeStr = "";
            if (timeMins > 0) timeStr += `${timeMins} min `;
            timeStr += `${timeSecs} sec`;

            let IconComponent = Icons.DirUp;
            if (maneuver.includes("Right")) IconComponent = Icons.DirRight;
            else if (maneuver.includes("Left")) IconComponent = Icons.DirLeft;
            else if (maneuver.includes("Roundabout")) IconComponent = Icons.DirRoundabout;
            else if (maneuver.includes("Depart") || maneuver.includes("Stop")) IconComponent = Icons.DirFlag;
            else if (maneuver.includes("U-Turn")) IconComponent = Icons.DirUTurn;

            return (
              <div 
                key={idx} 
                onMouseEnter={() => handleMouseEnter(dir)}
                onMouseLeave={handleMouseLeave}
                style={{ 
                  display: 'flex', alignItems: 'center', padding: '12px 16px', 
                  borderBottom: idx === directions.length - 1 ? 'none' : '1px solid #30363d', 
                  backgroundColor: idx % 2 === 0 ? '#161b22' : '#0d1117', 
                  cursor: 'pointer', transition: 'background-color 0.2s' 
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#21262d')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#161b22' : '#0d1117')}
              >
                <div style={{ width: '30px', textAlign: 'center', marginRight: '16px', color: '#58a6ff' }}>
                  <IconComponent />
                </div>
                <div style={{ flex: 1, direction: 'ltr', textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', color: '#ffffff', fontWeight: 600, marginBottom: '4px' }}>{text}</div>
                  <div style={{ fontSize: '11px', color: '#8b949e', fontWeight: 500 }}>{length} m | {timeStr}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StopsRoutingWidget;