import { useEffect, useRef, useState } from 'react';
import WebScene from '@arcgis/core/WebScene';
import SceneView from '@arcgis/core/views/SceneView';
import LayerList from '@arcgis/core/widgets/LayerList'; // 👈 استيراد أداة الطبقات
import '@arcgis/core/assets/esri/themes/dark/main.css';
import WeatherWidget from './WeatherWidget';

interface MapViewerProps {
  onViewReady: (view: SceneView) => void;
}

const MapViewer = ({ onViewReady }: MapViewerProps) => {
  const mapDiv = useRef<HTMLDivElement>(null);
  const layerListDiv = useRef<HTMLDivElement>(null); // 👈 ريفيرانس لحاوية أداة الطبقات

  const [viewInstance, setViewInstance] = useState<SceneView | null>(null);
  const [isWeatherOpen, setIsWeatherOpen] = useState(false);
  const [isLayersOpen, setIsLayersOpen] = useState(false); // 👈 حالة زر الطبقات

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
        // 🚀 إنشاء قائمة الطبقات وربطها بالـ div الخاص بنا
        if (layerListDiv.current) {
          new LayerList({
            view: view,
            container: layerListDiv.current,
            listItemCreatedFunction: (event) => {
              const item = event.item;
              if (item.title === "Units") {
                item.visible = false; // إخفاء جدول الوحدات لأنه بدون شكل هندسي
              }
            }
          });
        }

        setViewInstance(view); 
        onViewReady(view);
      });

      return () => {
        if (view) view.destroy();
      };
    }
  }, []); // ✅ المصفوفة فارغة لمنع إعادة التحميل اللانهائي

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      
      {/* 🗺️ حاوية الخريطة الأصلية */}
      <div ref={mapDiv} style={{ height: '100%', width: '100%' }} />

      {/* 🚀 حاوية الأزرار والويجتس */}
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
        
        {/* 🎛️ صف الأزرار (يضم زر الطبقات وزر الطقس) */}
        <div style={{ display: 'flex', gap: '10px' }}>
          
          {/* 📚 زرار قائمة الطبقات */}
          <button 
            onClick={() => {
              setIsLayersOpen(!isLayersOpen);
              if (isWeatherOpen) setIsWeatherOpen(false); // نقفل الطقس لو مفتوح عشان الشاشة متزحمش
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: isLayersOpen ? '#1f6feb' : '#161b22',
              color: '#fff',
              border: '1px solid #30363d',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            📚 Layers
          </button>

          {/* 🌤️ زرار الطقس */}
          <button 
            onClick={() => {
              setIsWeatherOpen(!isWeatherOpen);
              if (isLayersOpen) setIsLayersOpen(false); // نقفل الطبقات لو مفتوحة
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: isWeatherOpen ? '#1f6feb' : '#161b22',
              color: '#fff',
              border: '1px solid #30363d',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            🌤️ Weather
          </button>
        </div>

        {/* 🚀 حاوية عرض ويجت الطبقات */}
        {/* استخدمنا display none بدل الـ conditional rendering عشان الـ DOM بتاع الويجت ميتدمرش */}
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

        {/* 🚀 ويجت الطقس */}
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