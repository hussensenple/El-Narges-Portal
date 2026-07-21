import { useState } from 'react';
import UsersTable from './tables/UsersTable';
import OwnersTable from './tables/OwnersTable';
import BrokersTable from './tables/BrokersTable';
import EngineersTable from './tables/EngineersTable';
import AdminsTable from './tables/AdminsTable';

const RolesWidget = () => {
  const [activeRole, setActiveRole] = useState<'user' | 'owner' | 'broker' | 'engineer' | 'admin'>('user');

  return (
    <div style={{ backgroundColor: '#161b22', padding: '20px', borderRadius: '12px', border: '1px solid #30363d', marginBottom: '20px' }}>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #30363d', paddingBottom: '10px' }}>
        {['user', 'owner', 'broker', 'engineer', 'admin'].map(role => (
          <button
            key={role}
            onClick={() => setActiveRole(role as any)}
            style={{
              padding: '10px 16px',
              backgroundColor: activeRole === role ? '#21262d' : 'transparent',
              color: activeRole === role ? '#58a6ff' : '#8b949e',
              border: activeRole === role ? '1px solid #30363d' : '1px solid transparent',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              textTransform: 'capitalize',
              transition: 'all 0.2s'
            }}
          >
            {role === 'user' ? 'Users' : 
             role === 'owner' ? 'Owners' : 
             role === 'broker' ? 'Brokers' : 
             role === 'engineer' ? 'Engineer' : 'Admins'}
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
