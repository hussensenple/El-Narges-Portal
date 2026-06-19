import { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

interface AuthModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AuthModal = ({ onClose, onSuccess }: AuthModalProps) => {
  const auth = useContext(AuthContext);
  const [isLogin, setIsLogin] = useState(true); // للتبديل بين تسجيل الدخول وإنشاء حساب
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload = isLogin ? { phone, password } : { name, phone, password };
      
      const res = await axios.post(`${import.meta.env.VITE_API_URL}${endpoint}`, payload);
      
      // حفظ بيانات العميل في الذاكرة
      if (auth) {
        auth.login(res.data.user, res.data.token);
      }
      
      // تنفيذ دالة النجاح (التي ستكمل الحجز المعلق)
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
      
    } catch (err: any) {
      setError(err.response?.data?.msg || "حدث خطأ في الاتصال بالخادم");
    } finally {
      setIsLoading(false);
    }
  };

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
            <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required style={{ padding: '12px', borderRadius: '6px', border: '1px solid #30363d', backgroundColor: '#0d1117', color: '#fff' }} />
          )}
          <input type="tel" placeholder="Phone Number (e.g. 010...)" value={phone} onChange={e => setPhone(e.target.value)} required style={{ padding: '12px', borderRadius: '6px', border: '1px solid #30363d', backgroundColor: '#0d1117', color: '#fff' }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ padding: '12px', borderRadius: '6px', border: '1px solid #30363d', backgroundColor: '#0d1117', color: '#fff' }} />
          
          <button type="submit" disabled={isLoading} style={{ padding: '12px', backgroundColor: '#1f6feb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isLoading ? 'not-allowed' : 'pointer', marginTop: '10px' }}>
            {isLoading ? 'جاري التحميل...' : (isLogin ? 'Login' : 'Create Account')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#8b949e' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span onClick={() => { setIsLogin(!isLogin); setError(''); }} style={{ color: '#58a6ff', cursor: 'pointer', fontWeight: 'bold' }}>
            {isLogin ? 'Register here' : 'Login here'}
          </span>
        </div>

      </div>
    </div>
  );
};

export default AuthModal;