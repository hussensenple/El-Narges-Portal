import { useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import LogoIcon from './LogoIcon';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import Search from '@arcgis/core/widgets/Search';
import Locate from '@arcgis/core/widgets/Locate';

interface AuthModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AuthModal = ({ onClose, onSuccess }: AuthModalProps) => {
  const auth = useContext(AuthContext);
  const [isLogin, setIsLogin] = useState(true); 
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState(''); 
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [showMap, setShowMap] = useState<boolean>(false);
  const mapDiv = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLogin && showMap && mapDiv.current) {
      const map = new Map({
        basemap: "satellite"
      });

      const view = new MapView({
        container: mapDiv.current,
        map: map,
        center: [30.8025, 26.8206], // Egypt center
        zoom: 4,
        ui: {
          components: ["zoom"] // minimal UI
        }
      });

      const searchWidget = new Search({
        view: view,
        popupEnabled: false
      });
      view.ui.add(searchWidget, "top-right");

      const locateWidget = new Locate({
        view: view
      });
      view.ui.add(locateWidget, "top-left");

      searchWidget.on("select-result", (event) => {
        const result = event.result;
        if (result && result.feature) {
          const pt = result.feature.geometry as any;
          setLat(pt.latitude);
          setLon(pt.longitude);
          
          view.graphics.removeAll();
          const markerSymbol: any = { type: "simple-marker", color: [226, 119, 40], outline: { color: [255, 255, 255], width: 2 } };
          const pointGraphic = new Graphic({ geometry: pt, symbol: markerSymbol });
          view.graphics.add(pointGraphic);
          
          setTimeout(() => setShowMap(false), 500);
        }
      });

      if (lat && lon) {
        const point = new Point({ longitude: lon, latitude: lat });
        const markerSymbol: any = { type: "simple-marker", color: [226, 119, 40], outline: { color: [255, 255, 255], width: 2 } };
        const pointGraphic = new Graphic({ geometry: point, symbol: markerSymbol });
        view.graphics.add(pointGraphic);
      }

      view.on("click", (event) => {
        const clickedLat = event.mapPoint.latitude;
        const clickedLon = event.mapPoint.longitude;
        setLat(clickedLat);
        setLon(clickedLon);

        view.graphics.removeAll();
        const point = new Point({ longitude: clickedLon, latitude: clickedLat });
        const markerSymbol: any = { type: "simple-marker", color: [226, 119, 40], outline: { color: [255, 255, 255], width: 2 } };
        const pointGraphic = new Graphic({ geometry: point, symbol: markerSymbol });
        view.graphics.add(pointGraphic);

        setTimeout(() => setShowMap(false), 500);
      });

      return () => {
        if (view) {
          view.destroy();
        }
      };
    }
  }, [isLogin, showMap, lat, lon]);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Updated state to track validation including phone
  const [validity, setValidity] = useState({
    name: null as boolean | null,
    email: null as boolean | null,
    phone: null as boolean | null,
    password: null as boolean | null
  });

  // Strict Validation Logic (Regex)
  const handleValidation = (field: string, value: string) => {
    if (field === 'name') {
      setName(value);
      // English letters and spaces only (3 to 50 characters)
      setValidity(prev => ({ ...prev, name: /^[a-zA-Z\s]{3,50}$/.test(value) }));
    } else if (field === 'email') {
      setEmail(value);
      // Strict Gmail validation
      setValidity(prev => ({ ...prev, email: /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(value) }));
    } else if (field === 'phone') {
      setPhone(value);
      // Egyptian mobile numbers only (11 digits, starts with 010, 011, 012, or 015)
      setValidity(prev => ({ ...prev, phone: /^01[0125][0-9]{8}$/.test(value) }));
    } else if (field === 'password') {
      setPassword(value);
      // Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character
      setValidity(prev => ({ ...prev, password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(value) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload = isLogin ? { phone, password } : { name, email, phone, password, lat, lon };
      
      const res = await axios.post(`${import.meta.env.VITE_API_URL}${endpoint}`, payload);

      // 🚀 حفظ التوكن وبيانات العميل في الـ Context (واللي بدوره بيحفظها في المتصفح)
      if (auth) {
        auth.login(res.data.user, res.data.token);
      }

      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.msg || "Connection error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const getBorderStyle = (isValid: boolean | null) => {
    if (isValid === null) return '1px solid var(--border-color)';
    return isValid ? '1px solid var(--accent-green)' : '1px solid var(--accent-red)';
  };

  const isFormValid = isLogin ? true : (validity.name && validity.email && validity.phone && validity.password && lat !== null);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }}>
      <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border-color)', width: '350px', color: 'var(--text-secondary)', fontFamily: 'sans-serif' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '25px', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: -10, right: -10, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '22px', cursor: 'pointer' }}>✖</button>
          <LogoIcon width={65} height={65} style={{ filter: 'drop-shadow(0px 8px 16px rgba(0,0,0,0.4))', marginBottom: '15px' }} />
          <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>{isLogin ? '🔐 Login' : '📝 Register'}</h2>
        </div>

        {error && <div style={{ backgroundColor: '#ff818233', color: '#ff7b72', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '13px', border: '1px solid #ff7b7255' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {!isLogin && (
            <>
              <div>
                <input type="text" placeholder="Full Name" value={name} onChange={e => handleValidation('name', e.target.value)} required style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '6px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: getBorderStyle(validity.name), outline: 'none' }} />
                {validity.name === false && <span style={{ color: '#ff7b72', fontSize: '11px', display: 'block', marginTop: '4px' }}>Only letters and spaces (3-50 chars).</span>}
              </div>

              <div>
                <input type="email" placeholder="Email (@gmail.com)" value={email} onChange={e => handleValidation('email', e.target.value)} required style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '6px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: getBorderStyle(validity.email), outline: 'none' }} />
                {validity.email === false && <span style={{ color: '#ff7b72', fontSize: '11px', display: 'block', marginTop: '4px' }}>Must be a valid @gmail.com address.</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '13px', marginBottom: '5px', color: 'var(--text-primary)' }}>📍 Select your location:</label>
                <span style={{ fontSize: '11px', color: 'var(--accent-gold)', marginBottom: '8px' }}>⚠️ Please select your actual residence location, not your current device location.</span>
                
                {!showMap ? (
                  <button type="button" onClick={() => setShowMap(true)} style={{ padding: '12px', backgroundColor: lat ? 'var(--accent-green)' : 'var(--bg-primary)', color: lat ? '#000' : 'var(--text-primary)', border: lat ? 'none' : '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {lat ? '✅ Location Selected (Change)' : '📍 Pick Location on Map'}
                  </button>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <div ref={mapDiv} style={{ width: '100%', height: '180px', borderRadius: '6px', border: '1px solid var(--accent-blue)', overflow: 'hidden' }}></div>
                    <button type="button" onClick={() => setShowMap(false)} style={{ position: 'absolute', top: '5px', right: '5px', padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Close</button>
                  </div>
                )}
                {lat === null && !showMap && <span style={{ color: '#ff7b72', fontSize: '11px', display: 'block', marginTop: '4px' }}>Please set your location.</span>}
              </div>
            </>
          )}

          <div>
            <input type="tel" placeholder="Phone Number (e.g., 010...)" value={phone} onChange={e => handleValidation('phone', e.target.value)} required style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '6px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: !isLogin ? getBorderStyle(validity.phone) : '1px solid var(--border-color)', outline: 'none' }} />
            {!isLogin && validity.phone === false && <span style={{ color: '#ff7b72', fontSize: '11px', display: 'block', marginTop: '4px' }}>Must be a valid 11-digit mobile number.</span>}
          </div>
          
          <div style={{ position: 'relative' }}>
            <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => handleValidation('password', e.target.value)} required style={{ width: '100%', boxSizing: 'border-box', padding: '12px', paddingRight: '40px', borderRadius: '6px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: !isLogin ? getBorderStyle(validity.password) : '1px solid var(--border-color)', outline: 'none' }} />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '12px', top: validity.password === false && !isLogin ? '22px' : '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </button>
            {!isLogin && validity.password === false && <span style={{ color: '#ff7b72', fontSize: '11px', display: 'block', marginTop: '4px' }}>Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special (@$!%*?&).</span>}
          </div>

          <button type="submit" disabled={isLoading || !isFormValid} style={{ padding: '12px', backgroundColor: isFormValid ? 'var(--accent-blue-bg)' : '#444c56', color: isFormValid ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: (isLoading || !isFormValid) ? 'not-allowed' : 'pointer', marginTop: '10px', transition: '0.3s' }}>
            {isLoading ? 'Loading...' : (isLogin ? 'Login' : 'Create Account')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span onClick={() => { setIsLogin(!isLogin); setError(''); setValidity({name: null, email: null, phone: null, password: null}); }} style={{ color: 'var(--accent-blue)', cursor: 'pointer', fontWeight: 'bold' }}>
            {isLogin ? 'Register here' : 'Login here'}
          </span>
        </div>

      </div>
    </div>
  );
};

export default AuthModal;