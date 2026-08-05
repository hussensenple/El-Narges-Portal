import { useState, useEffect } from 'react';
import axios from 'axios';
import UsersTable from './tables/UsersTable';
import OwnersTable from './tables/OwnersTable';
import BrokersTable from './tables/BrokersTable';
import EngineersTable from './tables/EngineersTable';
import AdminsTable from './tables/AdminsTable';

const RolesWidget = () => {
  const [activeRole, setActiveRole] = useState<'user' | 'owner' | 'broker' | 'engineer' | 'admin'>('user');
  const [counts, setCounts] = useState({ user: 0, owner: 0, broker: 0, engineer: 0, admin: 0 });

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const roles = ['user', 'owner', 'broker', 'engineer', 'admin'];
        const promises = roles.map(r => axios.get(`${import.meta.env.VITE_API_URL}/api/roles/${r}`));
        const results = await Promise.all(promises);
        
        setCounts({
          user: results[0].data.length,
          owner: results[1].data.length,
          broker: results[2].data.length,
          engineer: results[3].data.length,
          admin: results[4].data.length
        });
      } catch (error) {
        console.error("Failed to fetch role counts", error);
      }
    };
    fetchCounts();
  }, []);

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        {['user', 'owner', 'broker', 'engineer', 'admin'].map(role => (
          <button
            key={role}
            onClick={() => setActiveRole(role as any)}
            style={{
              padding: '10px 16px',
              backgroundColor: activeRole === role ? 'var(--bg-tertiary)' : 'transparent',
              color: activeRole === role ? 'var(--accent-blue)' : 'var(--text-muted)',
              border: activeRole === role ? '1px solid var(--border-color)' : '1px solid transparent',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              textTransform: 'capitalize',
              transition: 'all 0.2s'
            }}
          >
            {role === 'user' ? `Users (${counts.user})` : 
             role === 'owner' ? `Owners (${counts.owner})` : 
             role === 'broker' ? `Brokers (${counts.broker})` : 
             role === 'engineer' ? `Engineer (${counts.engineer})` : `Admins (${counts.admin})`}
          </button>
        ))}
      </div>

      {/* Render Active Table */}
      <div style={{ overflowX: 'auto' }}>
        {activeRole === 'user' && <UsersTable />}
        {activeRole === 'owner' && <OwnersTable />}
        {activeRole === 'broker' && <BrokersTable />}
        {activeRole === 'engineer' && <EngineersTable />}
        {activeRole === 'admin' && <AdminsTable />}
      </div>
    </div>
  );
};

export default RolesWidget;
