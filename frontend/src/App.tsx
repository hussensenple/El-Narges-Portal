import { useState, useContext, useCallback, useEffect, type ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import SceneView from '@arcgis/core/views/SceneView';
import MapViewer from './components/MapViewer';
import MapViewer2D from './components/MapViewer2D';
import OwnerUnitsTab from './components/OwnerUnitsTab'; 
import UnitCatalog from './components/UnitCatalog';
import AIAdvisor from './components/AIAdvisor';
import BrokerCatalog from './components/BrokerCatalog';
import AdminRequests from './pages/AdminRequests'; 
import ClosestServices from './components/ClosestServices'; 
import StopsRoutingWidget from './components/StopsRoutingWidget';
import { AuthContext } from './context/AuthContext'; 
import AuthModal from './components/AuthModal'; 
import BrokerDashboard from './components/BrokerDashboard';


const Icons = {
  Login: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>,
  Logout: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f85149" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Layers: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  Weather: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.34" y1="19.66" x2="5.76" y2="18.24"/><line x1="18.24" y1="5.76" x2="19.66" y2="4.32"/></svg>,
  GisTools: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  Map2D: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
  Map3D: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>,
  Basemap: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>,
  Catalog: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>,
  Home: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Fullscreen: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
};

const CustomerInterface = () => {
  const [mapView, setMapView] = useState<SceneView | null>(null);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isBrokerCatalogOpen, setIsBrokerCatalogOpen] = useState(false);
  const [isRoutingOpen, setIsRoutingOpen] = useState(false); 
  const [isStopsRoutingOpen, setIsStopsRoutingOpen] = useState(false); 
  const [showLoginModal, setShowLoginModal] = useState(false); 
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [isOwnerUnitsOpen, setIsOwnerUnitsOpen] = useState(false); 
  const [is3DView, setIs3DView] = useState(true);
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isWeatherOpen, setIsWeatherOpen] = useState(false);
  const [isBasemapOpen, setIsBasemapOpen] = useState(false); 

  const auth = useContext(AuthContext); 
  const isAuthenticated = !!auth?.user;
  const navigate = useNavigate();

  useEffect(() => {
    if (auth?.user) {
      if (auth.user.role === 'admin') navigate('/admin', { replace: true });
      if (auth.user.role === 'broker') navigate('/broker', { replace: true });
    }
  }, [auth?.user, navigate]);

  const handleSwitchTo3D = useCallback(() => setIs3DView(true), []);
  const handleViewReady = useCallback((view: SceneView) => setMapView(view), []);

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#0d1117' }}>
      
      <style>{`
        .map-icon-btn {
          width: 45px;
          height: 45px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
          backdrop-filter: blur(10px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        
        .map-icon-btn.inactive {
          background-color: rgba(55, 62, 71, 0.85); 
          color: #e6edf3;
          border: 1px solid #444c56;
        }
        
        .map-icon-btn.inactive:hover {
          background-color: rgba(75, 83, 93, 0.95);
          color: #ffffff;
          transform: scale(1.05);
        }
        
        .map-icon-btn.active {
          background-color: #1f6feb;
          color: #ffffff;
          border: 1px solid #1f6feb;
        }
        
        .map-icon-btn.active:hover {
          background-color: #388bfd;
          transform: scale(1.05);
        }
      `}</style>

      <div style={{ display: is3DView ? 'block' : 'none', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
        <MapViewer 
          onViewReady={handleViewReady} 
          isLayersOpen={isLayersOpen}
          isWeatherOpen={isWeatherOpen}
          setIsWeatherOpen={setIsWeatherOpen}
          isBasemapOpen={isBasemapOpen} 
        />
      </div>

      <div style={{ display: !is3DView ? 'block' : 'none', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
        <MapViewer2D 
          isLayersOpen={isLayersOpen} 
          isBasemapOpen={isBasemapOpen} 
          onSwitchTo3D={handleSwitchTo3D} 
        />
      </div>

      {/* Fullscreen - glued to bottom-right above Esri bar */}
      <button 
        title="Fullscreen" 
        onClick={handleFullscreen} 
        className="map-icon-btn inactive"
        style={{ position: 'absolute', bottom: '26px', right: '0px', zIndex: 1000, width: '28px', height: '28px', padding: '4px', borderRadius: '4px 0 0 4px' }}
      >
        <Icons.Fullscreen />
      </button>

      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 1000, display: 'flex', flexDirection: 'row', gap: '10px', alignItems: 'center' }}>
        
        {/* My Units Button */}
        {auth?.user?.role === 'owner' && (
          <button 
            title="My Units" 
            onClick={() => setIsOwnerUnitsOpen(!isOwnerUnitsOpen)} 
            className={`map-icon-btn ${isOwnerUnitsOpen ? 'active' : 'inactive'}`}
          >
            <Icons.Home />
          </button>
        )}

        {/* Last one on the left (user's "أخر واحد") */}
        {auth?.user && (
          <span style={{ fontSize: '13px', color: '#fff', backgroundColor: 'rgba(22,27,34,0.85)', padding: '12px 16px', borderRadius: '10px', border: '1px solid #30363d', fontFamily: 'sans-serif', backdropFilter: 'blur(10px)' }}>
            Welcome, <strong style={{ color: '#4493f8' }}>{auth.user.name}</strong>
          </span>
        )}

        {/* Customer / Owner Tools (Weather, Layers, Basemap) */}
        {isAuthenticated && auth?.user?.role !== 'broker' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {is3DView && (
              <button title="Weather" onClick={() => { setIsWeatherOpen(!isWeatherOpen); setIsLayersOpen(false); setIsBasemapOpen(false); }} className={`map-icon-btn ${isWeatherOpen ? 'active' : 'inactive'}`}>
                <Icons.Weather />
              </button>
            )}
            <button title="Layers" onClick={() => { setIsLayersOpen(!isLayersOpen); setIsBasemapOpen(false); setIsWeatherOpen(false); }} className={`map-icon-btn ${isLayersOpen ? 'active' : 'inactive'}`}>
              <Icons.Layers />
            </button>
            <button title="Basemap Gallery" onClick={() => { setIsBasemapOpen(!isBasemapOpen); setIsLayersOpen(false); setIsWeatherOpen(false); }} className={`map-icon-btn ${isBasemapOpen ? 'active' : 'inactive'}`}>
              <Icons.Basemap />
            </button>
          </div>
        )}

        {/* First one on the right (user's "أول واحدة على اليمين") */}
        {auth?.user ? (
          <button title="Logout" onClick={() => auth.logout?.()} className="map-icon-btn inactive">
            <Icons.Logout />
          </button>
        ) : (
          <button title="Login" onClick={() => setShowLoginModal(true)} className={`map-icon-btn ${showLoginModal ? 'active' : 'inactive'}`}>
            <Icons.Login />
          </button>
        )}
      </div>

      <div style={{ position: 'absolute', top: '20px', left: '70px', zIndex: 1000, display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        
        <button title={is3DView ? "Switch to 2D Map" : "Switch to 3D Map"} onClick={() => setIs3DView(!is3DView)} className="map-icon-btn inactive">
          {is3DView ? <Icons.Map2D /> : <Icons.Map3D />}
        </button>

        {is3DView && isAuthenticated && auth?.user?.role !== 'broker' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
            <button title="GIS Tools" onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)} className={`map-icon-btn ${isToolsMenuOpen ? 'active' : 'inactive'}`}>
              <Icons.GisTools />
            </button>

            {isToolsMenuOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'rgba(22, 27, 34, 0.9)', backdropFilter: 'blur(10px)', padding: '10px', borderRadius: '12px', border: '1px solid #444c56', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', width: '200px' }}>
                <button 
                  onClick={() => { setIsRoutingOpen(!isRoutingOpen); setIsStopsRoutingOpen(false); }} 
                  style={{ padding: '10px', borderRadius: '6px', cursor: 'pointer', background: isRoutingOpen ? '#1f6feb' : 'transparent', color: isRoutingOpen ? '#fff' : '#c9d1d9', border: '1px solid #444c56', fontSize: '13px', fontWeight: 'bold', transition: 'all 0.2s ease', textAlign: 'left' }}
                >
                  {isRoutingOpen ? '✖ Close Services' : '📍 Closest Services'}
                </button>
                <button 
                  onClick={() => { setIsStopsRoutingOpen(!isStopsRoutingOpen); setIsRoutingOpen(false); }} 
                  style={{ padding: '10px', borderRadius: '6px', cursor: 'pointer', background: isStopsRoutingOpen ? '#1f6feb' : 'transparent', color: isStopsRoutingOpen ? '#fff' : '#c9d1d9', border: '1px solid #444c56', fontSize: '13px', fontWeight: 'bold', transition: 'all 0.2s ease', textAlign: 'left' }}
                >
                  {isStopsRoutingOpen ? '✖ Close Routing' : '🗺️ Multi-Stop Route'}
                </button>
              </div>
            )}

            {(isRoutingOpen || isStopsRoutingOpen) && (
              <div style={{ width: '300px', marginTop: '10px' }}>
                {isRoutingOpen && <ClosestServices view={mapView} />}
                {isStopsRoutingOpen && <StopsRoutingWidget view={mapView} />}
              </div>
            )}
          </div>
        )}
      </div>

      {showLoginModal && <AuthModal onClose={() => setShowLoginModal(false)} onSuccess={() => setShowLoginModal(false)} />}

      {is3DView && isAuthenticated && auth?.user?.role !== 'broker' && (
        <button 
          title="Property Catalog"
          onClick={() => {
            if (auth?.user?.role === 'broker') {
              setIsBrokerCatalogOpen(!isBrokerCatalogOpen);
            } else {
              setIsCatalogOpen(!isCatalogOpen);
            }
          }} 
          className={`map-icon-btn ${isCatalogOpen || isBrokerCatalogOpen ? 'active' : 'inactive'}`}
          style={{ position: 'absolute', bottom: '30px', left: '20px', zIndex: 1000 }}
        >
          <Icons.Catalog />
        </button>
      )}

      {isCatalogOpen && is3DView && isAuthenticated && auth?.user?.role !== 'broker' && (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999 }} onClick={() => setIsCatalogOpen(false)} />
          <UnitCatalog view={mapView} onClose={() => setIsCatalogOpen(false)} />
        </>
      )}

      {isBrokerCatalogOpen && is3DView && auth?.user?.role === 'broker' && (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999 }} onClick={() => setIsBrokerCatalogOpen(false)} />
          <BrokerCatalog view={mapView} onClose={() => setIsBrokerCatalogOpen(false)} />
        </>
      )}

      {isOwnerUnitsOpen && auth?.user?.role === 'owner' && (
        <OwnerUnitsTab onClose={() => setIsOwnerUnitsOpen(false)} view={mapView} />
      )}

      {is3DView && isAuthenticated && auth?.user?.role !== 'broker' && <AIAdvisor view={mapView} />}
    </div>
  );
};

const ProtectedRoute = ({ children, allowedRoles }: { children: ReactNode, allowedRoles: string[] }) => {
  const auth = useContext(AuthContext);
  
  if (!auth?.user) {
    return <Navigate to="/" replace />;
  }
  
  if (!allowedRoles.includes(auth.user.role)) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<CustomerInterface />} />
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminRequests /></ProtectedRoute>} />
        <Route path="/broker" element={<ProtectedRoute allowedRoles={['broker']}><BrokerDashboard /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;