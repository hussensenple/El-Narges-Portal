import { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

interface AccountSettingsModalProps {
  onClose: () => void;
}

const AccountSettingsModal = ({ onClose }: AccountSettingsModalProps) => {
  const auth = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const [validity, setValidity] = useState({
    name: null as boolean | null,
    email: null as boolean | null,
    phone: null as boolean | null,
    secondaryEmail: null as boolean | null,
    secondaryPhone: null as boolean | null,
    newPassword: null as boolean | null
  });

  const handleValidation = (field: string, value: string) => {
    if (field === 'name') {
      setName(value);
      setValidity(prev => ({ ...prev, name: /^[a-zA-Z\s]{3,50}$/.test(value) }));
    } else if (field === 'email') {
      setEmail(value);
      setValidity(prev => ({ ...prev, email: /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(value) }));
    } else if (field === 'phone') {
      setPhone(value);
      setValidity(prev => ({ ...prev, phone: /^01[0125][0-9]{8}$/.test(value) }));
    } else if (field === 'secondaryEmail') {
      setSecondaryEmail(value);
      if (value === '') setValidity(prev => ({ ...prev, secondaryEmail: null }));
      else setValidity(prev => ({ ...prev, secondaryEmail: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value) }));
    } else if (field === 'secondaryPhone') {
      setSecondaryPhone(value);
      if (value === '') setValidity(prev => ({ ...prev, secondaryPhone: null }));
      else setValidity(prev => ({ ...prev, secondaryPhone: /^01[0125][0-9]{8}$/.test(value) }));
    } else if (field === 'newPassword') {
      setNewPassword(value);
      setValidity(prev => ({ ...prev, newPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(value) }));
    }
  };

  useEffect(() => {
    if (auth?.user) {
      setName(auth.user.name || '');
      setEmail(auth.user.email || '');
      setPhone(auth.user.phone || '');
      setSecondaryEmail(auth.user.secondaryEmail || '');
      setSecondaryPhone(auth.user.secondaryPhone || '');
    }
  }, [auth?.user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL}/api/users/profile`, {
        name, email, phone, secondaryEmail, secondaryPhone
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessage({ text: 'Profile updated successfully!', type: 'success' });
      if (auth?.updateUser) {
        auth.updateUser({ ...auth.user, name, email, phone, secondaryEmail, secondaryPhone } as any);
      }
    } catch (err: any) {
      setMessage({ text: err.response?.data?.msg || 'Error updating profile', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ text: 'New passwords do not match!', type: 'error' });
      return;
    }
    
    setLoading(true);
    setMessage({ text: '', type: '' });
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL}/api/users/change-password`, {
        currentPassword, newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessage({ text: 'Password changed successfully!', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ text: err.response?.data?.msg || 'Error changing password', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px', marginBottom: '16px',
    backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)',
    color: 'var(--text-secondary)', borderRadius: '6px', outline: 'none'
  };

  const labelStyle = {
    display: 'block', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 'bold'
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '14px', width: '90%', maxWidth: '450px', overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.8)' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem' }}>Account Settings</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--bg-tertiary)' }}>
          <button 
            onClick={() => { setActiveTab('profile'); setMessage({ text: '', type: '' }); }} 
            style={{ flex: 1, padding: '12px', background: activeTab === 'profile' ? 'var(--accent-blue-bg)' : 'transparent', color: activeTab === 'profile' ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
            Profile
          </button>
          <button 
            onClick={() => { setActiveTab('security'); setMessage({ text: '', type: '' }); }} 
            style={{ flex: 1, padding: '12px', background: activeTab === 'security' ? 'var(--accent-blue-bg)' : 'transparent', color: activeTab === 'security' ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
            Security
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px 20px' }}>
          {message.text && (
            <div style={{ padding: '12px', borderRadius: '6px', marginBottom: '20px', backgroundColor: message.type === 'error' ? 'rgba(248, 81, 73, 0.1)' : 'rgba(46, 160, 67, 0.1)', border: `1px solid ${message.type === 'error' ? 'var(--accent-red)' : 'var(--accent-green)'}`, color: message.type === 'error' ? '#ff7b72' : '#56d364', fontSize: '14px', textAlign: 'center' }}>
              {message.text}
            </div>
          )}

          {activeTab === 'profile' ? (
            <form onSubmit={handleProfileSubmit}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Full Name</label>
                  <input style={{...inputStyle, border: validity.name === false ? '1px solid var(--accent-red)' : validity.name ? '1px solid var(--accent-green)' : inputStyle.border}} type="text" value={name} onChange={e => handleValidation('name', e.target.value)} required />
                  {validity.name === false && <span style={{ color: '#ff7b72', fontSize: '11px', display: 'block', marginTop: '-12px', marginBottom: '10px' }}>Only letters and spaces (3-50 chars).</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Primary Phone</label>
                  <input style={{...inputStyle, border: validity.phone === false ? '1px solid var(--accent-red)' : validity.phone ? '1px solid var(--accent-green)' : inputStyle.border}} type="text" value={phone} onChange={e => handleValidation('phone', e.target.value)} required />
                  {validity.phone === false && <span style={{ color: '#ff7b72', fontSize: '11px', display: 'block', marginTop: '-12px', marginBottom: '10px' }}>Must be a valid 11-digit mobile number.</span>}
                </div>
              </div>
              
              <label style={labelStyle}>Primary Email (Login)</label>
              <input style={{...inputStyle, border: validity.email === false ? '1px solid var(--accent-red)' : validity.email ? '1px solid var(--accent-green)' : inputStyle.border}} type="email" value={email} onChange={e => handleValidation('email', e.target.value)} required />
              {validity.email === false && <span style={{ color: '#ff7b72', fontSize: '11px', display: 'block', marginTop: '-12px', marginBottom: '10px' }}>Must be a valid @gmail.com address.</span>}
              
              <label style={labelStyle}>Secondary Email (Optional)</label>
              <input style={{...inputStyle, border: validity.secondaryEmail === false ? '1px solid var(--accent-red)' : validity.secondaryEmail ? '1px solid var(--accent-green)' : inputStyle.border}} type="email" value={secondaryEmail} onChange={e => handleValidation('secondaryEmail', e.target.value)} placeholder="Backup contact email" />
              {validity.secondaryEmail === false && <span style={{ color: '#ff7b72', fontSize: '11px', display: 'block', marginTop: '-12px', marginBottom: '10px' }}>Must be a valid email address.</span>}
              
              <label style={labelStyle}>Secondary Phone (Optional)</label>
              <input style={{...inputStyle, border: validity.secondaryPhone === false ? '1px solid var(--accent-red)' : validity.secondaryPhone ? '1px solid var(--accent-green)' : inputStyle.border}} type="text" value={secondaryPhone} onChange={e => handleValidation('secondaryPhone', e.target.value)} placeholder="Backup contact number" />
              {validity.secondaryPhone === false && <span style={{ color: '#ff7b72', fontSize: '11px', display: 'block', marginTop: '-12px', marginBottom: '10px' }}>Must be a valid 11-digit mobile number.</span>}
              
              <button type="submit" disabled={loading || validity.name === false || validity.email === false || validity.phone === false || validity.secondaryEmail === false || validity.secondaryPhone === false} style={{ width: '100%', padding: '12px', backgroundColor: (loading || validity.name === false || validity.email === false || validity.phone === false || validity.secondaryEmail === false || validity.secondaryPhone === false) ? '#444c56' : 'var(--accent-green-bg)', color: (loading || validity.name === false || validity.email === false || validity.phone === false || validity.secondaryEmail === false || validity.secondaryPhone === false) ? 'var(--text-muted)' : 'var(--text-primary)', border: 'none', borderRadius: '6px', cursor: (loading || validity.name === false || validity.email === false || validity.phone === false || validity.secondaryEmail === false || validity.secondaryPhone === false) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
                {loading ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordSubmit}>
              <label style={labelStyle}>Current Password</label>
              <input style={inputStyle} type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
              
              <label style={labelStyle}>New Password</label>
              <input style={{...inputStyle, border: validity.newPassword === false ? '1px solid var(--accent-red)' : validity.newPassword ? '1px solid var(--accent-green)' : inputStyle.border}} type="password" value={newPassword} onChange={e => handleValidation('newPassword', e.target.value)} required />
              {validity.newPassword === false && <span style={{ color: '#ff7b72', fontSize: '11px', display: 'block', marginTop: '-12px', marginBottom: '10px' }}>Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special (@$!%*?&).</span>}
              
              <label style={labelStyle}>Confirm New Password</label>
              <input style={inputStyle} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
              
              <button type="submit" disabled={loading || validity.newPassword === false} style={{ width: '100%', padding: '12px', backgroundColor: (loading || validity.newPassword === false) ? '#444c56' : 'var(--accent-green-bg)', color: (loading || validity.newPassword === false) ? 'var(--text-muted)' : 'var(--text-primary)', border: 'none', borderRadius: '6px', cursor: (loading || validity.newPassword === false) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
                {loading ? 'Updating...' : 'Change Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSettingsModal;
