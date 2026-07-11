import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import SceneView from '@arcgis/core/views/SceneView';

const BrokerDashboard: React.FC = () => {
  const [brokerData, setBrokerData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<number>(0);

  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/bookings/all-broker-pending`);
      setBrokerData(res.data);
    } catch (error) {
      console.error("Error fetching broker requests:", error);
    }
  };

  useEffect(() => {
    fetchRequests();
    const socket = io(`${import.meta.env.VITE_API_URL}`);
    socket.on('newBookingRequest', () => fetchRequests());
    return () => { socket.disconnect(); };
  }, []);

  const handleAction = async (id: string, action: 'raise' | 'decline') => {
    const reason = action === 'decline' ? window.prompt("Please enter the reason for declining:") : '';
    if (action === 'decline' && reason === null) return;

    if (window.confirm(`Are you sure you want to ${action === 'raise' ? 'raise this request to admin' : 'decline this request'}?`)) {
      try {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/bookings/broker-review/${id}`, { action, reason }, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        alert(`Request has been successfully ${action === 'raise' ? 'raised' : 'declined'}!`);
        fetchRequests();
      } catch (error) {
        alert("An error occurred during the operation.");
      }
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0d1117',
      color: '#c9d1d9',
      padding: '40px 20px',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto',
        backgroundColor: '#161b22',
        borderRadius: '12px',
        border: '1px solid #30363d',
        padding: '30px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#58a6ff', borderBottom: '1px solid #30363d', paddingBottom: '15px' }}>
          Brokers Dashboard
        </h2>
        
        {brokerData.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#8b949e', marginTop: '40px', fontSize: '18px' }}>Loading brokers...</p>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '15px', marginBottom: '20px', borderBottom: '1px solid #30363d' }}>
              {brokerData.map((data, index) => (
                <button
                  key={data.broker._id}
                  onClick={() => setActiveTab(index)}
                  style={{
                    backgroundColor: activeTab === index ? '#1f6feb' : '#21262d',
                    color: activeTab === index ? '#fff' : '#c9d1d9',
                    border: '1px solid #30363d',
                    padding: '10px 15px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    transition: '0.2s'
                  }}
                >
                  {data.broker.name} <span style={{ backgroundColor: '#161b22', padding: '2px 8px', borderRadius: '12px', marginLeft: '5px', fontSize: '12px' }}>{data.requests.length}</span>
                </button>
              ))}
            </div>

            <div>
              <h3 style={{ color: '#c9d1d9', marginBottom: '15px' }}>
                Pending Requests for {brokerData[activeTab]?.broker.name}
              </h3>

              {brokerData[activeTab]?.requests.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#8b949e', marginTop: '20px', fontSize: '16px' }}>No pending requests for this broker.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '16px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#21262d', textAlign: 'left' }}>
                      <th style={{ padding: '15px', borderBottom: '1px solid #30363d' }}>Unit ID</th>
                      <th style={{ padding: '15px', borderBottom: '1px solid #30363d' }}>Client Name</th>
                      <th style={{ padding: '15px', borderBottom: '1px solid #30363d' }}>Phone</th>
                      <th style={{ padding: '15px', borderBottom: '1px solid #30363d' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brokerData[activeTab]?.requests.map((req: any) => (
                      <tr key={req._id} style={{ borderBottom: '1px solid #30363d', transition: '0.2s', backgroundColor: 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1c2128'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <td style={{ padding: '15px', fontWeight: 'bold', color: '#58a6ff' }}>#{req.objectId || req.unitId}</td>
                        <td style={{ padding: '15px' }}>{req.userId?.name || 'Unknown'}</td>
                        <td style={{ padding: '15px', color: '#8b949e' }}>{req.userId?.phone || '---'}</td>
                        <td style={{ padding: '15px', display: 'flex', gap: '10px' }}>
                          <button onClick={() => handleAction(req._id, 'raise')} style={{ backgroundColor: '#1f6feb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}>⬆️ Raise to Admin</button>
                          <button onClick={() => handleAction(req._id, 'decline')} style={{ backgroundColor: '#da3633', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}>❌ Decline</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BrokerDashboard;
