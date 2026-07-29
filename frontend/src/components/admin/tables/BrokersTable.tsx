import { useState, useEffect } from 'react';
import axios from 'axios';
import RoleChangeModal from '../modals/RoleChangeModal';
import EditUserModal from '../modals/EditUserModal';
import BrokerPerformanceModal from '../modals/BrokerPerformanceModal';

const BrokersTable = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [searchId, setSearchId] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [performanceBroker, setPerformanceBroker] = useState<any>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/roles/broker`);
      setUsers(res.data);
    } catch (error) {
      console.error('Error fetching brokers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete broker ${userName}? This will remove their profile and unassign their properties.`)) return;
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/roles/${userId}`);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting broker:', error);
      alert('Failed to delete broker');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => {
    const term = searchId.toLowerCase();
    const mId = u.profile?.manualId || u._id || '';
    const name = u.name || '';
    const email = u.email || '';
    return mId.toLowerCase().includes(term) || name.toLowerCase().includes(term) || email.toLowerCase().includes(term);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <h4 style={{ margin: 0, color: '#8957e5' }}>Active Brokers</h4>
        <input 
          type="text" 
          placeholder="🔍 Search by ID, Name, Email..." 
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', width: '250px' }}
        />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--bg-tertiary)', textAlign: 'left' }}>
            <th style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>Broker ID</th>
            <th style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>Username</th>
            <th style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>Phone / Email</th>
            <th style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>Role</th>
            <th style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr>
          ) : filteredUsers.length === 0 ? (
            <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No brokers found.</td></tr>
          ) : (
            filteredUsers.map(user => (
              <tr key={user._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px', fontWeight: 'bold', color: '#8957e5' }}>{user.profile?.manualId || user._id.toString().substring(0, 8)}</td>
                <td style={{ padding: '12px' }}>{user.name}</td>
                <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                  <div>{user.phone}</div>
                  <div style={{ fontSize: '11px' }}>{user.email}</div>
                </td>
                <td style={{ padding: '12px' }}><span style={{ backgroundColor: '#8957e533', color: '#8957e5', padding: '4px 8px', borderRadius: '12px', fontSize: '12px' }}>Broker</span></td>
                <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                  <button onClick={() => setEditingUser(user)} style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>✏️ Edit</button>
                  <button onClick={() => setPerformanceBroker(user)} style={{ backgroundColor: 'var(--accent-green-bg)', color: 'var(--text-primary)', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>📊 Performance</button>
                  <button 
                    onClick={() => setSelectedUser(user)}
                    style={{ backgroundColor: 'var(--accent-red-bg)', color: 'var(--text-primary)', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    🔄 Revoke
                  </button>
                  <button 
                    onClick={() => handleDelete(user._id, user.name)}
                    style={{ backgroundColor: 'transparent', color: 'var(--accent-red)', border: '1px solid var(--accent-red)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    🗑️ Delete
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

      {performanceBroker && (
        <BrokerPerformanceModal
          broker={performanceBroker}
          onClose={() => setPerformanceBroker(null)}
        />
      )}
    </div>
  );
};

export default BrokersTable;
