import { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import AdminComplaintsTab from '../components/AdminComplaintsTab'; // 👈 استيراد التابة الجديدة
import PropertyManagementTab from '../components/admin/PropertyManagementTab';
import AdminDashboardTab from '../components/admin/AdminDashboardTab';
import AdminAIChatbotTab from '../components/admin/AdminAIChatbotTab';
import PropertyAssignCatalog from '../components/admin/modals/PropertyAssignCatalog';
import LogoIcon from '../components/LogoIcon';
import ThemeToggle from '../components/ThemeToggle';

import RolesWidget from '../components/admin/RolesWidget';
import RejectionAnalysisTab from '../components/admin/RejectionAnalysisTab';

const AdminPortal = () => {
// حالة التابات بعد دمج الشكاوى (شغلك) والصلاحيات (شغل صاحبك)
  const [activeTab, setActiveTab] = useState<'analytics' | 'chatbot' | 'requests' | 'complaints' | 'roles' | 'properties' | 'rejections'>('analytics');
  const [complaintsCount, setComplaintsCount] = useState(0);
  const [requests, setRequests] = useState([]);
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatbotAssignUser, setChatbotAssignUser] = useState<{ id: string, role: string } | null>(null);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/pending`, {
        headers: { 'x-auth-token': token }
      });
      const sortedData = res.data.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      setRequests(sortedData);
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
        const token = localStorage.getItem('token');
        await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/approve/${id}`, {}, {
          headers: { 'x-auth-token': token }
        });
        alert("✅ Approved successfully!");
        fetchRequests(); 
      } catch (error) {
        alert("❌ An error occurred during approval.");
      }
    }
  };

  const [rejectModalState, setRejectModalState] = useState<{ id: string | null, isBulk: boolean } | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectNotes, setRejectNotes] = useState<string>('');
  const adminRejectReasonsList = ['Served By Another Client', 'Management Decision', 'Downpayment Delay'];

  const openRejectModal = (id: string | null, isBulk: boolean) => {
    if (isBulk && selectedRequests.length === 0) {
      alert("Select requests first");
      return;
    }
    setRejectModalState({ id, isBulk });
    setRejectReason('');
    setRejectNotes('');
  };

  const closeRejectModal = () => {
    setRejectModalState(null);
    setRejectReason('');
    setRejectNotes('');
  };

  const submitReject = async () => {
    if (!rejectReason) {
      alert("Please select a reason for rejection.");
      return;
    }

    if (rejectModalState?.isBulk) {
      setIsProcessing(true);
      const token = localStorage.getItem('token');
      const promises = selectedRequests.map(id => 
        axios.post(`${import.meta.env.VITE_API_URL}/api/admin/reject/${id}`, { reason: rejectReason, notes: rejectNotes }, { headers: { 'x-auth-token': token } })
          .then(() => 1)
          .catch(() => { console.error(`Failed to reject ${id}`); return 0; })
      );
      const results = await Promise.all(promises);
      const successCount = results.reduce((acc, val) => acc + val, 0);
      alert(`❌ Rejected ${successCount} out of ${selectedRequests.length} requests!`);
      setSelectedRequests([]);
      fetchRequests();
      setIsProcessing(false);
      closeRejectModal();
    } else if (rejectModalState?.id) {
      try {
        const token = localStorage.getItem('token');
        await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/reject/${rejectModalState.id}`, { reason: rejectReason, notes: rejectNotes }, {
          headers: { 'x-auth-token': token }
        });
        alert("❌ Request rejected successfully!");
        fetchRequests(); 
        closeRejectModal();
      } catch (error) {
        alert("❌ An error occurred during rejection.");
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedRequests.length === requests.length) {
      setSelectedRequests([]);
    } else {
      setSelectedRequests(requests.map((r: any) => r._id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedRequests.includes(id)) {
      setSelectedRequests(selectedRequests.filter(reqId => reqId !== id));
    } else {
      setSelectedRequests([...selectedRequests, id]);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedRequests.length === 0) return alert("Select requests first");
    if (window.confirm(`Are you sure you want to approve ${selectedRequests.length} requests? The map will be updated immediately.`)) {
      setIsProcessing(true);
      const token = localStorage.getItem('token');
      const promises = selectedRequests.map(id => 
        axios.post(`${import.meta.env.VITE_API_URL}/api/admin/approve/${id}`, {}, { headers: { 'x-auth-token': token } })
          .then(() => 1)
          .catch(() => { console.error(`Failed to approve ${id}`); return 0; })
      );
      const results = await Promise.all(promises);
      const successCount = results.reduce((acc, val) => acc + val, 0);
      alert(`✅ Approved ${successCount} out of ${selectedRequests.length} requests!`);
      setSelectedRequests([]);
      fetchRequests();
      setIsProcessing(false);
    }
  };



  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      
      {/* 🚀 شريط التابات (Navigation Bar) */}
      <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '10px 20px', borderBottom: '1px solid var(--border-color)', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <LogoIcon width={36} height={36} />
          {/* Theme Toggle Switch */}
          <ThemeToggle />
        </div>
        
        <div style={{ flex: 1 }}></div>

        {/* 🤖 زر الشات بوت على شمال Analytics */}
        <button 
          onClick={() => setActiveTab('chatbot')}
          style={{ backgroundColor: activeTab === 'chatbot' ? 'var(--accent-green-bg)' : 'transparent', color: '#3fb950', border: '1px solid #3fb950', padding: '10px 20px', fontSize: '13px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', display: 'flex', alignItems: 'center', textAlign: 'center', lineHeight: '1.2' }}
        >
          🤖 AI<br/>Assistant
        </button>
        
        <button 
          onClick={() => setActiveTab('analytics')}
          style={{ backgroundColor: activeTab === 'analytics' ? 'var(--accent-blue-bg)' : 'transparent', color: 'var(--text-primary)', border: 'none', padding: '10px 20px', fontSize: '13px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', textAlign: 'center', lineHeight: '1.2' }}
        >
          📈 Analytics<br/>Overview
        </button>

        <button 
          onClick={() => setActiveTab('requests')}
          style={{ backgroundColor: activeTab === 'requests' ? 'var(--accent-blue-bg)' : 'transparent', color: 'var(--text-primary)', border: 'none', padding: '10px 20px', fontSize: '13px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', display: 'flex', alignItems: 'center', textAlign: 'center', lineHeight: '1.2' }}
        >
          <div>📥 Booking<br/>Requests</div>
          {requests.length > 0 && (
            <span style={{ backgroundColor: 'var(--accent-red)', color: 'var(--text-primary)', borderRadius: '50%', padding: '2px 8px', marginLeft: '8px', fontSize: '12px' }}>
              {requests.length}
            </span>
          )}
        </button>

        {/* 👈 زرار الشكاوى بقى زيه زيهم بيغير التابة */}
        <button 
          onClick={() => setActiveTab('complaints')}
          style={{ backgroundColor: activeTab === 'complaints' ? 'var(--accent-blue-bg)' : 'transparent', color: 'var(--text-primary)', border: 'none', padding: '10px 20px', fontSize: '13px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', display: 'flex', alignItems: 'center', textAlign: 'center', lineHeight: '1.2' }}
        >
          <div>🛡️ Complaints</div>
          {/* 👈 البادج الأحمر هيظهر بس لو في شكاوى (بيقرا من الـ State اللي جاية من الابن) */}
          {complaintsCount > 0 && (
            <span style={{ backgroundColor: 'var(--accent-red-bg)', color: 'var(--text-primary)', borderRadius: '50%', padding: '2px 8px', marginLeft: '8px', fontSize: '12px' }}>
              {complaintsCount}
            </span>
          )}
        </button>
        
        <button 
          onClick={() => setActiveTab('roles')}
          style={{
            backgroundColor: activeTab === 'roles' ? 'var(--accent-blue-bg)' : 'transparent',
            color: 'var(--text-primary)', border: 'none', padding: '10px 20px', fontSize: '13px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', textAlign: 'center', lineHeight: '1.2'
          }}
        >
          👥 Roles<br/>Management
        </button>
        
        <button 
          onClick={() => setActiveTab('properties')}
          style={{
            backgroundColor: activeTab === 'properties' ? 'var(--accent-blue-bg)' : 'transparent',
            color: 'var(--text-primary)', border: 'none', padding: '10px 20px', fontSize: '13px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', textAlign: 'center', lineHeight: '1.2'
          }}
        >
          🏢 Property<br/>Management
        </button>

        <button 
          onClick={() => setActiveTab('rejections')}
          style={{
            backgroundColor: activeTab === 'rejections' ? 'var(--accent-blue-bg)' : 'transparent',
            color: 'var(--text-primary)', border: 'none', padding: '10px 20px', fontSize: '13px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', textAlign: 'center', lineHeight: '1.2'
          }}
        >
          📉 Analyze<br/>Rejections
        </button>

      </div>

      {/* 🖥️ منطقة عرض المحتوى (Content Area) */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        
        {/* التابة الجديدة: Analytics */}
        <div style={{ display: activeTab === 'analytics' ? 'block' : 'none', height: '100%', paddingBottom: '5px', boxSizing: 'border-box' }}>
          <AdminDashboardTab />
        </div>

        {/* التابة 2: Requests */}
        <div style={{ display: activeTab === 'requests' ? 'block' : 'none', padding: '20px', height: '100%', overflowY: 'auto' }}>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: 'var(--accent-blue)' }}>Pending Requests</h2>
              {selectedRequests.length > 0 && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleBulkApprove} disabled={isProcessing} style={{ backgroundColor: 'var(--accent-green-bg)', color: 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: isProcessing ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: isProcessing ? 0.7 : 1 }}>
                    {isProcessing ? 'Processing...' : `Approve Selected (${selectedRequests.length})`}
                  </button>
                  <button onClick={() => openRejectModal(null, true)} disabled={isProcessing} style={{ backgroundColor: 'var(--accent-red-bg)', color: 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: isProcessing ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: isProcessing ? 0.7 : 1 }}>
                    {isProcessing ? 'Processing...' : `Reject Selected (${selectedRequests.length})`}
                  </button>
                </div>
              )}
            </div>
            {requests.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No pending requests.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px', width: '40px' }}>
                      <input 
                        type="checkbox" 
                        checked={requests.length > 0 && selectedRequests.length === requests.length}
                        onChange={toggleSelectAll}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ padding: '12px' }}>Unit ID</th>
                    <th style={{ padding: '12px' }}>Customer Name</th>
                    <th style={{ padding: '12px' }}>Phone</th>
                    <th style={{ padding: '12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req: { _id: string, objectId?: number, unitId: string, userId?: { name: string, phone: string } }) => (
                    <tr key={req._id} style={{ borderTop: '1px solid var(--border-color)', backgroundColor: selectedRequests.includes(req._id) ? 'var(--accent-blue-bg)22' : 'transparent' }}>
                      <td style={{ padding: '12px' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedRequests.includes(req._id)}
                          onChange={() => toggleSelect(req._id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '12px' }}>#{req.objectId || req.unitId}</td>
                      <td style={{ padding: '12px' }}>{req.userId?.name}</td>
                      <td style={{ padding: '12px' }}>{req.userId?.phone}</td>
                      <td style={{ padding: '12px' }}>
                        <button onClick={() => handleApprove(req._id)} style={{ marginRight: '10px', backgroundColor: 'var(--accent-green-bg)', color: 'var(--text-primary)', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>Approve</button>
                        <button onClick={() => openRejectModal(req._id, false)} style={{ backgroundColor: 'var(--accent-red-bg)', color: 'var(--text-primary)', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>Reject</button>
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
        <div style={{ display: activeTab === 'roles' ? 'block' : 'none', height: '100%', overflowY: 'auto' }}>
          <RolesWidget />
        </div>

        {/* التابة الرابعة: إدارة العقارات */}
        <div style={{ display: activeTab === 'properties' ? 'block' : 'none', height: '100%', overflowY: 'auto' }}>
          <PropertyManagementTab />
        </div>

        {/* التابة الخامسة: تحليل الرفضات */}
        <div style={{ display: activeTab === 'rejections' ? 'flex' : 'none', height: '100%', flexDirection: 'column', overflowY: 'auto' }}>
          <RejectionAnalysisTab />
        </div>

      {/* Reject Modal */}
      {rejectModalState && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={closeRejectModal} />
          <div style={{ position: 'relative', width: '400px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', zIndex: 3001, overflow: 'hidden' }}>
            <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
              <h3 style={{ margin: 0, color: 'var(--accent-red)' }}>
                {rejectModalState.isBulk ? `Reject ${selectedRequests.length} Requests` : 'Reject Request'}
              </h3>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 'bold' }}>Reason for Rejection *</label>
                <select 
                  value={rejectReason} 
                  onChange={(e) => setRejectReason(e.target.value)}
                  style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                >
                  <option value="" disabled>Select a reason...</option>
                  {adminRejectReasonsList.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 'bold' }}>Extra Notes (Optional)</label>
                <textarea 
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Provide any additional details..."
                  style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', minHeight: '80px', resize: 'vertical' }}
                />
              </div>
            </div>
            <div style={{ padding: '15px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: 'var(--bg-primary)' }}>
              <button 
                onClick={closeRejectModal} 
                style={{ backgroundColor: 'transparent', border: '1px solid var(--text-muted)', color: 'var(--text-muted)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Cancel
              </button>
              <button 
                onClick={submitReject} 
                disabled={!rejectReason || isProcessing}
                style={{ backgroundColor: rejectReason ? 'var(--accent-red-bg)' : '#444c56', color: 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: rejectReason ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}
              >
                {isProcessing ? 'Processing...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* التابة السادسة: الذكاء الاصطناعي */}
      <div style={{ display: activeTab === 'chatbot' ? 'flex' : 'none', height: '100%', flexDirection: 'column', overflowY: 'hidden' }}>
        <AdminAIChatbotTab 
          onAssignUnits={(userId, role) => setChatbotAssignUser({ id: userId, role })} 
        />
      </div>

      {/* Catalog Modal opened by AI */}
      {chatbotAssignUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10000 }}>
          <PropertyAssignCatalog
            userId={chatbotAssignUser.id}
            targetRole={chatbotAssignUser.role as any}
            pendingRoleData={{ manualId: '', newRole: '' as any }} // Dummy data since role is already committed
            roleAlreadyCommitted={true}
            onClose={() => setChatbotAssignUser(null)}
            onSuccess={() => {
              setChatbotAssignUser(null);
              alert('✅ تم تعيين الوحدات بنجاح!');
            }}
          />
        </div>
      )}

      </div>
    </div>
  );
};

export default AdminPortal;