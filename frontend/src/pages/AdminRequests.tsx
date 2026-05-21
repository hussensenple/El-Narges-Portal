import { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client'; // 👈 استدعاء مكتبة السوكيت

const AdminPortal = () => {
  // 1. حالة التابات (الافتراضي يفتح على تابة الـ Dashboard)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'requests'>('dashboard');
  
  // 2. حالة الطلبات
  const [requests, setRequests] = useState([]);

  // دالة جلب الطلبات
  const fetchRequests = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/admin/pending');
      setRequests(res.data);
    } catch (error) {
      console.error("خطأ في جلب الطلبات:", error);
    }
  };

  // 🎧 الـ useEffect بعد إضافة الـ WebSockets
  useEffect(() => {
    fetchRequests(); // جلب الطلبات أول ما الصفحة تفتح

    // الاتصال بالسيرفر
    const socket = io('http://localhost:5000');
    
    // أول ما نسمع إن في طلب جديد، نحدث الجدول فوراً
    socket.on('newBookingRequest', () => {
      fetchRequests(); 
    });

    // تنظيف الاتصال لما الأدمن يقفل الصفحة أو يروح مسار تاني
    return () => {
      socket.disconnect();
    };
  }, []);

  // دالة الموافقة
  const handleApprove = async (id: string) => {
    if (window.confirm("هل أنت متأكد من الموافقة؟ سيتم تحديث الخريطة فوراً.")) {
      try {
        await axios.post(`http://localhost:5000/api/admin/approve/${id}`);
        alert("✅ Approved successfully!");
        fetchRequests(); // تحديث الجدول
      } catch (error) {
        alert("❌ An error occurred during approval.");
      }
    }
  };

  // دالة المسح (Delete)
  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this request? This action cannot be undone.")) {
      try {
        await axios.delete(`http://localhost:5000/api/admin/request/${id}`);
        alert("🗑️ Request deleted successfully!");
        fetchRequests(); // تحديث الجدول عشان الطلب يختفي
      } catch (error) {
        alert("❌ An error occurred during deletion.");
        console.error("Delete Error:", error);
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
          style={{
            backgroundColor: activeTab === 'dashboard' ? '#1f6feb' : 'transparent',
            color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s'
          }}
        >
          📊 Dashboard
        </button>

        <button 
          onClick={() => setActiveTab('requests')}
          style={{
            backgroundColor: activeTab === 'requests' ? '#1f6feb' : 'transparent',
            color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', position: 'relative'
          }}
        >
          📥 Booking Requests
          {requests.length > 0 && (
            <span style={{ backgroundColor: '#f85149', color: '#fff', borderRadius: '50%', padding: '2px 8px', marginLeft: '8px', fontSize: '12px' }}>
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {/* 🖥️ منطقة عرض المحتوى (Content Area) */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        
        {/* التابة الأولى: ArcGIS Dashboard (استخدمنا display بدل الشرط) */}
        <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none', height: '100%' }}>
          <iframe 
            // ⚠️ حط لينك الـ ArcGIS Dashboard بتاعك هنا بدل اللينك ده ⚠️
            src="https://www.arcgis.com/apps/dashboards/345a8b7a40004be69a8de40951123b59" 
            width="100%" 
            height="100%" 
            frameBorder="0"
            title="ArcGIS Dashboard"
            style={{ display: 'block' }}
          />
        </div>

        {/* التابة التانية: جدول الطلبات */}
        <div style={{ display: activeTab === 'requests' ? 'block' : 'none', padding: '20px', height: '100%', overflowY: 'auto' }}>
          <h3 style={{ borderBottom: '1px solid #30363d', paddingBottom: '10px', marginTop: 0 }}>Unit Sales Management</h3>
          
          {requests.length === 0 ? (
            <p style={{ color: '#8b949e' }}>No pending requests currently.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px', backgroundColor: '#161b22', borderRadius: '8px', overflow: 'hidden' }}>
              <thead>
                <tr style={{ backgroundColor: '#21262d', textAlign: 'left' }}>
                  <th style={{ padding: '12px', borderBottom: '1px solid #30363d' }}>Unit ID</th>
                  <th style={{ padding: '12px', borderBottom: '1px solid #30363d' }}>Client Name</th>
                  <th style={{ padding: '12px', borderBottom: '1px solid #30363d' }}>Phone Number</th>
                  <th style={{ padding: '12px', borderBottom: '1px solid #30363d' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req: any) => (
                  <tr key={req._id} style={{ borderBottom: '1px solid #30363d' }}>
                    <td style={{ padding: '12px', fontWeight: 'bold', color: '#58a6ff' }}>#{req.unitId}</td>
                    <td style={{ padding: '12px' }}>{req.userId?.name || 'Unknown'}</td>
                    <td style={{ padding: '12px', color: '#8b949e' }}>{req.userId?.phone || '---'}</td>
                    
                    <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => handleApprove(req._id)} 
                        style={{ backgroundColor: '#238636', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}
                      >
                        ✅ Approve
                      </button>

                      <button 
                        onClick={() => handleDelete(req._id)} 
                        style={{ backgroundColor: '#da3633', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
};

export default AdminPortal;