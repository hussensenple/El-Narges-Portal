import { useState } from 'react';
import { createPortal } from 'react-dom';

const ChatbotWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ sender: 'user' | 'bot'; text: string }[]>([
    { sender: 'bot', text: 'Hello! I am your AI assistant. How can I help you today?' }
  ]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    setMessages(prev => [...prev, { sender: 'user', text: input }]);
    const currentInput = input;
    setInput('');

    // Placeholder for future RAG / Backend integration
    setTimeout(() => {
      setMessages(prev => [...prev, { sender: 'bot', text: `(Placeholder reply to: "${currentInput}") RAG backend will be integrated here later.` }]);
    }, 1000);
  };

  return createPortal(
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999999 }}>
      {isOpen && (
        <div style={{ 
          width: '350px', 
          height: '500px', 
          backgroundColor: '#0d1117', 
          border: '1px solid #30363d', 
          borderRadius: '12px', 
          display: 'flex', 
          flexDirection: 'column', 
          marginBottom: '15px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{ padding: '15px', backgroundColor: '#161b22', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
              🤖 AI Support
            </span>
            <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: '20px', cursor: 'pointer' }}>✖</button>
          </div>

          {/* Chat History */}
          <div style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ 
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.sender === 'user' ? '#1f6feb' : '#21262d',
                color: '#fff',
                padding: '10px 14px',
                borderRadius: '12px',
                borderBottomRightRadius: msg.sender === 'user' ? '2px' : '12px',
                borderBottomLeftRadius: msg.sender === 'bot' ? '2px' : '12px',
                maxWidth: '85%',
                fontSize: '14px',
                lineHeight: '1.4'
              }}>
                {msg.text}
              </div>
            ))}
          </div>

          {/* Input Area */}
          <form onSubmit={handleSend} style={{ display: 'flex', padding: '10px', borderTop: '1px solid #30363d', backgroundColor: '#161b22' }}>
            <input 
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder="Type your message..." 
              style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #30363d', backgroundColor: '#010409', color: '#fff' }}
            />
            <button type="submit" style={{ marginLeft: '10px', padding: '10px 15px', backgroundColor: '#1f6feb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              Send
            </button>
          </form>
        </div>
      )}

      {/* Floating Toggle Button */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          style={{
            width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#1f6feb', 
            color: '#fff', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center',
            fontSize: '28px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
            marginLeft: 'auto'
          }}
          title="Open Chatbot"
        >
          🤖
        </button>
      )}
    </div>,
    document.body
  );
};

export default ChatbotWidget;
