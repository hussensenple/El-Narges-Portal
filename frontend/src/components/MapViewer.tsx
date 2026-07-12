import { useEffect, useRef, useState, useContext } from 'react';

import WebScene from '@arcgis/core/WebScene';
import SceneView from '@arcgis/core/views/SceneView';
import LayerList from '@arcgis/core/widgets/LayerList'; 
import BasemapGallery from '@arcgis/core/widgets/BasemapGallery'; 
import '@arcgis/core/assets/esri/themes/dark/main.css';
import WeatherWidget from './WeatherWidget';
import BuildingSidebar from './BuildingSidebar';
import { AuthContext } from '../context/AuthContext';
import esriConfig from "@arcgis/core/config";

esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY || "AAPTalXA9GcZ5lZfym8hKak90bg..wGOn5mTNFbEDgQTSt91zZ3JRiK5hffTjYdmL1ERTSPKglXpsx21W9RNlgzgoJF0Jz2FSdRc_kgkQKBh7X5t02_GyVncvhTB8KHXfFs1UpjrO_P_Si65XTQXNm5Ad_12WXsc1fjlDCgbbBvTDxYSAA495unWWkWQI47Y_XAhMLQaVT-wFHLzecsgMw-jJNUuxC1NWVSjSgp6-dtfQswbqkkwKXrGQ6asF2YrQ9PLmQhL_98RwBQ..AT1_e4bvhm43";

interface MapViewerProps {
  onViewReady: (view: SceneView) => void;
  isLayersOpen: boolean;
  isWeatherOpen: boolean;
  setIsWeatherOpen: (isOpen: boolean) => void;
  isBasemapOpen: boolean; 
}

