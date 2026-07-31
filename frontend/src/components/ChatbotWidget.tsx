import { useState, useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import VoiceInput from './VoiceInput';

interface ChatSession {
  _id: string;
  title: string;
  messages: { sender: 'user' | 'bot'; text: string }[];
  updatedAt: string;
  isPinned?: boolean;
}

const engineerQuestions = [
  "What are the specs for PRV replacement?",
  "What is the required MCB breaking capacity?",
  "Which epoxy resin for structural crack injection?",
  "What are the elevator VFD jerk rate parameters?"
];

const ChatbotWidget = () => {
  const auth = useContext(AuthContext);
  const role = auth?.user?.role || 'user';
  const isEngineer = role === 'engineer';
  const suggestedQuestions = engineerQuestions;

  const [isOpen, setIsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<{ sender: 'user' | 'bot'; text: string }[]>([]);

  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [editChatId, setEditChatId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState('');

  const fetchChats = async () => {
    try {
      const res = await axios.get(import.meta.env.VITE_API_URL + '/api/ai/chats', {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      if (res.data.length > 0) {
        setChatSessions(res.data);
        setCurrentChatId(res.data[0]._id);
        setMessages(res.data[0].messages);
      } else {
        startNewChat();
      }
    } catch (err) {
      console.error("Error fetching chats", err);
    }
  };

  const startNewChat = async () => {
    try {
      const newSession = {
        title: 'New Chat',
        messages: [{ sender: 'bot', text: 'Hello Engineer! I am your AI facility management assistant. How can I help you today?' }]
      };
      const res = await axios.post(import.meta.env.VITE_API_URL + '/api/ai/chats', newSession, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setChatSessions(prev => [res.data, ...prev]);
      setCurrentChatId(res.data._id);
      setMessages(res.data.messages);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchChats();
    }
  }, [isOpen]);

  const syncChat = async (chatId: string | null, updatedMessages: any[]) => {
    if (!chatId) return;
    try {
      const currentSession = chatSessions.find(c => c._id === chatId);
      if (currentSession && currentSession.title === 'New Chat') {
        const firstUserMsg = updatedMessages.find((m:any) => m.sender === 'user');
        if (firstUserMsg) {
           axios.post(import.meta.env.VITE_API_URL + '/api/ai/generate-title', { firstMessage: firstUserMsg.text })
             .then(res => {
                axios.put(import.meta.env.VITE_API_URL + '/api/ai/chats/' + chatId, { title: res.data.title }, { headers: { 'x-auth-token': localStorage.getItem('token') }})
                .then(() => fetchChats());
             });
        }
      }
      await axios.put(import.meta.env.VITE_API_URL + '/api/ai/chats/' + chatId, {
        messages: updatedMessages
      }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      fetchChats();
    } catch (err) {
      console.error("Sync error", err);
    }
  };

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat?')) return;
    try {
      await axios.delete(import.meta.env.VITE_API_URL + '/api/ai/chats/' + id, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      fetchChats();
    } catch (err) {
      console.error(err);
    }
  };

  const pinChat = async (id: string, isPinned: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await axios.put(import.meta.env.VITE_API_URL + '/api/ai/chats/' + id, { isPinned: !isPinned }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      fetchChats();
    } catch (err) {
      console.error(err);
    }
  };

  const saveTitle = async (id: string) => {
    if (!editTitleText.trim()) {
      setEditChatId(null);
      return;
    }
    try {
      await axios.put(import.meta.env.VITE_API_URL + '/api/ai/chats/' + id, { title: editTitleText }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setEditChatId(null);
      fetchChats();
    } catch (err) {
      console.error(err);
    }
  };

  const renderChatSidebarItem = (chat: ChatSession) => {
    const isEditing = editChatId === chat._id;
    return (
      <div 
        key={chat._id}
        onClick={() => {
          if (!isEditing) {
            setCurrentChatId(chat._id);
            setMessages(chat.messages);
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }
        }}
        style={{
          padding: '10px 15px',
          cursor: 'pointer',
          backgroundColor: currentChatId === chat._id ? 'var(--accent-blue-bg)' : 'transparent',
          borderLeft: currentChatId === chat._id ? '3px solid var(--accent-blue)' : '3px solid transparent',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'background 0.2s'
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = currentChatId === chat._id ? 'var(--accent-blue-bg)' : 'var(--bg-tertiary)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = currentChatId === chat._id ? 'var(--accent-blue-bg)' : 'transparent'}
      >
        {isEditing ? (
          <input 
            autoFocus
            value={editTitleText}
            onChange={(e) => setEditTitleText(e.target.value)}
            onBlur={() => saveTitle(chat._id)}
            onKeyDown={(e) => e.key === 'Enter' && saveTitle(chat._id)}
            onClick={(e) => e.stopPropagation()}
            style={{ flex: 1, padding: '4px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--accent-blue)', borderRadius: '4px', fontSize: '13px' }}
          />
        ) : (
          <span style={{ color: currentChatId === chat._id ? '#ffffff' : 'var(--text-primary)', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px', fontWeight: currentChatId === chat._id ? 'bold' : 'normal' }}>
            {chat.title}
          </span>
        )}
        
        {!isEditing && (
          <div style={{ display: 'flex', gap: '5px' }}>
             <button onClick={(e) => {
               e.stopPropagation();
               setEditChatId(chat._id);
               setEditTitleText(chat.title);
             }} title="Rename" style={{ background:'none', border:'none', color: currentChatId === chat._id ? '#ffffff' : 'var(--text-muted)', cursor:'pointer', padding: '2px', display: 'flex', opacity: currentChatId === chat._id ? 0.9 : 1 }}>
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
             </button>
             <button onClick={(e) => pinChat(chat._id, !!chat.isPinned, e)} title={chat.isPinned ? "Unpin" : "Pin"} style={{ background:'none', border:'none', color: chat.isPinned ? (currentChatId === chat._id ? '#ffffff' : 'var(--accent-blue)') : (currentChatId === chat._id ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)'), cursor:'pointer', padding: '2px', display: 'flex' }}>
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
             </button>
             <button onClick={(e) => deleteChat(chat._id, e)} title="Delete" style={{ background:'none', border:'none', color: currentChatId === chat._id ? '#ffcccc' : 'var(--accent-red)', cursor:'pointer', padding: '2px', display: 'flex' }}>
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
             </button>
          </div>
        )}
      </div>
    );
  };

  const sendQuestionToAPI = async (questionText: string) => {
    if (isLoading) return;
    const newMessages = [...messages, { sender: 'user' as const, text: questionText }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const endpoint = isEngineer ? '/api/ai/engineer-ask' : '/api/ai/ask';
      const payload = isEngineer ? { question: questionText } : { question: questionText, contextData: [] };
      
      const response = await axios.post(`${import.meta.env.VITE_API_URL}${endpoint}`, payload);

      const finalMessages = [...newMessages, { sender: 'bot' as const, text: response.data.reply }];
      setMessages(finalMessages);
      
      if (currentChatId) {
        syncChat(currentChatId, finalMessages);
      }
    } catch (error) {
      console.error("Error asking engineer AI:", error);
      setMessages(prev => [...prev, { sender: 'bot' as const, text: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
          backgroundColor: 'var(--bg-secondary)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px', 
          display: 'flex', 
          flexDirection: 'column', 
          marginBottom: '15px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-tertiary)', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '20px', cursor: 'pointer', padding: '0 5px' }}
              >
                ☰
              </button>
              🤖 AI Support
            </span>
            <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✖</button>
          </div>

          {/* Main Content Wrapper */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
            
            {/* Sidebar (Slide-out) */}
            <div style={{
              position: 'absolute',
              left: isSidebarOpen ? 0 : '-250px',
              top: 0,
              bottom: 0,
              width: '250px',
              backgroundColor: 'var(--bg-secondary)',
              borderRight: '1px solid var(--border-color)',
              transition: 'left 0.3s ease',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: isSidebarOpen ? '4px 0 15px rgba(0,0,0,0.2)' : 'none'
            }}>
              <div style={{ padding: '15px' }}>
                <button onClick={startNewChat} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--accent-blue-bg)', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  New Chat
                </button>
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {chatSessions.filter(c => c.isPinned).length > 0 && (
                  <div style={{ marginBottom: '15px' }}>
                    <div style={{ padding: '0 15px 5px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>PINNED CHATS</div>
                    {chatSessions.filter(c => c.isPinned).map(chat => renderChatSidebarItem(chat))}
                  </div>
                )}
                
                <div>
                  <div style={{ padding: '0 15px 5px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>RECENT CHATS</div>
                  {chatSessions.filter(c => !c.isPinned).map(chat => renderChatSidebarItem(chat))}
                </div>
              </div>
            </div>
            
            {/* Chat Column */}
            <div 
              style={{ flex: 1, display: 'flex', flexDirection: 'column', opacity: isSidebarOpen ? 0.3 : 1, transition: 'opacity 0.3s', pointerEvents: isSidebarOpen ? 'none' : 'auto' }}
              onClick={() => isSidebarOpen && setIsSidebarOpen(false)}
            >
              <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* Suggested Questions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px', padding: '0 4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Suggested Questions:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {suggestedQuestions.map((q, idx) => (
                      <button 
                        key={idx}
                        onClick={() => handleSuggestedClick(q.split(' (')[0])}
                        style={{
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--accent-blue)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '16px',
                          padding: '6px 12px',
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s',
                          textAlign: 'left'
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {messages.map((m, i) => (
                  <div key={i} style={{ 
                    alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', 
                    backgroundColor: m.sender === 'user' ? 'var(--accent-blue-bg)' : 'var(--bg-tertiary)', 
                    color: m.sender === 'user' ? '#ffffff' : 'var(--text-primary)',
                    padding: '10px 14px', 
                    borderRadius: '12px', 
                    borderBottomRightRadius: m.sender === 'user' ? '2px' : '12px', 
                    borderBottomLeftRadius: m.sender === 'bot' ? '2px' : '12px', 
                    maxWidth: '85%', 
                    fontSize: '14px', 
                    lineHeight: '1.5', 
                    direction: 'ltr', 
                    whiteSpace: 'pre-wrap',
                    border: m.sender === 'bot' ? '1px solid var(--border-color)' : 'none'
                  }}>
                    {m.text}
                  </div>
                ))}
                
                {isLoading && <div style={{ fontSize: '13px', color: 'var(--text-muted)', alignSelf: 'flex-start' }}>Thinking...</div>}
              </div>
            </div>
          </div>

          {/* Input Area */}
          <form onSubmit={handleSend} style={{ display: 'flex', padding: '12px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', zIndex: 11, gap: '8px' }}>
            <input 
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder="Type your message..." 
              disabled={isLoading}
              style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', opacity: isLoading ? 0.6 : 1 }}
            />
            <VoiceInput 
              disabled={isLoading}
              onTextCapture={(text) => setInput(prev => (prev + ' ' + text).trim())} 
            />
            <button type="submit" disabled={isLoading} style={{ padding: '10px 15px', backgroundColor: 'var(--accent-green-bg)', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: isLoading ? 0.6 : 1 }}>
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
