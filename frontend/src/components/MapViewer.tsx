import { useEffect, useRef, useState } from 'react';
import WebScene from '@arcgis/core/WebScene';
import SceneView from '@arcgis/core/views/SceneView';
import '@arcgis/core/assets/esri/themes/dark/main.css';
import WeatherWidget from './WeatherWidget'; // 👈 استدعاء ويجت الطقس

interface MapViewerProps {
  onViewReady: (view: SceneView) => void;
}

const MapViewer = ({ onViewReady }: MapViewerProps) => {
  const mapDiv = useRef<HTMLDivElement>(null);
  
  // 🚀 1. State لحفظ نسخة الخريطة عشان نبعتها للويجت
  const [viewInstance, setViewInstance] = useState<SceneView | null>(null);
  
  // 🚀 2. State للتحكم في فتح وقفل الطقس
  const [isWeatherOpen, setIsWeatherOpen] = useState(false);

  useEffect(() => {
    if (mapDiv.current) {
      const webscene = new WebScene({
        portalItem: {
          id: "b30e279e0f59437fa4260de77f0f919f" // ⚠️ الـ ID بتاعك زي ما هو
        }
      });

      const view = new SceneView({
        container: mapDiv.current,
        map: webscene,
        qualityProfile: "high"
      });

      view.when(() => {
        setViewInstance(view); // 👈 حفظ الخريطة بعد ما تحمل
        onViewReady(view);
      });

      return () => {
        if (view) view.destroy();
      };
    }
  }, []);

  return (
    // 🚀 عملنا Wrapper Relative عشان الزراير تعوم فوق الخريطة
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      
      {/* 🗺️ حاوية الخريطة الأصلية */}
      <div ref={mapDiv} style={{ height: '100%', width: '100%' }} />

      {/* 🌤️ زرار فتح الطقس (عائم فوق الخريطة) */}
      <button 
        onClick={() => setIsWeatherOpen(true)}
        style={{
          position: 'absolute',
          top: '20px',   // 👈 تقدر تغير مكانه (مثلا تخليه bottom)
          right: '20px', // 👈 تقدر تخليه left لو الزراير التانية هناك
          padding: '12px 20px',
          backgroundColor: '#161b22', // لون متناسق مع الدارك مود
          color: '#58a6ff',
          border: '1px solid #30363d',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
          boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1f6feb'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#161b22'}
      >
        🌤️ Weather
      </button>

      {/* 🚀 ويجت الطقس (بيظهر بس لما تدوس على الزرار) */}
      {isWeatherOpen && (
        <WeatherWidget 
          view={viewInstance} 
          onClose={() => setIsWeatherOpen(false)} 
        />
      )}
      
    </div>
  );
};

export default MapViewer;