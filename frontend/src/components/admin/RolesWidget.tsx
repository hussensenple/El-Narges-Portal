import { useState } from 'react';
import UsersTable from './tables/UsersTable';
import OwnersTable from './tables/OwnersTable';
import BrokersTable from './tables/BrokersTable';
import EngineersTable from './tables/EngineersTable';
import AdminsTable from './tables/AdminsTable';

const RolesWidget = () => {
  const [activeRole, setActiveRole] = useState<'user' | 'owner' | 'broker' | 'engineer' | 'admin'>('user');

  return (
    <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
      <h3 style={{ borderBottom: '1px solid #30363d', paddingBottom: '10px', marginTop: 0 }}>Roles Management</h3>
      
      {/* 5 Role Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {['user', 'owner', 'broker', 'engineer', 'admin'].map(role => (
          <button
            key={role}
            onClick={() => setActiveRole(role as any)}
            style={{
              padding: '8px 16px',
              backgroundColor: activeRole === role ? '#1f6feb' : '#21262d',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              textTransform: 'capitalize'
            }}
          >
            {role}s
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ backgroundColor: '#161b22', padding: '20px', borderRadius: '8px', border: '1px solid #30363d' }}>
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
