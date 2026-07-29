import { useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';

interface Message {
  _id?: string;
  senderId: { _id: string; name: string; role: string } | string;
  senderName: string;
  senderRole: string;
  text: string;
  timestamp: string;
}

interface ComplaintChatModalProps {
  complaint: any;
  onClose: () => void;
  onRefresh: () => void;
  currentUser: { id: string; name: string; role: string };
}

const ComplaintChatModal = ({ complaint, onClose, onRefresh, currentUser }: ComplaintChatModalProps) => {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${import.meta.env.VITE_API_URL}/api/complaints/${complaint._id}/messages`, {
        text,
        senderName: currentUser.name,
        senderRole: currentUser.role
      }, {
        headers: { 'x-auth-token': token }
      });
      setText('');
      onRefresh(); // Trigger a refetch of complaints in the parent component
    } catch (error) {
      console.error("Error sending message", error);
      alert("Failed to send message.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'var(--bg-primary)', padding: '0', borderRadius: '12px', width: '600px', maxWidth: '90vw', height: '70vh', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{complaint.problemName || complaint.title}</h3>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Status: <span style={{ color: 'var(--accent-blue)' }}>{complaint.status}</span> | Priority: <span style={{ color: complaint.priority === 'High' ? 'var(--accent-red)' : '#3fb950' }}>{complaint.priority}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#ff7b72', fontSize: '24px', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Chat Messages */}
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: 'var(--bg-primary)' }}>
          {(!complaint.messages || complaint.messages.length === 0) ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '20px' }}>No messages yet.</div>
          ) : (
            complaint.messages.map((msg: Message, i: number) => {
              const isMe = msg.senderName === currentUser.name || (msg.senderId && typeof msg.senderId === 'object' ? msg.senderId._id === currentUser.id : msg.senderId === currentUser.id);
              
              let bgColor = 'var(--bg-tertiary)'; // Default (Owner or other)
              let badgeText = '';
              let badgeColor = '';
              
              if (msg.senderRole === 'admin') {
                bgColor = isMe ? '#6e40c9' : '#8957e5';
                badgeText = 'Admin';
                badgeColor = '#d2a8ff';
              } else if (msg.senderRole === 'engineer') {
                bgColor = isMe ? '#d23a1a' : '#e34c26';
                badgeText = 'Engineer';
                badgeColor = '#ffa657';
              } else if (msg.senderRole === 'owner') {
                bgColor = isMe ? 'var(--accent-blue-bg)' : 'var(--bg-tertiary)';
                badgeText = 'Owner';
                badgeColor = 'var(--text-muted)';
              } else if (isMe) {
                bgColor = 'var(--accent-blue-bg)';
              }

              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {badgeText && (
                      <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: badgeColor, padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                        {badgeText}
                      </span>
                    )}
                    {msg.senderName} • {new Date(msg.timestamp).toLocaleString()}
                  </div>
                  <div style={{ 
                    backgroundColor: bgColor, 
                    color: 'var(--text-primary)', 
                    padding: '10px 14px', 
                    borderRadius: '16px', 
                    borderBottomRightRadius: isMe ? '4px' : '16px',
                    borderBottomLeftRadius: !isMe ? '4px' : '16px',
                    maxWidth: '80%',
                    wordWrap: 'break-word',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                  }}>
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Message Input Form */}
        <form onSubmit={handleSendMessage} style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your message..."
            style={{ flex: 1, padding: '12px', borderRadius: '20px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}
          />
          <button 
            type="submit" 
            disabled={isSubmitting || !text.trim()} 
            style={{ padding: '10px 20px', borderRadius: '20px', border: 'none', backgroundColor: 'var(--accent-green)', color: 'var(--text-primary)', fontWeight: 'bold', cursor: isSubmitting || !text.trim() ? 'not-allowed' : 'pointer', opacity: isSubmitting || !text.trim() ? 0.5 : 1 }}
          >
            {isSubmitting ? '...' : 'Send'}
          </button>
        </form>

      </div>
    </div>,
    document.body
  );
};

export default ComplaintChatModal;
