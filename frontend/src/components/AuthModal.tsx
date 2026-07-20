import { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

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
  
  const [countryStatus, setCountryStatus] = useState('Egypt');
  const [governorate, setGovernorate] = useState('');
  const [governoratesList, setGovernoratesList] = useState<string[]>([]);

  useEffect(() => {
    const fetchGovernorates = async () => {
      try {
        const url = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Heatmap_WFL1/FeatureServer/0/query';
        const res = await axios.get(url, {
          params: {
            where: '1=1',
            outFields: '*',
            returnGeometry: false,
            f: 'json'
          }
        });
        if (res.data && res.data.features && res.data.features.length > 0) {
          const fields = Object.keys(res.data.features[0].attributes);
          const nameField = fields.find(f => f.toLowerCase().includes('name') || f.toLowerCase().includes('gov') || f.toLowerCase().includes('ar')) || fields.find(f => typeof res.data.features[0].attributes[f] === 'string');
          const govs = [...new Set(res.data.features.map((f: any) => nameField ? f.attributes[nameField] : undefined))].filter(Boolean) as string[];
          setGovernoratesList(govs);
          if (govs.length > 0) setGovernorate(govs[0]);
        } else {
          throw new Error('Secured layer or no data');
        }
      } catch (err) {
        console.warn('Falling back to static governorates list due to AGOL security/error');
        const fallbackGovs = ['Cairo', 'Giza', 'Alexandria', 'Dakahlia', 'Red Sea', 'Beheira', 'Fayoum', 'Gharbia', 'Ismailia', 'Menofia', 'Minya', 'Qaliubiya', 'New Valley', 'Suez', 'Aswan', 'Assiut', 'Beni Suef', 'Port Said', 'Damietta', 'Sharkia', 'South Sinai', 'Kafr Al sheikh', 'Matrouh', 'Luxor', 'Qena', 'North Sinai', 'Sohag'];
        setGovernoratesList(fallbackGovs);
        setGovernorate(fallbackGovs[0]);
      }
    };
    fetchGovernorates();
  }, []);

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
      const payload = isLogin ? { phone, password } : { name, email, phone, password, countryStatus, governorate: countryStatus === 'Egypt' ? governorate : '' };
      
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
    if (isValid === null) return '1px solid #30363d';
    return isValid ? '1px solid #2ea043' : '1px solid #f85149';
  };

  const isFormValid = isLogin ? true : (validity.name && validity.email && validity.phone && validity.password);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }}>
      <div style={{ backgroundColor: '#161b22', padding: '30px', borderRadius: '12px', border: '1px solid #30363d', width: '350px', color: '#c9d1d9', fontFamily: 'sans-serif' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#fff' }}>{isLogin ? '🔐 Login' : '📝 Register'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: '20px', cursor: 'pointer' }}>✖</button>
        </div>

        {error && <div style={{ backgroundColor: '#ff818233', color: '#ff7b72', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '13px', border: '1px solid #ff7b7255' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {!isLogin && (
            <>
              <div>
                <input type="text" placeholder="Full Name" value={name} onChange={e => handleValidation('name', e.target.value)} required style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '6px', backgroundColor: '#0d1117', color: '#fff', border: getBorderStyle(validity.name), outline: 'none' }} />
                {validity.name === false && <span style={{ color: '#ff7b72', fontSize: '11px', display: 'block', marginTop: '4px' }}>Only letters and spaces (3-50 chars).</span>}
              </div>

              <div>
                <input type="email" placeholder="Email (@gmail.com)" value={email} onChange={e => handleValidation('email', e.target.value)} required style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '6px', backgroundColor: '#0d1117', color: '#fff', border: getBorderStyle(validity.email), outline: 'none' }} />
                {validity.email === false && <span style={{ color: '#ff7b72', fontSize: '11px', display: 'block', marginTop: '4px' }}>Must be a valid @gmail.com address.</span>}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select value={countryStatus} onChange={(e) => setCountryStatus(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '6px', backgroundColor: '#0d1117', color: '#fff', border: '1px solid #30363d', outline: 'none' }}>
                  <option value="Egypt">Inside Egypt</option>
                  <option value="Outside Egypt">Outside Egypt</option>
                </select>

                {countryStatus === 'Egypt' && (
                  <select value={governorate} onChange={(e) => setGovernorate(e.target.value)} required style={{ flex: 1, padding: '12px', borderRadius: '6px', backgroundColor: '#0d1117', color: '#fff', border: '1px solid #30363d', outline: 'none' }}>
                    {governoratesList.map(gov => (
                      <option key={gov} value={gov}>{gov}</option>
                    ))}
                  </select>
                )}
              </div>
            </>
          )}

          <div>
            <input type="tel" placeholder="Phone Number (e.g., 010...)" value={phone} onChange={e => handleValidation('phone', e.target.value)} required style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '6px', backgroundColor: '#0d1117', color: '#fff', border: !isLogin ? getBorderStyle(validity.phone) : '1px solid #30363d', outline: 'none' }} />
            {!isLogin && validity.phone === false && <span style={{ color: '#ff7b72', fontSize: '11px', display: 'block', marginTop: '4px' }}>Must be a valid 11-digit mobile number.</span>}
          </div>
          
          <div>
            <input type="password" placeholder="Password" value={password} onChange={e => handleValidation('password', e.target.value)} required style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '6px', backgroundColor: '#0d1117', color: '#fff', border: !isLogin ? getBorderStyle(validity.password) : '1px solid #30363d', outline: 'none' }} />
            {!isLogin && validity.password === false && <span style={{ color: '#ff7b72', fontSize: '11px', display: 'block', marginTop: '4px' }}>Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special (@$!%*?&).</span>}
          </div>

          <button type="submit" disabled={isLoading || !isFormValid} style={{ padding: '12px', backgroundColor: isFormValid ? '#1f6feb' : '#444c56', color: isFormValid ? '#fff' : '#8b949e', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: (isLoading || !isFormValid) ? 'not-allowed' : 'pointer', marginTop: '10px', transition: '0.3s' }}>
            {isLoading ? 'Loading...' : (isLogin ? 'Login' : 'Create Account')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#8b949e' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span onClick={() => { setIsLogin(!isLogin); setError(''); setValidity({name: null, email: null, phone: null, password: null}); }} style={{ color: '#58a6ff', cursor: 'pointer', fontWeight: 'bold' }}>
            {isLogin ? 'Register here' : 'Login here'}
          </span>
        </div>

      </div>
    </div>
  );
};

export default AuthModal;