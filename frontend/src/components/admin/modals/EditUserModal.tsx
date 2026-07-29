import { useState, useEffect } from 'react';
import axios from 'axios';
import PropertyAssignCatalog from './PropertyAssignCatalog';

interface EditUserModalProps {
  user: any;
  onClose: () => void;
  onSuccess: () => void;
}

const EditUserModal = ({ user, onClose, onSuccess }: EditUserModalProps) => {
  const [loading, setLoading] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);

  // Form states
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [email, setEmail] = useState(user.email || '');
  const [countryStatus, setCountryStatus] = useState(user.countryStatus || 'Egypt');
  const [governorate, setGovernorate] = useState(user.countryStatus === 'Outside Egypt' ? user.governorate : (user.governorate || 'Cairo'));
  const [governoratesList, setGovernoratesList] = useState<string[]>([]);
  
  // Profile states
  const [manualId, setManualId] = useState(user.profile?.manualId || '');
  const [age, setAge] = useState(user.profile?.age || '');
  const [graduationYear, setGraduationYear] = useState(user.profile?.graduationYear || '');

  const isOwnerOrBroker = user.role === 'owner' || user.role === 'broker';
  const roleColors: any = { user: 'var(--accent-green)', owner: 'var(--accent-gold)', broker: '#8957e5', engineer: '#e34c26', admin: 'var(--accent-red)' };
  const roleColor = roleColors[user.role] || 'var(--accent-blue)';

  const fetchUserUnits = async () => {
    if (!isOwnerOrBroker) return;
    try {
      setLoadingUnits(true);
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/roles/user-units/${user._id}?role=${user.role}`);
      setUnits(res.data);
    } catch (error) {
      console.error('Failed to fetch user units:', error);
    } finally {
      setLoadingUnits(false);
    }
  };

  useEffect(() => {
    fetchUserUnits();
  }, [user]);

  useEffect(() => {
    const fetchGovernorates = async () => {
      try {
        const url = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Heatmap_WFL1/FeatureServer/0/query';
        const res = await axios.get(url, { params: { where: '1=1', outFields: '*', returnGeometry: false, f: 'json' } });
        if (res.data && res.data.features && res.data.features.length > 0) {
          const fields = Object.keys(res.data.features[0].attributes);
          const nameField = fields.find(f => f.toLowerCase().includes('name') || f.toLowerCase().includes('gov') || f.toLowerCase().includes('ar')) || fields.find(f => typeof res.data.features[0].attributes[f] === 'string');
          const govs = [...new Set(res.data.features.map((f: any) => nameField ? f.attributes[nameField] : undefined))].filter(Boolean) as string[];
          setGovernoratesList(govs);
        } else {
          throw new Error('No data');
        }
      } catch (err) {
        const fallbackGovs = ['Cairo', 'Giza', 'Alexandria', 'Dakahlia', 'Red Sea', 'Beheira', 'Fayoum', 'Gharbia', 'Ismailia', 'Menofia', 'Minya', 'Qaliubiya', 'New Valley', 'Suez', 'Aswan', 'Assiut', 'Beni Suef', 'Port Said', 'Damietta', 'Sharkia', 'South Sinai', 'Kafr Al sheikh', 'Matrouh', 'Luxor', 'Qena', 'North Sinai', 'Sohag'];
        setGovernoratesList(fallbackGovs);
      }
    };
    fetchGovernorates();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload: any = { name, phone, email, countryStatus, governorate };
      
      if (['broker', 'engineer', 'admin'].includes(user.role)) {
        if (!manualId?.trim()) return alert('Manual ID is required!');
        payload.manualId = manualId.trim();
      }
      if (['engineer', 'admin'].includes(user.role)) payload.age = Number(age);
      if (user.role === 'engineer') {
        payload.graduationYear = Number(graduationYear);
      }

      await axios.put(`${import.meta.env.VITE_API_URL}/api/roles/edit/${user._id}`, payload);
      alert('User updated successfully!');
      onSuccess();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveProperty = async (unit: any) => {
    if (!window.confirm(`Are you sure you want to remove property #${unit.arcgisId}?`)) return;
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/roles/remove-property`, {
        userId: user._id,
        unitId: unit.arcgisId,
        arcgisObjectId: unit.arcgisId, // Approximated
        sourceLayer: 'Units', // Safe default for remove
        currentRole: user.role
      });
      alert('Property removed successfully.');
      
      // If the owner removed their last property, they are downgraded to user automatically.
      // So we should close the modal and trigger a refresh.
      if (user.role === 'owner' && units.length === 1) {
        alert('Last property removed. User has been downgraded to standard user.');
        onSuccess();
      } else {
        fetchUserUnits(); // Refresh list
      }
    } catch (error) {
      alert('Failed to remove property');
    }
  };

  if (showCatalog) {
    return (
      <PropertyAssignCatalog
        userId={user._id}
        targetRole={user.role as 'owner' | 'broker'}
        pendingRoleData={{ newRole: user.role as 'owner' | 'broker' }}
        roleAlreadyCommitted={true}
        onClose={() => setShowCatalog(false)}
        onSuccess={() => { setShowCatalog(false); fetchUserUnits(); }}
      />
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '30px', borderRadius: '10px', width: isOwnerOrBroker ? '800px' : '400px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-color)', display: 'flex', gap: '30px' }}>
        
        {/* Left Side: Form */}
        <div style={{ flex: 1 }}>
          <h3 style={{ marginTop: 0, color: roleColor, textTransform: 'capitalize' }}>Edit {user.role}</h3>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div><label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Name</label>
            <input required type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '5px', boxSizing: 'border-box' }} /></div>
            
            <div><label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Phone Number</label>
            <input required type="text" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '5px', boxSizing: 'border-box' }} /></div>
            
            <div><label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '5px', boxSizing: 'border-box' }} /></div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{ flex: 1 }}><label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Region</label>
              <select value={countryStatus} onChange={(e) => setCountryStatus(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '5px', boxSizing: 'border-box', outline: 'none' }}>
                <option value="Egypt">Inside Egypt</option>
                <option value="Outside Egypt">Outside Egypt</option>
              </select></div>
              <div style={{ flex: 1 }}><label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Governorate/Country</label>
              {countryStatus === 'Egypt' ? (
                <select value={governorate} onChange={(e) => setGovernorate(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '5px', boxSizing: 'border-box', outline: 'none' }}>
                  <option value="" disabled>Select Governorate</option>
                  {governoratesList.map(gov => (
                    <option key={gov} value={gov}>{gov}</option>
                  ))}
                </select>
              ) : (
                <input type="text" value={governorate} onChange={(e) => setGovernorate(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '5px', boxSizing: 'border-box' }} placeholder="e.g. UAE" />
              )}
              </div>
            </div>

            {['broker', 'engineer', 'admin'].includes(user.role) && (
              <div><label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Manual ID (Required)</label>
              <input required type="text" value={manualId} onChange={(e) => setManualId(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '5px', boxSizing: 'border-box' }} /></div>
            )}

            {['engineer', 'admin'].includes(user.role) && (
              <div><label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Age</label>
              <input type="number" value={age} onChange={(e) => setAge(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '5px', boxSizing: 'border-box' }} /></div>
            )}

            {user.role === 'engineer' && (
              <>
                <div><label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Graduation Year</label>
                <input type="number" value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '5px', boxSizing: 'border-box' }} /></div>
              </>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '5px', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px', backgroundColor: 'var(--accent-green)', color: 'var(--text-primary)', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Side: Properties (Only for Owners & Brokers) */}
        {isOwnerOrBroker && (
          <div style={{ flex: 1, borderLeft: '1px solid var(--border-color)', paddingLeft: '30px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-secondary)' }}>{user.role === 'owner' ? 'Owned Properties' : 'Assigned Properties'}</h3>
              <button 
                onClick={() => setShowCatalog(true)}
                style={{ backgroundColor: 'var(--accent-blue-bg)', color: 'var(--text-primary)', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                + Add
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {loadingUnits ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Loading properties...</div>
              ) : units.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                  No properties assigned.
                </div>
              ) : (
                units.map(unit => {
                  const typeLabel = unit.sourceLayer === 'Villas_Global' ? '🏡 Villa' : '🏢 Apartment';
                  const displayId = unit.objectId || unit.arcgisId;
                  return (
                    <div key={unit._id} style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', color: 'var(--accent-blue)' }}>Unit #{displayId}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{typeLabel}</div>
                        <div style={{ fontSize: '11px', color: '#6e7681', marginTop: '2px' }}>Status: {unit.status === '4' ? '🔴 Sold' : '🟢 Active'}</div>
                      </div>
                      <button 
                        onClick={() => handleRemoveProperty(unit)}
                        style={{ backgroundColor: 'transparent', color: 'var(--accent-red)', border: '1px solid var(--accent-red)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditUserModal;
