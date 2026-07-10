import { useState, useEffect } from 'react';
import axios from 'axios';
import RoleChangeModal from '../modals/RoleChangeModal';
import EditUserModal from '../modals/EditUserModal';

const OwnersTable = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [searchPhone, setSearchPhone] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/roles/owner`);
      setUsers(res.data);
    } catch (error) {
      console.error('Error fetching owners:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => u.phone.includes(searchPhone));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <h4 style={{ margin: 0, color: '#d29922' }}>Registered Owners</h4>
        <input 
          type="text" 
          placeholder="🔍 Search by Phone Number..." 
          value={searchPhone}
          onChange={(e) => setSearchPhone(e.target.value)}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #30363d', backgroundColor: '#0d1117', color: '#fff', width: '250px' }}
        />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr style={{ backgroundColor: '#21262d', textAlign: 'left' }}>
            <th style={{ padding: '12px', borderBottom: '1px solid #30363d' }}>Username</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #30363d' }}>Phone Number</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #30363d' }}>Email</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #30363d' }}>Owned Properties</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #30363d' }}>Role</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #30363d' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#8b949e' }}>Loading...</td></tr>
          ) : filteredUsers.length === 0 ? (
            <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#8b949e' }}>No owners found.</td></tr>
          ) : (
            filteredUsers.map(user => (
              <tr key={user._id} style={{ borderBottom: '1px solid #30363d' }}>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>{user.name}</td>
                <td style={{ padding: '12px', color: '#8b949e' }}>{user.phone}</td>
                <td style={{ padding: '12px', color: '#8b949e' }}>{user.email}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ fontWeight: 'bold', color: '#58a6ff' }}>{user.ownedUnits?.length || 0}</span> Properties
                </td>
                <td style={{ padding: '12px' }}><span style={{ backgroundColor: '#bb800933', color: '#d29922', padding: '4px 8px', borderRadius: '12px', fontSize: '12px' }}>Owner</span></td>
                <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                  <button onClick={() => setEditingUser(user)} style={{ backgroundColor: '#21262d', color: '#fff', border: '1px solid #30363d', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>✏️ Edit & Manage</button>
                  <button 
                    onClick={() => setSelectedUser(user)}
                    style={{ backgroundColor: '#da3633', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    🔄 Downgrade to User
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

export default OwnersTable;
