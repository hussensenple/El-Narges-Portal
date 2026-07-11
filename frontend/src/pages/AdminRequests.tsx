import { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import AdminComplaintsTab from '../components/AdminComplaintsTab'; // 👈 استيراد التابة الجديدة

import RolesWidget from '../components/admin/RolesWidget';

const AdminPortal = () => {
// حالة التابات بعد دمج الشكاوى (شغلك) والصلاحيات (شغل صاحبك)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'requests' | 'complaints' | 'roles'>('dashboard');
  const [complaintsCount, setComplaintsCount] = useState(0);
  const [requests, setRequests] = useState([]);

  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/pending`);
      setRequests(res.data);
    } catch (error) {
      console.error("Error fetching requests:", error);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line
    fetchRequests(); 
    const socket = io(`${import.meta.env.VITE_API_URL}`);
    
    // 🚀 مسحنا السوكيت بتاع الشكاوى من هنا لأن الـ AdminComplaintsTab هو اللي بيسمعله وبيحدث الرقم
    socket.on('newBookingRequest', () => fetchRequests());
    
    return () => { socket.disconnect(); };
  }, []);

  const handleApprove = async (id: string) => {
    if (window.confirm("Are you sure you want to approve? The map will be updated immediately.")) {
      try {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/approve/${id}`);
        alert("✅ Approved successfully!");
        fetchRequests(); 
      } catch (error) {
        alert("❌ An error occurred during approval.");
      }
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt("Please enter the reason for rejection:");
    if (reason !== null) {
      try {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/reject/${id}`, { reason });
        alert("❌ Request rejected successfully!");
        fetchRequests(); 
      } catch (error) {
        alert("❌ An error occurred during rejection.");
      }
    }
  };

  return (
    <div style={{ backgroundColor: '#0d1117', color: '#c9d1d9', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      
      {/* 🚀 شريط التابات (Navigation Bar) */}
      <div style={{ display: 'flex', backgroundColor: '#161b22', padding: '10px 20px', borderBottom: '1px solid #30363d', gap: '15px' }}>
        <h2 style={{ margin: '0 20px 0 0', color: '#58a6ff' }}>El Narges Portal</h2>
        
        <button 
          onClick={() => setActiveTab('dashboard')}
          style={{ backgroundColor: activeTab === 'dashboard' ? '#1f6feb' : 'transparent', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s' }}
        >
          📊 Dashboard
        </button>

        <button 
          onClick={() => setActiveTab('requests')}
          style={{ backgroundColor: activeTab === 'requests' ? '#1f6feb' : 'transparent', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', position: 'relative' }}
        >
          📥 Booking Requests
          {requests.length > 0 && (
            <span style={{ backgroundColor: '#f85149', color: '#fff', borderRadius: '50%', padding: '2px 8px', marginLeft: '8px', fontSize: '12px' }}>
              {requests.length}
            </span>
          )}
        </button>

        {/* 👈 زرار الشكاوى بقى زيه زيهم بيغير التابة */}
        <button 
          onClick={() => setActiveTab('complaints')}
          style={{ backgroundColor: activeTab === 'complaints' ? '#1f6feb' : 'transparent', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', position: 'relative' }}
        >
          🛡️ Complaints
          {/* 👈 البادج الأحمر هيظهر بس لو في شكاوى (بيقرا من الـ State اللي جاية من الابن) */}
          {complaintsCount > 0 && (
            <span style={{ backgroundColor: '#da3633', color: '#fff', borderRadius: '50%', padding: '2px 8px', marginLeft: '8px', fontSize: '12px' }}>
              {complaintsCount}
            </span>
          )}
        </button>
        
        <button 
          onClick={() => setActiveTab('roles')}
          style={{
            backgroundColor: activeTab === 'roles' ? '#1f6feb' : 'transparent',
            color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s'
          }}
        >
          👥 Roles Management
        </button>
      </div>

      {/* 🖥️ منطقة عرض المحتوى (Content Area) */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        
        {/* التابة 1: Dashboard */}
        <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none', height: '100%' }}>
          <iframe 
            src="https://www.arcgis.com/apps/dashboards/345a8b7a40004be69a8de40951123b59" 
            width="100%" height="100%" frameBorder="0" title="ArcGIS Dashboard" style={{ display: 'block' }}
          />
        </div>

        {/* التابة 2: Requests */}
        <div style={{ display: activeTab === 'requests' ? 'block' : 'none', padding: '20px', height: '100%', overflowY: 'auto' }}>
          <div style={{ padding: '20px' }}>
            <h2 style={{ marginBottom: '20px', color: '#58a6ff' }}>Pending Requests</h2>
            {requests.length === 0 ? (
              <p style={{ color: '#8b949e' }}>No pending requests.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: '#161b22', borderRadius: '8px', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ backgroundColor: '#21262d', color: '#c9d1d9' }}>
                    <th style={{ padding: '12px' }}>Unit ID</th>
                    <th style={{ padding: '12px' }}>Customer Name</th>
                    <th style={{ padding: '12px' }}>Phone</th>
                    <th style={{ padding: '12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req: { _id: string, objectId?: number, unitId: string, userId?: { name: string, phone: string } }) => (
                    <tr key={req._id} style={{ borderTop: '1px solid #30363d' }}>
                      <td style={{ padding: '12px' }}>#{req.objectId || req.unitId}</td>
                      <td style={{ padding: '12px' }}>{req.userId?.name}</td>
                      <td style={{ padding: '12px' }}>{req.userId?.phone}</td>
                      <td style={{ padding: '12px' }}>
                        <button onClick={() => handleApprove(req._id)} style={{ marginRight: '10px', backgroundColor: '#238636', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>Approve</button>
                        <button onClick={() => handleReject(req._id)} style={{ backgroundColor: '#da3633', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>Reject</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        
        {/* 🚀 التابة 3: Complaints (مبدأ الـ SPA - الخريطة بتتحمل مرة واحدة وبتستخبى بس) */}
        <div style={{ 
          display: activeTab === 'complaints' ? 'block' : 'none', 
          height: '100%', 
          width: '100%' 
        }}>
          {/* 🚀 تمرير دالة التحديث للكومبوننت الابن */}
          <AdminComplaintsTab onCountUpdate={setComplaintsCount} />
        </div>

        {/* التابة الثالثة: إدارة الأدوار */}
        <div style={{ display: activeTab === 'roles' ? 'block' : 'none', height: '100%' }}>
          <RolesWidget />
        </div>

      </div>
    </div>
  );
};

export default AdminPortal;