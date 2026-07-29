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
  const [decliningRequestId, setDecliningRequestId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState<string>('');
  const [declineNotes, setDeclineNotes] = useState<string>('');

  const declineReasonsList = [
    'Client Unresponsive',
    'Changed mind',
    'Spam or fake info',
    'Duplicate Request',
    'Insufficient Budget',
    'Rejected payment plan'
  ];

  const handleAction = async (requestId: string, action: 'raise' | 'decline') => {
    let reason = '';
    let notes = '';

    if (action === 'decline') {
      if (!declineReason) {
        alert("Please select a reason for declining.");
        return;
      }
      reason = declineReason;
      notes = declineNotes;
    } else {
      if (!window.confirm("Are you sure you want to raise this request? This will mark the unit as Reserved.")) return;
    }

    try {
      setProcessingId(requestId);
      await axios.post(`${import.meta.env.VITE_API_URL}/api/bookings/broker-review/${requestId}`, {
        action,
        reason,
        notes
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      alert(`Request ${action === 'raise' ? 'Raised' : 'Declined'} successfully!`);
      
      // Reset decline states
      setDecliningRequestId(null);
      setDeclineReason('');
      setDeclineNotes('');

      onRefresh();
    } catch (error: any) {
      console.error('Error processing request:', error);
      alert(error.response?.data?.error || error.response?.data?.msg || `Failed to ${action} request`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineClick = (requestId: string) => {
    setDecliningRequestId(requestId);
    setDeclineReason('');
    setDeclineNotes('');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2100 }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={onClose} />
      
      <div style={{ position: 'relative', width: '600px', maxHeight: '80vh', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', zIndex: 2101, overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--accent-blue)' }}>
              Requests for {unit.unitName?.includes('شقة') ? 'Apartment' : unit.unitName?.includes('فيلا') ? 'Villa' : unit.unitName || 'Unit'} #{unit.objectId || unit.OBJECTID || unit.arcgisId}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>✖</button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {requests.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>No pending requests for this unit.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {(() => {
                const isAnyReserved = requests.some(r => r.status === 'Reserved');
                return requests.map((req) => (
                  <div key={req._id} style={{ backgroundColor: 'var(--bg-primary)', border: `1px solid ${req.status === 'Reserved' ? 'var(--accent-gold)' : 'var(--border-color)'}`, borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>{req.customerName}</h4>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {new Date(req.createdAt).toLocaleString()}
                      </span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <div>📞 {req.customerPhone}</div>
                      <div>✉️ {req.customerGmail}</div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      {req.status === 'Reserved' ? (
                        <div style={{ flex: 1, backgroundColor: 'var(--accent-gold)22', color: 'var(--accent-gold)', padding: '8px', borderRadius: '6px', textAlign: 'center', fontWeight: 'bold', border: '1px solid var(--accent-gold)' }}>
                          ⏳ Under Admin Review
                        </div>
                      ) : (
                        <>
                          {decliningRequestId === req._id ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'var(--bg-tertiary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <h5 style={{ margin: 0, color: 'var(--text-primary)' }}>Provide Decline Reason</h5>
                              <select 
                                value={declineReason} 
                                onChange={(e) => setDeclineReason(e.target.value)}
                                style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                              >
                                <option value="" disabled>Select a reason...</option>
                                {declineReasonsList.map(r => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                              
                              <textarea 
                                value={declineNotes}
                                onChange={(e) => setDeclineNotes(e.target.value)}
                                placeholder="Extra notes (optional)"
                                style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', minHeight: '60px', resize: 'vertical' }}
                              />
                              
                              <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                                <button
                                  onClick={() => handleAction(req._id, 'decline')}
                                  disabled={processingId === req._id || !declineReason}
                                  style={{ flex: 1, backgroundColor: declineReason ? 'var(--accent-red-bg)' : '#444c56', color: 'var(--text-primary)', border: 'none', padding: '8px', borderRadius: '6px', cursor: declineReason ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}
                                >
                                  {processingId === req._id ? 'Processing...' : 'Confirm Decline'}
                                </button>
                                <button
                                  onClick={() => setDecliningRequestId(null)}
                                  disabled={processingId === req._id}
                                  style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid var(--text-muted)', color: 'var(--text-muted)', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => handleAction(req._id, 'raise')}
                                disabled={processingId === req._id || isAnyReserved}
                                style={{ flex: 1, backgroundColor: isAnyReserved ? '#444c56' : 'var(--accent-green-bg)', color: isAnyReserved ? 'var(--text-muted)' : 'var(--text-primary)', border: 'none', padding: '8px', borderRadius: '6px', cursor: isAnyReserved ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                                title={isAnyReserved ? "Another request is currently under review." : ""}
                              >
                                {processingId === req._id ? 'Processing...' : '⬆️ Raise to Admin'}
                              </button>
                              <button
                                onClick={() => handleDeclineClick(req._id)}
                                disabled={processingId === req._id}
                                style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                ✖ Decline
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default BrokerUnitRequestsModal;