const MapViewer = ({ onViewReady, isLayersOpen, isWeatherOpen, setIsWeatherOpen, isBasemapOpen }: MapViewerProps) => {
  const mapDiv = useRef<HTMLDivElement>(null);
  const layerListDiv = useRef<HTMLDivElement>(null); 
  const basemapDiv = useRef<HTMLDivElement>(null); 

  const [viewInstance, setViewInstance] = useState<SceneView | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedVillaData, setSelectedVillaData] = useState<any | null>(null);

  const auth = useContext(AuthContext);
  const canSeeSidebar = auth?.user && (auth.user.role === 'user' || auth.user.role === 'owner');

  useEffect(() => {
    if (mapDiv.current) {
      const webscene = new WebScene({
        portalItem: {
          id: "fd0297b6f0034d63a58d42c7ffef11e3"
        }
      });

      const view = new SceneView({
        container: mapDiv.current,
        map: webscene,
        qualityProfile: "low",
        environment: {
          lighting: {
            type: "virtual"
          }
        },
        popup: {
          autoOpenEnabled: false
        } as any
      });

      view.when(() => {
        if (layerListDiv.current) {
          new LayerList({
            view: view,
            container: layerListDiv.current,
            listItemCreatedFunction: (event) => {
              const item = event.item;
              if (item.title === "Units") {
                item.visible = false; 
              }
            }
          });
        }

        // Base URL for images
        const baseUrl = window.location.origin;

        // Customizing Popups
        view.map.layers.forEach((layer: any) => {
          if (layer.title === "Villas_Global") {
            layer.popupTemplate = {
              title: "🌟 {BuildingType} Details",
              content: `
                <div style="font-family: 'Inter', sans-serif; padding: 5px;">
                  <div style="background: linear-gradient(135deg, #1f2937, #111827); border-radius: 12px; padding: 20px; text-align: center; border: 1px solid #374151; margin-bottom: 15px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);">
                    <h2 style="margin: 0; color: #fff; font-size: 22px; font-weight: 700; letter-spacing: 1px;">{BuildingType}</h2>
                    <p style="margin: 5px 0 0 0; color: #9ca3af; font-size: 13px;">Model <strong style="color: #60a5fa; font-size: 14px;">{VillaModel}</strong></p>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; background: #1f2937; padding: 15px; border-radius: 10px; margin-bottom: 15px; border-left: 4px solid {expression/status_color}; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);">
                    <div>
                      <span style="display: block; color: #8b949e; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Status</span>
                      <strong style="color: {expression/status_color}; font-size: 14px; padding: 4px 8px; background: rgba(0,0,0,0.2); border-radius: 6px;">{expression/status_text}</strong>
                    </div>
                    <div style="text-align: right;">
                      <span style="display: block; color: #8b949e; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Price</span>
                      <strong style="color: #3fb950; font-size: 15px;">{expression/price_in_m} M EGY</strong>
                    </div>
                  </div>

                  <a href="{expression/villa_image}" target="_blank" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; background: linear-gradient(to right, #2563eb, #1d4ed8); color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.4);">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    View Full Design
                  </a>
                  <div style="display: none;">{GlobalID}{globalid}</div>
                </div>
              `,
              actions: [],
              expressionInfos: [
                {
                  name: "price_in_m",
                  title: "Price in M",
                  expression: "Text($feature.Price / 1000000, '#.00')"
                },
                {
                  name: "villa_image",
                  title: "Villa Image",
                  expression: `var img = $feature.Image_Name; if (!IsEmpty(img)) { return '${baseUrl}/' + Replace(img, '.png', '') + '.png'; } else { return '${baseUrl}/' + $feature.VillaModel + '.png'; }`
                },
                {
                  name: "status_color",
                  title: "Status Color",
                  expression: "var v = $feature.Status; if (TypeOf(v) == 'Number') { if (v == 1) { return '#3fb950'; } else if (v == 4 || v == 3 || v == 2) { return '#f85149'; } else { return '#d29922'; } } else { var s = Lower(Trim(Text(v))); if (s == 'available' || s == '1') { return '#3fb950'; } else if (s == 'sold' || s == 'reserved' || s == '4' || s == '3' || s == '2') { return '#f85149'; } else { return '#d29922'; } }"
                },
                {
                  name: "status_text",
                  title: "Status Text",
                  expression: "var v = $feature.Status; if (TypeOf(v) == 'Number') { if (v == 1) { return 'Available'; } else if (v == 4 || v == 3 || v == 2) { return 'Sold / Reserved'; } else { return 'Unknown'; } } else { var s = Lower(Trim(Text(v))); if (s == 'available' || s == '1') { return 'Available'; } else if (s == 'sold' || s == 'reserved' || s == '4' || s == '3' || s == '2') { return 'Sold / Reserved'; } else { return 'Unknown'; } }"
                }
              ]
            };
          } else if (layer.title === "Buildings_Global" || layer.title === "Buildings") {
            layer.popupTemplate = {
              title: "Building Details",
              content: `
                <div style="font-family: 'Inter', sans-serif; padding: 0;">
                  <a href="{expression/building_image}" target="_blank" style="display: block; padding: 12px; margin-bottom: 15px; text-align: center; background: #21262d; color: #58a6ff; text-decoration: none; font-size: 14px; border-radius: 8px; border: 1px solid #30363d; font-weight: bold;">🔍 View Design</a>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
                    <div style="background: rgba(22, 27, 34, 0.8); padding: 8px; border-radius: 6px; border: 1px solid #30363d;">
                      <span style="color: #8b949e; display: block; font-size: 10px; text-transform: uppercase;">Status</span>
                      <strong style="color: {expression/status_color};">{expression/status_text}</strong>
                    </div>
                    <div style="background: rgba(22, 27, 34, 0.8); padding: 8px; border-radius: 6px; border: 1px solid #30363d;">
                      <span style="color: #8b949e; display: block; font-size: 10px; text-transform: uppercase;">Floors</span>
                      <strong style="color: #e6edf3;">{FloorsCount}</strong>
                    </div>
                    <div style="background: rgba(22, 27, 34, 0.8); padding: 8px; border-radius: 6px; border: 1px solid #30363d; grid-column: span 2;">
                      <span style="color: #8b949e; display: block; font-size: 10px; text-transform: uppercase;">Model</span>
                      <strong style="color: #e6edf3;">{BuildingModel}</strong>
                    </div>
                  </div>
                  <div style="margin-top: 15px; padding: 8px; background: rgba(31, 111, 235, 0.1); border: 1px solid rgba(31, 111, 235, 0.3); border-radius: 6px; color: #58a6ff; font-size: 11px; text-align: center;">
                    <em>💡 Sidebar opened with apartment details.</em>
                  </div>
                  <div style="display: none;">{GlobalID}{globalid}</div>
                </div>
              `,
              expressionInfos: [
                {
                  name: "building_image",
                  title: "Building Image",
                  expression: `var m = $feature.BuildingModel; if (Find('S', m) > -1 || Find('s', m) > -1) { return '${baseUrl}/S.png'; } else if (Find('U', m) > -1 || Find('u', m) > -1) { return '${baseUrl}/U.png'; } else if (Find('X', m) > -1 || Find('x', m) > -1) { return '${baseUrl}/X.png'; } else if (Find('Z', m) > -1 || Find('z', m) > -1) { return '${baseUrl}/Z.png'; } else { return '${baseUrl}/S.png'; }`
                },
                {
                  name: "status_color",
                  title: "Status Color",
                  expression: "var v = $feature.Status; if (TypeOf(v) == 'Number') { if (v == 1) { return '#3fb950'; } else if (v == 4 || v == 3 || v == 2) { return '#f85149'; } else { return '#d29922'; } } else { var s = Lower(Trim(Text(v))); if (s == 'available' || s == '1') { return '#3fb950'; } else if (s == 'sold' || s == 'reserved' || s == '4' || s == '3' || s == '2') { return '#f85149'; } else { return '#d29922'; } }"
                },
                {
                  name: "status_text",
                  title: "Status Text",
                  expression: "var v = $feature.Status; if (TypeOf(v) == 'Number') { if (v == 1) { return 'Available'; } else if (v == 4 || v == 3 || v == 2) { return 'Sold / Reserved'; } else { return 'Unknown'; } } else { var s = Lower(Trim(Text(v))); if (s == 'available' || s == '1') { return 'Available'; } else if (s == 'sold' || s == 'reserved' || s == '4' || s == '3' || s == '2') { return 'Sold / Reserved'; } else { return 'Unknown'; } }"
                }
              ]
            };
          }
        });

        // Listen for clicks to open sidebar (Buildings + Villas — no popup)
        view.on("click", async (event) => {
          try {
            const response = await view.hitTest(event);

            // Check villa click first
            const villaResult = response.results.find((res: any) =>
              res.graphic && res.graphic.layer &&
              res.graphic.layer.title === "Villas_Global"
            );
            if (villaResult) {
              const graphic = (villaResult as any).graphic;
              const layer = graphic.layer;
              const query = layer.createQuery();
              query.objectIds = [graphic.attributes.OBJECTID];
              query.outFields = ['*'];
              const result = await layer.queryFeatures(query);
              if (result.features.length > 0) {
                const attrs = result.features[0].attributes;
                setSelectedVillaData(attrs);
                setSelectedBuildingId(null);
              }
              return;
            }

            // Check building click
            const buildingResult = response.results.find((res: any) =>
              res.graphic && res.graphic.layer &&
              (res.graphic.layer.title === "Buildings_Global" || res.graphic.layer.title === "Buildings")
            );
            if (buildingResult) {
              const graphic = (buildingResult as any).graphic;
              const objectId = graphic.attributes.OBJECTID;
              const layer = graphic.layer;
              const query = layer.createQuery();
              query.objectIds = [objectId];
              query.outFields = ["GlobalID", "globalid"];
              const result = await layer.queryFeatures(query);
              if (result.features.length > 0) {
                const globalId = result.features[0].attributes.GlobalID || result.features[0].attributes.globalid;
                setSelectedBuildingId(globalId || null);
                setSelectedVillaData(null);
              }
            } else {
              setSelectedBuildingId(null);
              setSelectedVillaData(null);
            }
          } catch (err) {
            console.error("hitTest or query error", err);
          }
        });

        if (basemapDiv.current) {
          new BasemapGallery({
            view: view,
            container: basemapDiv.current
          });
        }

        setViewInstance(view); 
        onViewReady(view);
      });

      return () => {
        if (view) view.destroy();
      };
    }
  }, []); 

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      
      <div ref={mapDiv} style={{ height: '100%', width: '100%' }} />

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
          <div ref={layerListDiv} />
        </div>

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

        {isWeatherOpen && (
          <div style={{ animation: 'fadeInDown 0.2s ease-out' }}>
            <WeatherWidget 
              view={viewInstance} 
              onClose={() => setIsWeatherOpen(false)} 
            />
          </div>
        )}

        <style>{`
          .esri-popup { display: none !important; }
        `}</style>
      </div>
      
      {/* Sidebar: Building mode */}
      {canSeeSidebar && selectedBuildingId && (
        <BuildingSidebar 
          buildingId={selectedBuildingId}
          onClose={() => setSelectedBuildingId(null)}
        />
      )}

      {/* Sidebar: Villa mode */}
      {canSeeSidebar && selectedVillaData && (
        <BuildingSidebar
          villaData={selectedVillaData}
          onClose={() => setSelectedVillaData(null)}
        />
      )}
    </div>
  );
};

export default MapViewer;