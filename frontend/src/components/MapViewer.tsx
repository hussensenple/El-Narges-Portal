import { useEffect, useRef, useState } from 'react';
import WebScene from '@arcgis/core/WebScene';
import SceneView from '@arcgis/core/views/SceneView';
import LayerList from '@arcgis/core/widgets/LayerList'; 
import BasemapGallery from '@arcgis/core/widgets/BasemapGallery'; 
import '@arcgis/core/assets/esri/themes/dark/main.css';
import WeatherWidget from './WeatherWidget';

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
        qualityProfile: "high"
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

      </div>
    </div>
  );
};

export default MapViewer;