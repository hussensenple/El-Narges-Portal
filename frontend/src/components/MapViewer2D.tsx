import React from 'react';

interface MapViewer2DProps {
  onSwitchTo3D: () => void;
  isLayersOpen: boolean; 
  isBasemapOpen: boolean; 
}

const MapViewer2D: React.FC<MapViewer2DProps> = () => {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
      <iframe 
        src="https://itigeoportal.maps.arcgis.com/apps/instant/nearby/index.html?appid=03827edb59d1439eb7967aeda6ee41d9&distance=40#find=3505231.26633725%2C3511487.9923560116" 
        style={{ width: '100%', height: '100%', border: 'none' }} 
        frameBorder="0"
        title="El-Narges Services Portal"
        allowFullScreen
      />
    </div>
  );
};

export default MapViewer2D;