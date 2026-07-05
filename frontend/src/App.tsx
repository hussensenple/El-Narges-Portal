import { useState, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SceneView from '@arcgis/core/views/SceneView';
import MapViewer from './components/MapViewer';
import UnitCatalog from './components/UnitCatalog';
import AIAdvisor from './components/AIAdvisor';
import AdminRequests from './pages/AdminRequests'; 
import ClosestServices from './components/ClosestServices'; 
import StopsRoutingWidget from './components/StopsRoutingWidget';
import { AuthContext } from './context/AuthContext'; 
import AuthModal from './components/AuthModal'; 

const CustomerInterface = () => {
  const [mapView, setMapView] = useState<SceneView | null>(null);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isRoutingOpen, setIsRoutingOpen] = useState(false); 
  const [isStopsRoutingOpen, setIsStopsRoutingOpen] = useState(false); 
  const [showLoginModal, setShowLoginModal] = useState(false); 
  
  // حالة جديدة للتحكم في القائمة المنسدلة للأدوات
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);

  const auth = useContext(AuthContext); 

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      <style>{`
        .nav-btn {
          background-color: #161b22; 
          color: #c9d1d9;
          border: 1px solid #30363d;
          transition: all 0.3s ease;
        }
        .nav-btn:hover {
          background-color: #1f6feb; 
          color: #ffffff;
          border-color: #1f6feb;
          transform: translateY(-2px);
        }
        .nav-btn.active {
          background-color: #da3633; 
          color: #ffffff;
          border-color: #da3633;
        }
        .nav-btn.active:hover {
          background-color: #b32d2a;
          transform: translateY(-2px);
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <MapViewer onViewReady={(view) => setMapView(view)} />

      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        backgroundColor: 'rgba(22, 27, 34, 0.85)',
        backdropFilter: 'blur(10px)',
        padding: '10px 20px',
        borderRadius: '8px',
        border: '1px solid #30363d',
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        color: '#fff',
        fontFamily: 'sans-serif'
      }}>
        {auth?.user ? (
          <>
            <span style={{ fontSize: '14px' }}>مرحباً، <strong style={{ color: '#4493f8' }}>{auth.user.name}</strong></span>
            <button 
              onClick={() => { if(auth.logout) auth.logout(); }}
              style={{
                backgroundColor: 'transparent', border: '1px solid #f85149', color: '#f85149',
                padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
              }}
            >
              🔓 Logout
            </button>
          </>
        ) : (
          <button 
            onClick={() => setShowLoginModal(true)}
            style={{
              backgroundColor: '#238636', color: '#fff', border: 'none',
              padding: '6px 15px', borderRadius: '5px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'
            }}
          >
            🔐 Login / Register
          </button>
        )}
      </div>

      {showLoginModal && (
        <AuthModal onClose={() => setShowLoginModal(false)} onSuccess={() => setShowLoginModal(false)} />
      )}

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

      {isCatalogOpen && (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999 }} onClick={() => setIsCatalogOpen(false)} />
          <UnitCatalog view={mapView} onClose={() => setIsCatalogOpen(false)} />
        </>
      )}

      <AIAdvisor view={mapView} />

      {/* 🚀 حاوية أدوات التحليل (Toolbox) - تصميم زجاجي أنيق */}
      <div style={{ 
        position: 'absolute', 
        top: '15px', 
        left: '70px', 
        zIndex: 11, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '10px' 
      }}>
        
        {/* الزر الرئيسي لفتح/غلق القائمة */}
        <button 
          onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
          style={{
            backgroundColor: 'rgba(22, 27, 34, 0.85)', backdropFilter: 'blur(10px)',
            color: '#c9d1d9', border: '1px solid #30363d', padding: '10px 16px', 
            borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', 
            justifyContent: 'space-between', width: '220px', transition: 'all 0.3s ease'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>🛠️ GIS Tools</span>
          <span>{isToolsMenuOpen ? '▲' : '▼'}</span>
        </button>

        {/* القائمة المنسدلة */}
        {isToolsMenuOpen && (
          <div style={{ 
            display: 'flex', flexDirection: 'column', gap: '8px', 
            backgroundColor: 'rgba(22, 27, 34, 0.85)', backdropFilter: 'blur(10px)',
            padding: '12px', borderRadius: '8px', border: '1px solid #30363d', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', width: '194px',
            animation: 'fadeInDown 0.2s ease-out'
          }}>
            <button 
              className={`nav-btn ${isRoutingOpen ? 'active' : ''}`}
              onClick={() => { setIsRoutingOpen(!isRoutingOpen); setIsStopsRoutingOpen(false); }}
              style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #30363d' }}
            >
              {isRoutingOpen ? '✖ Close Services' : '📍 Closest Services'}
            </button>

            <button 
              className={`nav-btn ${isStopsRoutingOpen ? 'active' : ''}`}
              onClick={() => { setIsStopsRoutingOpen(!isStopsRoutingOpen); setIsRoutingOpen(false); }}
              style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #30363d' }}
            >
              {isStopsRoutingOpen ? '✖ Close Routing' : '🗺️ Multi-Stop Route'}
            </button>
          </div>
        )}

        {/* منطقة عرض الـ Widgets */}
        {(isRoutingOpen || isStopsRoutingOpen) && (
          <div style={{ animation: 'fadeInDown 0.2s ease-out', marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {isRoutingOpen && <ClosestServices view={mapView} />}
            {isStopsRoutingOpen && <StopsRoutingWidget view={mapView} />}
          </div>
        )}
      </div>

    </div>
  );
};

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