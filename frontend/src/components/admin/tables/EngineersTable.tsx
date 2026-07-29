import { useState, useEffect } from 'react';
import axios from 'axios';
import RoleChangeModal from '../modals/RoleChangeModal';
import EditUserModal from '../modals/EditUserModal';

const EngineersTable = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [searchId, setSearchId] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/roles/engineer`);
      setUsers(res.data);
    } catch (error) {
      console.error('Error fetching engineers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => u.profile?.manualId?.includes(searchId));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <h4 style={{ margin: 0, color: '#e34c26' }}>Active Engineer</h4>
        <input 
          type="text" 
          placeholder="🔍 Search by Manual Engineer ID..." 
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', width: '250px' }}
        />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--bg-tertiary)', textAlign: 'left' }}>
            <th style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>Engineer ID</th>
            <th style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>Name & Contact</th>
            <th style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>Grad Year (Age)</th>
            <th style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr>
          ) : filteredUsers.length === 0 ? (
            <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No engineer found.</td></tr>
          ) : (
            filteredUsers.map(user => (
              <tr key={user._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px', fontWeight: 'bold', color: '#e34c26' }}>{user.profile?.manualId}</td>
                <td style={{ padding: '12px' }}>
                  <div style={{ fontWeight: 'bold' }}>{user.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user.phone}</div>
                </td>
                <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                  {user.profile?.graduationYear || 'N/A'} ({user.profile?.age ? `${user.profile.age} yrs` : 'N/A'})
                </td>
                <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                  <button onClick={() => setEditingUser(user)} style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>✏️ Edit</button>
                  <button 
                    onClick={() => setSelectedUser(user)}
                    style={{ backgroundColor: 'var(--accent-red-bg)', color: 'var(--text-primary)', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    🔄 Revoke
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {selectedUser && (
        <RoleChangeModal 
          userId={selectedUser._id} 
          userName={selectedUser.name} 
          currentRole={selectedUser.role} 
          onClose={() => setSelectedUser(null)} 
          onSuccess={() => { setSelectedUser(null); fetchUsers(); }} 
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={() => { setEditingUser(null); fetchUsers(); }}
        />
      )}
    </div>
  );
};

export default EngineersTable;
