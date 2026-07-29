import { useState, useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

const engineerQuestions = [
  "What are the specs for PRV replacement? (ما هي مواصفات تغيير مخفض الضغط PRV؟)",
  "What is the required MCB breaking capacity? (ما هي قدرة الفصل المطلوبة لقاطع MCB؟)",
  "Which epoxy resin for structural crack injection? (ما هو الإيبوكسي المناسب لحقن الشروخ؟)",
  "What are the elevator VFD jerk rate parameters? (ما هي بارامترات مغير سرعة المصعد؟)"
];

const userQuestions = [
  "What is the ROI on villas vs apartments?",
  "Which villas are near the school and gym?",
  "Where is the compound located exactly?",
  "Can I lease my property to third party tenants?"
];

const ChatbotWidget = () => {
  const auth = useContext(AuthContext);
  const role = auth?.user?.role || 'user';
  const isEngineer = role === 'engineer';
  const suggestedQuestions = isEngineer ? engineerQuestions : userQuestions;

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<{ sender: 'user' | 'bot'; text: string }[]>([]);

  useEffect(() => {
    setMessages([{ 
      sender: 'bot', 
      text: isEngineer 
        ? 'Hello Engineer! I am your AI facility management assistant. How can I help you today?' 
        : 'Hello! I am your El Narges AI Advisor. How can I help you find your dream home or manage your property?'
    }]);
  }, [isEngineer]);

  const sendQuestionToAPI = async (questionText: string) => {
    if (isLoading) return;
    setMessages(prev => [...prev, { sender: 'user', text: questionText }]);
    setIsLoading(true);

    try {
      const endpoint = isEngineer ? '/api/ai/engineer-ask' : '/api/ai/ask';
      const payload = isEngineer ? { question: questionText } : { question: questionText, contextData: [] };
      
      const response = await axios.post(`${import.meta.env.VITE_API_URL}${endpoint}`, payload);

      setMessages(prev => [...prev, { sender: 'bot', text: response.data.reply }]);
    } catch (error) {
      console.error("Error asking engineer AI:", error);
      setMessages(prev => [...prev, { sender: 'bot', text: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const currentInput = input;
    setInput('');
    await sendQuestionToAPI(currentInput);
  };

  const handleSuggestedClick = (question: string) => {
    sendQuestionToAPI(question);
  };

  return createPortal(
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999999 }}>
      {isOpen && (
        <div style={{ 
          width: '350px', 
          height: '500px', 
          backgroundColor: 'var(--bg-primary)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px', 
          display: 'flex', 
          flexDirection: 'column', 
          marginBottom: '15px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{ padding: '15px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
              🤖 AI Support
            </span>
            <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✖</button>
          </div>

          {/* Chat History */}
          <div style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            {/* Suggested Questions at top */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Suggested Questions:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestedClick(q.split(' (')[0])}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border-color)',
                      color: 'var(--accent-blue)',
                      padding: '6px 10px',
                      borderRadius: '16px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.2s',
                      width: 'fit-content'
                    }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--accent-blue-bg)20'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ 
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.sender === 'user' ? 'var(--accent-blue-bg)' : 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                padding: '10px 14px',
                borderRadius: '12px',
                borderBottomRightRadius: msg.sender === 'user' ? '2px' : '12px',
                borderBottomLeftRadius: msg.sender === 'bot' ? '2px' : '12px',
                maxWidth: '85%',
                fontSize: '14px',
                lineHeight: '1.4',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.text}
              </div>
            ))}
            

            
            {isLoading && (
              <div style={{ 
                alignSelf: 'flex-start',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-muted)',
                padding: '10px 14px',
                borderRadius: '12px',
                borderBottomLeftRadius: '2px',
                fontSize: '14px'
              }}>
                Typing...
              </div>
            )}
          </div>

          {/* Input Area */}
          <form onSubmit={handleSend} style={{ display: 'flex', padding: '10px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
            <input 
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder="Type your message..." 
              disabled={isLoading}
              style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', opacity: isLoading ? 0.6 : 1 }}
            />
            <button type="submit" disabled={isLoading} style={{ marginLeft: '10px', padding: '10px 15px', backgroundColor: 'var(--accent-blue-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '8px', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: isLoading ? 0.6 : 1 }}>
              {isLoading ? '...' : 'Send'}
            </button>
          </form>
        </div>
      )}

      {/* Floating Toggle Button */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          style={{
            width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--accent-blue-bg)', 
            color: 'var(--text-primary)', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center',
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
