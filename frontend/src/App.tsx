import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SceneView from '@arcgis/core/views/SceneView';
import MapViewer from './components/MapViewer';
import UnitCatalog from './components/UnitCatalog';
import AIAdvisor from './components/AIAdvisor';
import AdminRequests from './pages/AdminRequests'; 
import RoutingWidget from './components/RoutingWidget'; 
import StopsRoutingWidget from './components/StopsRoutingWidget';

// 🏠 مكون واجهة العميل (Customer View)
const CustomerInterface = () => {
  const [mapView, setMapView] = useState<SceneView | null>(null);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isRoutingOpen, setIsRoutingOpen] = useState(false); 
  const [isStopsRoutingOpen, setIsStopsRoutingOpen] = useState(false); 

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* 🎨 CSS Styles للزراير عشان نعمل الـ Hover Effect بشياكة */}
      <style>{`
        .nav-btn {
          background-color: #161b22; /* دارك زي زرار الطقس */
          color: #c9d1d9;
          border: 1px solid #30363d;
          transition: all 0.3s ease;
        }
        .nav-btn:hover {
          background-color: #1f6feb; /* أزرق في الـ Hover */
          color: #ffffff;
          border-color: #1f6feb;
          transform: translateY(-2px);
        }
        .nav-btn.active {
          background-color: #da3633; /* أحمر لو الأداة مفتوحة */
          color: #ffffff;
          border-color: #da3633;
        }
        .nav-btn.active:hover {
          background-color: #b32d2a;
          transform: translateY(-2px);
        }
      `}</style>

      {/* 1. الخريطة في الخلفية */}
      <MapViewer onViewReady={(view) => setMapView(view)} />

      {/* 2. الزرار العايم لفتح الكتالوج (تحت على الشمال) */}
      <button 
        className={`nav-btn ${isCatalogOpen ? 'active' : ''}`}
        onClick={() => setIsCatalogOpen(true)}
        style={{
          position: 'absolute', bottom: '30px', left: '30px', zIndex: 10,
          padding: '12px 24px', borderRadius: '30px', fontSize: '16px',
          fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', gap: '8px'
        }}
      >
        🏢 Property Catalog
      </button>

      {/* 3. النافذة المنبثقة للكتالوج */}
      {isCatalogOpen && (
        <>
          <div 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999 }}
            onClick={() => setIsCatalogOpen(false)} 
          />
          <UnitCatalog view={mapView} onClose={() => setIsCatalogOpen(false)} />
        </>
      )}

      {/* 4. الـ AI Advisor (تحت على اليمين) */}
      <AIAdvisor view={mapView} />

      {/* 🚀 5. حاوية أدوات التحليل والتوجيه (فوق على الشمال جنب الـ Zoom) */}
      <div style={{ 
        position: 'absolute', 
        top: '15px', 
        left: '70px', 
        zIndex: 11, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px' 
      }}>
        
        {/* صف الأزرار */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {/* زر أقرب الخدمات */}
          <button 
            className={`nav-btn ${isRoutingOpen ? 'active' : ''}`}
            onClick={() => {
              setIsRoutingOpen(!isRoutingOpen);
              setIsStopsRoutingOpen(false); 
            }}
            style={{
              padding: '10px 16px', borderRadius: '8px', 
              fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            {isRoutingOpen ? '✖ Close Services' : '📍 Closest Services'}
          </button>

          {/* زر المسارات المتعددة */}
          <button 
            className={`nav-btn ${isStopsRoutingOpen ? 'active' : ''}`}
            onClick={() => {
              setIsStopsRoutingOpen(!isStopsRoutingOpen);
              setIsRoutingOpen(false); 
            }}
            style={{
              padding: '10px 16px', borderRadius: '8px', 
              fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            {isStopsRoutingOpen ? '✖ Close Routing' : '🗺️ Multi-Stop Route'}
          </button>
        </div>

        {/* منطقة عرض الـ Widgets (هتفتح تحت الزراير مباشرة) */}
        {isRoutingOpen && (
          <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <RoutingWidget view={mapView} />
          </div>
        )}

        {isStopsRoutingOpen && (
          <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <StopsRoutingWidget view={mapView} />
          </div>
        )}
      </div>

    </div>
  );
};

// 🚀 المكون الأساسي للتطبيق مع نظام التوجيه
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<CustomerInterface />} />
        <Route path="/admin" element={<AdminRequests />} />
      </Routes>
    </Router>
  );
}

export default App;