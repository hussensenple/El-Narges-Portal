import React, { useEffect, useRef, useState } from 'react';
import WebMap from '@arcgis/core/WebMap';
import MapView from '@arcgis/core/views/MapView';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import * as route from '@arcgis/core/rest/route';
import RouteParameters from '@arcgis/core/rest/support/RouteParameters';
import FeatureSet from '@arcgis/core/rest/support/FeatureSet';
import Point from '@arcgis/core/geometry/Point';
import * as symbolUtils from '@arcgis/core/symbols/support/symbolUtils'; 
import BasemapGallery from '@arcgis/core/widgets/BasemapGallery'; // 🚀 استيراد الـ Basemap
import '@arcgis/core/assets/esri/themes/dark/main.css';

interface MapViewer2DProps {
  onSwitchTo3D: () => void;
  isLayersOpen: boolean; 
  isBasemapOpen: boolean; // 🚀 استقبال الـ Prop الجديدة
}

const MapViewer2D: React.FC<MapViewer2DProps> = ({ onSwitchTo3D, isLayersOpen, isBasemapOpen }) => {
  const mapDiv = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const basemapDiv = useRef<HTMLDivElement>(null); // 🚀 Ref لحاوية الـ Basemap
  
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, text: '' });
  const [routeInfo, setRouteInfo] = useState({ visible: false, x: 0, y: 0, time: '', distance: '' });
  const routeMidpointRef = useRef<Point | null>(null);

  const [layerIcons, setLayerIcons] = useState<Record<string, string>>({});

  const [activeFilters, setActiveFilters] = useState({
    Health: true,
    Education: true,
    Retails: true,
    Landmarks: true
  });

  const routeUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";

  useEffect(() => {
    let view: MapView;
    let compoundGeometry: Point | null = null;
    const routeLayer = new GraphicsLayer();

    const initializeMap = async () => {
      if (mapDiv.current) {
        const webmap = new WebMap({
          portalItem: { id: "d6691af8b99c4e7aa6ff080c448924ad" }
        });

        view = new MapView({
          container: mapDiv.current,
          map: webmap,
          popup: {
            dockEnabled: false,
            alignment: "top-right",
            visibleElements: { closeButton: true }
          }
        });

        view.map?.add(routeLayer);
        view.ui.remove(["zoom", "compass"]);

        await view.when();

        // 🚀 تهيئة الـ BasemapGallery للـ 2D
        if (basemapDiv.current) {
          new BasemapGallery({
            view: view,
            container: basemapDiv.current
          });
        }

        if (view && view.map) {
          view.map.layers.forEach(async (layer) => {
            if (layer.type === "feature") {
              const featureLayer = layer as FeatureLayer;
              featureLayer.outFields = ["*"];
              
              await featureLayer.load(); 
              
              if (featureLayer.title === "Compound") {
                const query = featureLayer.createQuery();
                query.where = "1=1";
                featureLayer.queryFeatures(query).then((result) => {
                  if (result.features.length > 0) {
                    const geom = result.features[0].geometry;
                    if (geom) {
                      compoundGeometry = geom.type === "polygon" ? (geom as any).centroid : (geom as Point);
                    }
                  }
                });
              } else {
                const renderer = featureLayer.renderer as any;
                if (renderer) {
                  let symbol = null;
                  if (renderer.type === "simple") {
                    symbol = renderer.symbol;
                  } else if (renderer.type === "unique-value") {
                    symbol = renderer.uniqueValueInfos?.[0]?.symbol || renderer.defaultSymbol;
                  }

                  if (symbol) {
                    try {
                      const htmlElement = await symbolUtils.renderPreviewHTML(symbol, { size: 18 });
                      
                      if (htmlElement) {
                        setLayerIcons(prev => ({ 
                          ...prev, 
                          [featureLayer.title as string]: htmlElement.outerHTML 
                        }));
                      }
                    } catch (error) {
                      console.error("Symbology extraction failed for:", featureLayer.title, error);
                    }
                  }
                }
              }
            }
          });
        }

        view.watch("extent", () => {
          if (routeMidpointRef.current && view) {
            const screenPt = view.toScreen(routeMidpointRef.current);
            if (screenPt) {
              setRouteInfo(prev => ({ ...prev, x: screenPt.x, y: screenPt.y }));
            }
          }
        });

        view.on("pointer-move", async (event) => {
          const response = await view.hitTest(event);
          const results = response.results.filter(r => r.type === "graphic" && (r as any).graphic?.layer?.type === "feature");

          if (results.length > 0) {
            const graphic = (results[0] as any).graphic;
            const layerTitle = graphic.layer?.title;
            const attrs = graphic.attributes;
            let name = layerTitle === "Compound" ? "El-Narges Compound" : (attrs?.name_en || attrs?.name || attrs?.name_ar || "Unnamed Service");
            
            setTooltip({ visible: true, x: event.x, y: event.y, text: name });
            document.body.style.cursor = "pointer"; 
          } else {
            setTooltip(prev => ({ ...prev, visible: false }));
            document.body.style.cursor = "default";
          }
        });

        view.on("click", async (event) => {
            const response = await view.hitTest(event);
            const results = response.results.filter(r => r.type === "graphic" && (r as any).graphic?.layer?.type === "feature");
  
            if (results.length > 0) {
              const graphic = (results[0] as any).graphic;
              const layerTitle = graphic.layer?.title;
  
              if (layerTitle === "Compound") {
                  onSwitchTo3D();
              } else if (compoundGeometry && graphic.geometry) {
                  calculateAndDrawRoute(compoundGeometry, graphic.geometry as Point);
              }
            } else {
               routeLayer.removeAll();
               setRouteInfo(prev => ({ ...prev, visible: false }));
               routeMidpointRef.current = null;
            }
          });

        viewRef.current = view;
      }
    };

    const calculateAndDrawRoute = async (startGeom: Point, endGeom: Point) => {
      routeLayer.removeAll(); 
      setRouteInfo(prev => ({ ...prev, visible: false }));

      const routeParams = new RouteParameters({
        stops: new FeatureSet({
          features: [
            new Graphic({ geometry: startGeom }),
            new Graphic({ geometry: endGeom })
          ]
        }),
        returnDirections: true, 
        outSpatialReference: viewRef.current?.spatialReference
      });

      try {
        const data = await route.solve(routeUrl, routeParams);
        const routeResult = data.routeResults && data.routeResults.length > 0 ? data.routeResults[0].route : null;
        const directions = data.routeResults && data.routeResults.length > 0 ? data.routeResults[0].directions : null;

        if (routeResult) {
          const distance = routeResult.attributes?.Total_Kilometers?.toFixed(1) || "0";
          const routeTime = directions?.totalTime?.toFixed(0) || "0";

          const geometry = routeResult.geometry as any;
          if (geometry && geometry.paths && geometry.paths[0]) {
            const fullPath = geometry.paths[0];
            const totalVertices = fullPath.length;
            const animationDuration = 1000; 
            let startTime: number | null = null;

            const animatedGraphic = new Graphic({
              symbol: {
                type: "simple-line",
                color: [255, 255, 255, 0.9],
                width: 4
              } as any,
              geometry: {
                type: "polyline",
                paths: [[fullPath[0]]],
                spatialReference: viewRef.current?.spatialReference
              } as any
            });

            routeLayer.add(animatedGraphic);

            const midpointIndex = Math.floor(totalVertices / 2);
            const midpoint = geometry.getPoint(0, midpointIndex);
            routeMidpointRef.current = midpoint;

            const screenPt = viewRef.current?.toScreen(midpoint);

            const animateRoute = (currentTime: number) => {
              if (!startTime) startTime = currentTime;
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / animationDuration, 1);
              
              const targetVertex = Math.max(1, Math.floor(progress * totalVertices));
              const currentPath = fullPath.slice(0, targetVertex);
              
              animatedGraphic.geometry = {
                type: "polyline",
                paths: [currentPath],
                spatialReference: viewRef.current?.spatialReference
              } as any;

              if (progress < 1) {
                requestAnimationFrame(animateRoute);
              } else if (screenPt) {
                setRouteInfo({
                  visible: true,
                  x: screenPt.x,
                  y: screenPt.y,
                  distance: distance,
                  time: routeTime
                });
              }
            };

            requestAnimationFrame(animateRoute);
          }
        }

      } catch (error) {
        console.error("Routing Error: ", error);
      }
    };

    initializeMap();

    return () => {
      if (view) {
        view.destroy();
      }
      document.body.style.cursor = "default"; 
    };
  }, []); 

  const toggleFilter = (layerName: string) => {
    setActiveFilters((prev: any) => ({ ...prev, [layerName]: !prev[layerName] }));
    if (viewRef.current?.map) {
      const layer = viewRef.current.map.layers.find((l: any) => l.title === layerName);
      if (layer) {
        layer.visible = !activeFilters[layerName as keyof typeof activeFilters];
      }
    }
  };

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#0d1117' }}>
      
      {tooltip.visible && (
        <div style={{
          position: 'absolute', top: tooltip.y - 40, left: tooltip.x + 15,
          backgroundColor: 'rgba(0, 0, 0, 0.8)', color: '#fff', padding: '6px 12px',
          borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', pointerEvents: 'none', 
          zIndex: 9999, boxShadow: '0 4px 10px rgba(0,0,0,0.3)', whiteSpace: 'nowrap', direction: 'ltr' 
        }}>
          {tooltip.text}
        </div>
      )}

      {routeInfo.visible && (
        <div style={{
          position: 'absolute', top: routeInfo.y - 20, left: routeInfo.x + 15,
          backgroundColor: 'rgba(22, 27, 34, 0.95)', color: '#fff', padding: '8px 16px',
          borderRadius: '30px', fontSize: '14px', fontWeight: 'bold', pointerEvents: 'none', 
          zIndex: 9998, boxShadow: '0 6px 16px rgba(0,0,0,0.4)', border: '1px solid #30363d',
          display: 'flex', alignItems: 'center', gap: '8px', direction: 'ltr' 
        }}>
          <span>{routeInfo.distance} km | {routeInfo.time} mins</span>
          <span style={{ fontSize: '16px' }}>🚘</span>
        </div>
      )}

      {/* حاوية عرض الفلاتر والـ Basemap (مربوطة بـ right: 20px) */}
      <div style={{
        position: 'absolute',
        top: '80px', 
        right: '20px',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '10px'
      }}>
      
        <div style={{
          display: isLayersOpen ? 'block' : 'none',
          backgroundColor: '#161b22', color: '#c9d1d9', padding: '15px',
          borderRadius: '8px', border: '1px solid #30363d', minWidth: '220px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)', animation: 'fadeInDown 0.2s ease-out'
        }}>
          <h4 style={{ margin: '0 0 15px 0', textAlign: 'left', borderBottom: '1px solid #30363d', paddingBottom: '10px', fontSize: '14px' }}>
            🛠️ Filter Services
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', fontSize: '13px' }}>
            <label style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {layerIcons['Landmarks'] ? <span dangerouslySetInnerHTML={{ __html: layerIcons['Landmarks'] }} style={{ display: 'flex' }} /> : <span>🏛️</span>}
                Landmarks
              </span>
              <input type="checkbox" checked={activeFilters.Landmarks} onChange={() => toggleFilter('Landmarks')} />
            </label>
            <label style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {layerIcons['Retails'] ? <span dangerouslySetInnerHTML={{ __html: layerIcons['Retails'] }} style={{ display: 'flex' }} /> : <span>🛒</span>}
                Retails
              </span>
              <input type="checkbox" checked={activeFilters.Retails} onChange={() => toggleFilter('Retails')} />
            </label>
            <label style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {layerIcons['Education'] ? <span dangerouslySetInnerHTML={{ __html: layerIcons['Education'] }} style={{ display: 'flex' }} /> : <span>🎓</span>}
                Education
              </span>
              <input type="checkbox" checked={activeFilters.Education} onChange={() => toggleFilter('Education')} />
            </label>
            <label style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {layerIcons['Health'] ? <span dangerouslySetInnerHTML={{ __html: layerIcons['Health'] }} style={{ display: 'flex' }} /> : <span>🏥</span>}
                Health
              </span>
              <input type="checkbox" checked={activeFilters.Health} onChange={() => toggleFilter('Health')} />
            </label>
          </div>
        </div>

        {/* 🚀 حاوية عرض الـ BasemapGallery للـ 2D */}
        <div style={{ 
          display: isBasemapOpen ? 'block' : 'none',
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          width: '280px',
          maxHeight: '60vh',
          overflowY: 'auto',
          animation: 'fadeInDown 0.2s ease-out'
        }}>
          <div ref={basemapDiv} />
        </div>

      </div>

      <div ref={mapDiv} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}></div>
    </div>
  );
};

export default MapViewer2D;