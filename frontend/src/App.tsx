import { useState, useEffect, useContext, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SceneView from '@arcgis/core/views/SceneView';
import MapViewer from './components/MapViewer';
import MapViewer2D from './components/MapViewer2D';
import WalkthroughTour from './components/WalkthroughTour';
import OwnerUnitsTab from './components/OwnerUnitsTab'; 
import UnitCatalog from './components/UnitCatalog';
import AIAdvisor from './components/AIAdvisor';
import BrokerCatalog from './components/BrokerCatalog';
import AdminRequests from './pages/AdminRequests'; 
import ClosestServices from './components/ClosestServices'; 
import StopsRoutingWidget from './components/StopsRoutingWidget';
import { AuthContext } from './context/AuthContext'; 
import AuthModal from './components/AuthModal'; 
import UserRequestsModal from './components/UserRequestsModal';
import AccountSettingsModal from './components/AccountSettingsModal';
import BrokerPerformanceModal from './components/admin/modals/BrokerPerformanceModal';
import EngineerPortalModal from './components/EngineerPortalModal';
import ActiveTasksModal from './components/ActiveTasksModal';
import ShowAllIssuesButton from './components/ShowAllIssuesButton';
import TechniciansModal from './components/TechniciansModal';
import UtilityNetworkModal from './components/UtilityNetworkModal';
import ChatbotWidget from './components/ChatbotWidget';
import UNDashboardModal from './components/UNDashboardModal';
import LogoIcon from './components/LogoIcon';
import ThemeToggle from './components/ThemeToggle';


const Icons = {
  Login: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>,
  Logout: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Layers: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  Weather: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.34" y1="19.66" x2="5.76" y2="18.24"/><line x1="18.24" y1="5.76" x2="19.66" y2="4.32"/></svg>,
  GisTools: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  Map2D: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
  Map3D: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>,
  Basemap: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>,
  Catalog: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>,
  Home: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Fullscreen: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>,
  Requests: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  Settings: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Performance: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><rect x="3" y="2" width="18" height="20" rx="2" ry="2" fill="none"/></svg>,
  Technicians: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
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
  type MapMode = '3D' | '2D' | 'UN';
  const [mapMode, setMapMode] = useState<MapMode>('3D');
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isWeatherOpen, setIsWeatherOpen] = useState(false);
  const [isBasemapOpen, setIsBasemapOpen] = useState(false); 
  const [isUserRequestsOpen, setIsUserRequestsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPerformanceOpen, setIsPerformanceOpen] = useState(false);
  const [isEngineerPortalOpen, setIsEngineerPortalOpen] = useState(false);
  const [isActiveTasksOpen, setIsActiveTasksOpen] = useState(false);
  const [isTechniciansModalOpen, setIsTechniciansModalOpen] = useState(false);
  const [isUNDashboardModalOpen, setIsUNDashboardModalOpen] = useState(false);

  const [unComplaintCoordinates, setUnComplaintCoordinates] = useState<{lat: number, lon: number} | null>(null);

  const auth = useContext(AuthContext); 
  const isAuthenticated = !!auth?.user;

  // Walkthrough Tour State & Trigger Logic
  const [activeTourRole, setActiveTourRole] = useState<'visitor' | 'user' | 'owner' | null>(null);

  useEffect(() => {
    // Small delay to ensure ESRI Map features & DOM are rendered
    const timer = setTimeout(() => {
      if (!isAuthenticated) {
        const seenVisitor = localStorage.getItem('tour_seen_visitor');
        if (!seenVisitor) setActiveTourRole('visitor');
      } else {
        const role = auth?.user?.role;
        if (role === 'user') {
          const seenUser = localStorage.getItem('tour_seen_user');
          if (!seenUser) setActiveTourRole('user');
        } else if (role === 'owner') {
          const seenOwner = localStorage.getItem('tour_seen_owner');
          if (!seenOwner) setActiveTourRole('owner');
        }
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, auth?.user?.role]);

  const handleSwitchTo3D = useCallback(() => setMapMode('3D'), []);
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
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--bg-primary)' }}>
      
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
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .map-icon-btn.inactive {
          background-color: var(--bg-tertiary);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
        }
        
        .map-icon-btn.inactive:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
          transform: scale(1.05);
        }
        
        .map-icon-btn.active {
          background-color: var(--accent-blue-bg);
          color: var(--text-primary);
          border: 1px solid var(--accent-blue);
        }
        
        .map-icon-btn.active:hover {
          background-color: var(--accent-blue);
          transform: scale(1.05);
        }
      `}</style>

      <div style={{ display: mapMode === '3D' ? 'block' : 'none', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
        <MapViewer 
          onViewReady={handleViewReady} 
          isLayersOpen={isLayersOpen}
          isWeatherOpen={isWeatherOpen}
          setIsWeatherOpen={setIsWeatherOpen}
          isBasemapOpen={isBasemapOpen} 
          onOpenUNModal={(coords) => {
            setUnComplaintCoordinates(coords);
            setMapMode('UN');
          }}
        />
      </div>

      <div style={{ display: mapMode === '2D' ? 'block' : 'none', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
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
        
        {/* Manual Tour Restart / Guidance Help Button (Top Right next to other actions) */}
        {mapMode === '3D' && auth?.user?.role !== 'broker' && auth?.user?.role !== 'engineer' && (
          <button
            onClick={() => {
              if (!isAuthenticated) setActiveTourRole('visitor');
              else if (auth?.user?.role === 'user') setActiveTourRole('user');
              else if (auth?.user?.role === 'owner') setActiveTourRole('owner');
            }}
            className="map-icon-btn inactive"
            title="Show Guide"
          >
            📖
          </button>
        )}

        {/* My Units Button */}
        {auth?.user?.role === 'owner' && (
          <button 
            id="tour-owner-units-btn"
            title="My Units" 
            onClick={() => setIsOwnerUnitsOpen(!isOwnerUnitsOpen)} 
            className={`map-icon-btn ${isOwnerUnitsOpen ? 'active' : 'inactive'}`}
          >
            <Icons.Home />
          </button>
        )}

        {/* My Requests Button for Users */}
        {auth?.user?.role === 'user' && (
          <button 
            id="tour-requests-btn"
            title="My Requests" 
            onClick={() => setIsUserRequestsOpen(!isUserRequestsOpen)} 
            className={`map-icon-btn ${isUserRequestsOpen ? 'active' : 'inactive'}`}
          >
            <Icons.Requests />
          </button>
        )}

        {/* Performance Dashboard Button for Brokers */}
        {auth?.user?.role === 'broker' && (
          <button
            title="My Performance Dashboard"
            onClick={() => setIsPerformanceOpen(!isPerformanceOpen)}
            className={`map-icon-btn ${isPerformanceOpen ? 'active' : 'inactive'}`}
            style={{ color: isPerformanceOpen ? 'var(--text-primary)' : '#8957e5', borderColor: '#8957e5' }}
          >
            <Icons.Performance />
          </button>
        )}

        {/* The remaining engineering widgets will be moved to bottom left */}

        {/* Last one on the left (user's "أخر واحد") */}
        {auth?.user && (
          <span style={{ fontSize: '13px', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', fontFamily: 'sans-serif', backdropFilter: 'blur(10px)' }}>
            Welcome, <strong style={{ color: '#4493f8' }}>{auth.user.name}</strong>
          </span>
        )}

        {/* Customer / Owner Tools (Weather, Layers, Basemap) */}
        {isAuthenticated && auth?.user?.role !== 'broker' && (
          <div id="tour-customer-tools" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {mapMode === '3D' && (
              <button title="Weather" onClick={() => { setIsWeatherOpen(!isWeatherOpen); setIsLayersOpen(false); setIsBasemapOpen(false); }} className={`map-icon-btn ${isWeatherOpen ? 'active' : 'inactive'}`}>
                <Icons.Weather />
              </button>
            )}
            {mapMode !== 'UN' && (
              <button title="Layers" onClick={() => { setIsLayersOpen(!isLayersOpen); setIsBasemapOpen(false); setIsWeatherOpen(false); }} className={`map-icon-btn ${isLayersOpen ? 'active' : 'inactive'}`}>
                <Icons.Layers />
              </button>
            )}
            <button title="Basemap Gallery" onClick={() => { setIsBasemapOpen(!isBasemapOpen); setIsLayersOpen(false); setIsWeatherOpen(false); }} className={`map-icon-btn ${isBasemapOpen ? 'active' : 'inactive'}`}>
              <Icons.Basemap />
            </button>
          </div>
        )}

        {/* First one on the right (user's "أول واحدة على اليمين") */}
        {auth?.user ? (
          <div style={{ display: 'flex', gap: '10px' }}>
            {(auth.user.role === 'user' || auth.user.role === 'owner') && (
              <button id="tour-settings-btn" title="Account Settings" onClick={() => setIsSettingsOpen(true)} className={`map-icon-btn ${isSettingsOpen ? 'active' : 'inactive'}`}>
                <Icons.Settings />
              </button>
            )}
            <button title="Logout" onClick={() => { auth.logout?.(); setMapMode('3D'); }} className="map-icon-btn inactive">
              <Icons.Logout />
            </button>
          </div>
        ) : (
          <button id="tour-login-btn" title="Login" onClick={() => setShowLoginModal(true)} className={`map-icon-btn ${showLoginModal ? 'active' : 'inactive'}`}>
            <Icons.Login />
          </button>
        )}
      </div>


      <div style={{ position: 'absolute', top: '20px', left: '70px', zIndex: 1000, display: 'flex', gap: '15px', alignItems: 'center' }}>
        
        {/* App Logo */}
        <div style={{ padding: '6px 12px', backgroundColor: 'var(--bg-secondary)', backdropFilter: 'blur(10px)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center' }}>
          <LogoIcon width={32} height={32} showText={false} />
        </div>
        
        <button id="tour-map-toggle" title={mapMode === '3D' ? "Switch to 2D Map" : "Switch to 3D Map"} onClick={() => setMapMode(mapMode === '3D' ? '2D' : '3D')} className="map-icon-btn inactive">
          {mapMode === '3D' ? <Icons.Map2D /> : <Icons.Map3D />}
        </button>

        {/* Dashboard Button (Engineer) - Left of UN button, only in UN mode */}
        {auth?.user?.role === 'engineer' && mapMode === 'UN' && (
          <button 
            title="Open ArcGIS Dashboard"
            onClick={() => setIsUNDashboardModalOpen(true)} 
            className="map-icon-btn active"
            style={{ backgroundColor: 'var(--accent-green-bg)', color: 'var(--text-primary)', borderColor: 'var(--accent-green-bg)', width: 'auto', padding: '0 12px', fontSize: '12px', fontWeight: 'bold' }}
          >
            📊 Dashboard
          </button>
        )}

        {/* Utility Network Button (Engineer) - MOVED HERE */}
        {auth?.user?.role === 'engineer' && (
          <button
            title="Utility Network"
            onClick={() => setMapMode(mapMode === 'UN' ? '3D' : 'UN')}
            className={`map-icon-btn ${mapMode === 'UN' ? 'active' : 'inactive'}`}
            style={{ color: mapMode === 'UN' ? 'var(--text-primary)' : '#8957e5', borderColor: mapMode === 'UN' ? '#8957e5' : '#444c56' }}
          >
            ⚡
          </button>
        )}

        {mapMode === '3D' && isAuthenticated && auth?.user?.role !== 'broker' && auth?.user?.role !== 'engineer' && (
          <div id="tour-gis-tools" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <button title="GIS Tools" onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)} className={`map-icon-btn ${isToolsMenuOpen ? 'active' : 'inactive'}`}>
              <Icons.GisTools />
            </button>

            {(isToolsMenuOpen || isRoutingOpen || isStopsRoutingOpen) && (
              <div style={{ position: 'absolute', top: 'calc(100% + 10px)', left: '0', display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '10px', zIndex: 10 }}>
                {isToolsMenuOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'rgba(22, 27, 34, 0.9)', backdropFilter: 'blur(10px)', padding: '10px', borderRadius: '12px', border: '1px solid #444c56', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', width: '200px' }}>
                    <button 
                      onClick={() => { setIsRoutingOpen(!isRoutingOpen); setIsStopsRoutingOpen(false); }} 
                      style={{ padding: '10px', borderRadius: '6px', cursor: 'pointer', background: isRoutingOpen ? 'var(--accent-blue-bg)' : 'transparent', color: isRoutingOpen ? 'var(--text-primary)' : 'var(--text-secondary)', border: '1px solid #444c56', fontSize: '13px', fontWeight: 'bold', transition: 'all 0.2s ease', textAlign: 'left' }}
                    >
                      {isRoutingOpen ? '✖ Close Services' : '📍 Closest Services'}
                    </button>
                    <button 
                      onClick={() => { setIsStopsRoutingOpen(!isStopsRoutingOpen); setIsRoutingOpen(false); }} 
                      style={{ padding: '10px', borderRadius: '6px', cursor: 'pointer', background: isStopsRoutingOpen ? 'var(--accent-blue-bg)' : 'transparent', color: isStopsRoutingOpen ? 'var(--text-primary)' : 'var(--text-secondary)', border: '1px solid #444c56', fontSize: '13px', fontWeight: 'bold', transition: 'all 0.2s ease', textAlign: 'left' }}
                    >
                      {isStopsRoutingOpen ? '✖ Close Routing' : '🗺️ Multi-Stop Route'}
                    </button>
                  </div>
                )}

                {(isRoutingOpen || isStopsRoutingOpen) && (
                  <div style={{ width: '300px' }}>
                    {isRoutingOpen && <ClosestServices view={mapView} />}
                    {isStopsRoutingOpen && <StopsRoutingWidget view={mapView} />}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <ThemeToggle />
      </div>

      {showLoginModal && <AuthModal onClose={() => setShowLoginModal(false)} onSuccess={() => setShowLoginModal(false)} />}

      {mapMode === '3D' && isAuthenticated && auth?.user?.role !== 'engineer' && (
        <button 
          id="tour-catalog-btn"
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

      {isCatalogOpen && mapMode === '3D' && isAuthenticated && auth?.user?.role !== 'broker' && auth?.user?.role !== 'engineer' && (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999 }} onClick={() => setIsCatalogOpen(false)} />
          <UnitCatalog view={mapView} onClose={() => setIsCatalogOpen(false)} />
        </>
      )}

      {isBrokerCatalogOpen && mapMode === '3D' && auth?.user?.role === 'broker' && (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999 }} onClick={() => setIsBrokerCatalogOpen(false)} />
          <BrokerCatalog view={mapView} onClose={() => setIsBrokerCatalogOpen(false)} />
        </>
      )}

      {isOwnerUnitsOpen && auth?.user?.role === 'owner' && (
        <OwnerUnitsTab onClose={() => setIsOwnerUnitsOpen(false)} view={mapView} />
      )}

      {isUserRequestsOpen && auth?.user?.role === 'user' && (
        <UserRequestsModal onClose={() => setIsUserRequestsOpen(false)} view={mapView} />
      )}

      {isSettingsOpen && auth?.user && (auth.user.role === 'user' || auth.user.role === 'owner') && (
        <AccountSettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}

      {isPerformanceOpen && auth?.user?.role === 'broker' && (
        <BrokerPerformanceModal
          broker={{ _id: auth.user.id, name: auth.user.name }}
          onClose={() => setIsPerformanceOpen(false)}
        />
      )}

      {isEngineerPortalOpen && auth?.user?.role === 'engineer' && (
        <EngineerPortalModal 
          view={mapView} 
          onClose={() => setIsEngineerPortalOpen(false)} 
          onOpenUNModal={(coords: {lat: number, lon: number}) => {
            setUnComplaintCoordinates(coords);
            setMapMode('UN');
          }}
        />
      )}

      {isActiveTasksOpen && auth?.user?.role === 'engineer' && (
        <ActiveTasksModal 
          view={mapView} 
          onClose={() => setIsActiveTasksOpen(false)} 
          onOpenUNModal={(coords: {lat: number, lon: number}) => {
            setUnComplaintCoordinates(coords);
            setMapMode('UN');
          }}
        />
      )}

      {isTechniciansModalOpen && (
        <TechniciansModal onClose={() => setIsTechniciansModalOpen(false)} />
      )}

      {isUNDashboardModalOpen && (
        <UNDashboardModal onClose={() => setIsUNDashboardModalOpen(false)} />
      )}

      <div style={{ display: mapMode === 'UN' ? 'block' : 'none', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: mapMode === 'UN' ? 100 : -1 }}>
        <UtilityNetworkModal 
          key={auth?.user ? auth.user.id : 'guest'}
          complaintCoordinates={unComplaintCoordinates}
        />
      </div>

      {mapMode === '3D' && isAuthenticated && auth?.user?.role !== 'broker' && auth?.user?.role !== 'engineer' && (
        <AIAdvisor view={mapView} />
      )}
      {/* Customer Support Chatbot UI */}
      {auth?.user?.role === 'engineer' && <ChatbotWidget />}

      {/* Engineer Portal Widgets (Bottom Left) */}
      <div style={{ position: 'absolute', bottom: '40px', left: '20px', zIndex: 1000, display: 'flex', gap: '10px', alignItems: 'center' }}>
        {/* Engineer Portal Button */}
        {auth?.user?.role === 'engineer' && (
          <button
            title="New Complaints"
            onClick={() => setIsEngineerPortalOpen(!isEngineerPortalOpen)}
            className={`map-icon-btn ${isEngineerPortalOpen ? 'active' : 'inactive'}`}
            style={{ color: isEngineerPortalOpen ? 'var(--text-primary)' : '#e34c26', borderColor: '#e34c26' }}
          >
            <Icons.Requests />
          </button>
        )}

        {/* Active Tasks Button (Engineer) */}
        {auth?.user?.role === 'engineer' && (
          <button
            title="Active Tasks"
            onClick={() => setIsActiveTasksOpen(!isActiveTasksOpen)}
            className={`map-icon-btn ${isActiveTasksOpen ? 'active' : 'inactive'}`}
            style={{ color: isActiveTasksOpen ? 'var(--text-primary)' : 'var(--accent-gold)', borderColor: 'var(--accent-gold)' }}
          >
            <Icons.Requests />
          </button>
        )}

        {/* Manage Technicians Button (Engineer) */}
        {auth?.user?.role === 'engineer' && (
          <button
            title="Manage Technicians"
            onClick={() => setIsTechniciansModalOpen(!isTechniciansModalOpen)}
            className={`map-icon-btn ${isTechniciansModalOpen ? 'active' : 'inactive'}`}
            style={{ color: isTechniciansModalOpen ? 'var(--text-primary)' : 'var(--accent-blue-bg)', borderColor: 'var(--accent-blue-bg)' }}
          >
            <Icons.Technicians />
          </button>
        )}

        {/* Show All Issues Map Button (Engineer & Admin) */}
        {(auth?.user?.role === 'engineer' || auth?.user?.role === 'admin') && mapView && (
          <ShowAllIssuesButton view={mapView} />
        )}
      </div>

      {/* Walkthrough Guide Overlay */}
      {activeTourRole && (
        <WalkthroughTour role={activeTourRole} userName={auth?.user?.name} onClose={() => setActiveTourRole(null)} />
      )}


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