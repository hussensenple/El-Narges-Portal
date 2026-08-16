import { useState } from 'react';
import axios from 'axios';
import PropertyAssignCatalog from './PropertyAssignCatalog';

interface RoleChangeModalProps {
  userId: string;
  userName: string;
  currentRole: string;
  onClose: () => void;
  onSuccess: () => void;
}

// All data needed to commit an Owner/Broker role change, passed to the catalog
export interface PendingRoleData {
  newRole: 'owner' | 'broker';
  manualId?: string; // Required only for broker
}

const RoleChangeModal = ({ userId, userName, currentRole, onClose, onSuccess }: RoleChangeModalProps) => {
  const getAvailableRoles = () => {
    const roles = [];
    if (currentRole !== 'user') roles.push({ value: 'user', label: 'User' });
    if (currentRole === 'owner') return roles;

    if (currentRole !== 'broker') roles.push({ value: 'broker', label: 'Broker' });
    if (currentRole !== 'engineer') roles.push({ value: 'engineer', label: 'Engineer' });
    if (currentRole !== 'admin') roles.push({ value: 'admin', label: 'Admin' });
    if (currentRole === 'user') roles.push({ value: 'owner', label: 'Owner' });
    
    return roles;
  };

  const availableRoles = getAvailableRoles();
  const [targetRole, setTargetRole] = useState(availableRoles.length > 0 ? availableRoles[0].value : 'user');
  const [manualId, setManualId] = useState('');
  const [age, setAge] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  // Holds the PENDING role data — not saved until first property is assigned
  const [pendingRoleData, setPendingRoleData] = useState<PendingRoleData | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetRole === currentRole) return;

    // ✅ For Owner/Broker: DO NOT save the role yet.
    // Open the catalog with pending data. Role is committed after first property assignment.
    if (targetRole === 'owner') {
      setPendingRoleData({ newRole: 'owner' });
      setShowCatalog(true);
      return;
    }
    if (targetRole === 'broker') {
      if (!manualId) return alert('Manual Broker ID is required!');
      setPendingRoleData({ newRole: 'broker', manualId });
      setShowCatalog(true);
      return;
    }

    // For Engineer/Admin/User: save role immediately (no property needed)
    try {
      setLoading(true);
      const payload: any = { newRole: targetRole };
      if (['engineer', 'admin'].includes(targetRole)) {
        if (!manualId) return alert('Manual ID is required!');
        payload.manualId = manualId;
      }
      if (['engineer', 'admin'].includes(targetRole)) payload.age = Number(age);
      if (targetRole === 'engineer') {
        payload.graduationYear = Number(graduationYear);
      }
      await axios.put(`${import.meta.env.VITE_API_URL}/api/roles/change-role/${userId}`, payload);
      alert('Role changed successfully!');
      onSuccess();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to change role');
    } finally {
      setLoading(false);
    }
  };

  // Show PropertyAssignCatalog BEFORE committing the role for Owner/Broker
  if (showCatalog && pendingRoleData) {
    return (
      <PropertyAssignCatalog
        userId={userId}
        targetRole={pendingRoleData.newRole}
        pendingRoleData={pendingRoleData}
        onClose={() => { setShowCatalog(false); setPendingRoleData(null); }}
        onSuccess={() => { setShowCatalog(false); setPendingRoleData(null); onSuccess(); }}
      />
    );
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '30px', borderRadius: '10px', width: '400px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ marginTop: 0, color: 'var(--accent-blue)' }}>Change Role for {userName}</h3>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Target Role</label>
            <select 
              value={targetRole} 
              onChange={(e) => setTargetRole(e.target.value)}
              style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '5px' }}
            >
              {availableRoles.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </div>

          {['broker', 'engineer', 'admin'].includes(targetRole) && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Manual ID (Required)</label>
              <input required type="text" value={manualId} onChange={(e) => setManualId(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '5px' }} />
            </div>
          )}

          {['engineer', 'admin'].includes(targetRole) && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Age</label>
              <input type="number" value={age} onChange={(e) => setAge(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '5px' }} />
            </div>
          )}

          {targetRole === 'engineer' && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Graduation Year</label>
                <input type="number" value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '5px' }} />
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '5px', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px', backgroundColor: 'var(--accent-green-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
              {loading ? 'Saving...' : (targetRole === 'owner' || targetRole === 'broker') ? 'Save & Assign Property →' : 'Confirm Change'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoleChangeModal;
