import { useState } from 'react';
import axios from 'axios';

interface RequestData {
  _id: string;
  customerName: string;
  customerPhone: string;
  customerGmail: string;
  createdAt: string;
  status: string;
}

interface BrokerUnitRequestsModalProps {
  unit: any;
  requests: RequestData[];
  onClose: () => void;
  onRefresh: () => void;
}

const BrokerUnitRequestsModal = ({ unit, requests, onClose, onRefresh }: BrokerUnitRequestsModalProps) => {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAction = async (requestId: string, action: 'raise' | 'decline') => {
    let reason = '';
    if (action === 'decline') {
      reason = window.prompt("Please provide a reason for declining this request:") || '';
      if (!reason.trim()) return; // Require reason
    } else {
      if (!window.confirm("Are you sure you want to raise this request? This will mark the unit as Reserved.")) return;
    }

    try {
      setProcessingId(requestId);
      await axios.post(`${import.meta.env.VITE_API_URL}/api/bookings/broker-review/${requestId}`, {
        action,
        reason
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      alert(`Request ${action === 'raise' ? 'Raised' : 'Declined'} successfully!`);
      onRefresh();
    } catch (error: any) {
      console.error('Error processing request:', error);
      alert(error.response?.data?.error || error.response?.data?.msg || `Failed to ${action} request`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2100 }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={onClose} />
      
      <div style={{ position: 'relative', width: '600px', maxHeight: '80vh', backgroundColor: '#161b22', borderRadius: '12px', border: '1px solid #30363d', display: 'flex', flexDirection: 'column', zIndex: 2101, overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid #30363d', backgroundColor: '#0d1117', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: '#58a6ff' }}>Requests for {unit.unitName || 'Unit'} #{unit.objectId || unit.OBJECTID}</h3>
            <p style={{ margin: '4px 0 0', color: '#8b949e', fontSize: '13px' }}>
              Handle incoming interests. FIFO (Oldest first) priority is recommended.
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #30363d', color: '#8b949e', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>✖</button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {requests.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8b949e', padding: '40px 0' }}>No pending requests for this unit.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {requests.map((req, index) => (
                <div key={req._id} style={{ backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, color: '#e6edf3' }}>{req.customerName}</h4>
                    <span style={{ fontSize: '12px', color: '#8b949e' }}>
                      {new Date(req.createdAt).toLocaleString()}
                    </span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px', fontSize: '13px', color: '#c9d1d9' }}>
                    <div>📞 {req.customerPhone}</div>
                    <div>✉️ {req.customerGmail}</div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handleAction(req._id, 'raise')}
                      disabled={processingId === req._id}
                      style={{ flex: 1, backgroundColor: '#238636', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      {processingId === req._id ? 'Processing...' : '⬆️ Raise to Admin (Reserve)'}
                    </button>
                    <button
                      onClick={() => handleAction(req._id, 'decline')}
                      disabled={processingId === req._id}
                      style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid #f85149', color: '#f85149', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      {processingId === req._id ? 'Processing...' : '✖ Decline'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default BrokerUnitRequestsModal;
