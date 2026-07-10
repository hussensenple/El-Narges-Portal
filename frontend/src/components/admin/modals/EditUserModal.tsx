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
  
  // Profile states
  const [manualId, setManualId] = useState(user.profile?.manualId || '');
  const [age, setAge] = useState(user.profile?.age || '');
  const [speciality, setSpeciality] = useState(user.profile?.speciality || '');
  const [graduationYear, setGraduationYear] = useState(user.profile?.graduationYear || '');

  const isOwnerOrBroker = user.role === 'owner' || user.role === 'broker';
  const roleColors: any = { user: '#2ea043', owner: '#d29922', broker: '#8957e5', engineer: '#e34c26', admin: '#f85149' };
  const roleColor = roleColors[user.role] || '#58a6ff';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload: any = { name, phone, email };
      
      if (['broker', 'engineer', 'admin'].includes(user.role)) {
        if (!manualId?.trim()) return alert('Manual ID is required!');
        payload.manualId = manualId.trim();
      }
      if (['engineer', 'admin'].includes(user.role)) payload.age = Number(age);
      if (user.role === 'engineer') {
        payload.speciality = speciality;
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
      <div style={{ backgroundColor: '#161b22', padding: '30px', borderRadius: '10px', width: isOwnerOrBroker ? '800px' : '400px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #30363d', display: 'flex', gap: '30px' }}>
        
        {/* Left Side: Form */}
        <div style={{ flex: 1 }}>
          <h3 style={{ marginTop: 0, color: roleColor, textTransform: 'capitalize' }}>Edit {user.role}</h3>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div><label style={{ display: 'block', marginBottom: '5px', color: '#c9d1d9' }}>Name</label>
            <input required type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: '#0d1117', color: '#fff', border: '1px solid #30363d', borderRadius: '5px', boxSizing: 'border-box' }} /></div>
            
            <div><label style={{ display: 'block', marginBottom: '5px', color: '#c9d1d9' }}>Phone Number</label>
            <input required type="text" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: '#0d1117', color: '#fff', border: '1px solid #30363d', borderRadius: '5px', boxSizing: 'border-box' }} /></div>
            
            <div><label style={{ display: 'block', marginBottom: '5px', color: '#c9d1d9' }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: '#0d1117', color: '#fff', border: '1px solid #30363d', borderRadius: '5px', boxSizing: 'border-box' }} /></div>

            {['broker', 'engineer', 'admin'].includes(user.role) && (
              <div><label style={{ display: 'block', marginBottom: '5px', color: '#c9d1d9' }}>Manual ID (Required)</label>
              <input required type="text" value={manualId} onChange={(e) => setManualId(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: '#0d1117', color: '#fff', border: '1px solid #30363d', borderRadius: '5px', boxSizing: 'border-box' }} /></div>
            )}

            {['engineer', 'admin'].includes(user.role) && (
              <div><label style={{ display: 'block', marginBottom: '5px', color: '#c9d1d9' }}>Age</label>
              <input type="number" value={age} onChange={(e) => setAge(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: '#0d1117', color: '#fff', border: '1px solid #30363d', borderRadius: '5px', boxSizing: 'border-box' }} /></div>
            )}

            {user.role === 'engineer' && (
              <>
                <div><label style={{ display: 'block', marginBottom: '5px', color: '#c9d1d9' }}>Speciality</label>
                <input type="text" value={speciality} onChange={(e) => setSpeciality(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: '#0d1117', color: '#fff', border: '1px solid #30363d', borderRadius: '5px', boxSizing: 'border-box' }} /></div>
                <div><label style={{ display: 'block', marginBottom: '5px', color: '#c9d1d9' }}>Graduation Year</label>
                <input type="number" value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: '#0d1117', color: '#fff', border: '1px solid #30363d', borderRadius: '5px', boxSizing: 'border-box' }} /></div>
              </>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', backgroundColor: '#21262d', color: '#fff', border: '1px solid #30363d', borderRadius: '5px', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px', backgroundColor: '#2ea043', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Side: Properties (Only for Owners & Brokers) */}
        {isOwnerOrBroker && (
          <div style={{ flex: 1, borderLeft: '1px solid #30363d', paddingLeft: '30px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#c9d1d9' }}>{user.role === 'owner' ? 'Owned Properties' : 'Assigned Properties'}</h3>
              <button 
                onClick={() => setShowCatalog(true)}
                style={{ backgroundColor: '#1f6feb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                + Add
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {loadingUnits ? (
                <div style={{ color: '#8b949e', textAlign: 'center', padding: '20px' }}>Loading properties...</div>
              ) : units.length === 0 ? (
                <div style={{ color: '#8b949e', textAlign: 'center', padding: '20px', border: '1px dashed #30363d', borderRadius: '8px' }}>
                  No properties assigned.
                </div>
              ) : (
                units.map(unit => (
                  <div key={unit._id} style={{ backgroundColor: '#0d1117', border: '1px solid #30363d', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#58a6ff' }}>Property ID: {unit.arcgisId}</div>
                      <div style={{ fontSize: '12px', color: '#8b949e' }}>Status: {unit.status === '4' ? 'Sold' : 'Active'}</div>
                    </div>
                    <button 
                      onClick={() => handleRemoveProperty(unit)}
                      style={{ backgroundColor: 'transparent', color: '#f85149', border: '1px solid #f85149', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditUserModal;
