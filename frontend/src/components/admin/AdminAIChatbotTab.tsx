import React, { useState, useRef, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import VoiceInput from '../VoiceInput';

interface AdminAIChatbotTabProps {
  onAssignUnits: (userId: string, role: string) => void;
}

interface ChatSession {
  id: string;
  title: string;
  messages: {sender: string, text: string}[];
  updatedAt: number;
  isPinned?: boolean;
}

const AdminAIChatbotTab: React.FC<AdminAIChatbotTabProps> = ({ onAssignUnits }) => {
  const auth = useContext(AuthContext);
  const userId = (auth as any)?.user?.id || (auth as any)?.user?._id || 'unknown';
  const CHAT_HISTORY_KEY = `admin_ai_chat_history_${userId}_v2`;

  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  
  const [editChatId, setEditChatId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState('');

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [usersList, setUsersList] = useState<{username: string, role: string}[]>([]);
  const [mentionVisible, setMentionVisible] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch history from DB
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/chats`, {
          headers: { 'x-auth-token': token }
        });
        let loadedSessions = res.data.map((c: any) => ({ ...c, id: c._id }));

        // Recover lost old chats and upload them to the backend
        const oldSavedGeneric = localStorage.getItem('admin_ai_chat_history');
        if (oldSavedGeneric) {
          try {
            const oldParsed = JSON.parse(oldSavedGeneric);
            if (Array.isArray(oldParsed) && oldParsed.length > 0 && !oldParsed[0].id) {
              const migratedSession = { title: 'Previous Chat (Recovered)', messages: oldParsed, isPinned: false };
              const postRes = await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/chats`, migratedSession, {
                headers: { 'x-auth-token': token }
              });
              loadedSessions.push({ ...postRes.data, id: postRes.data._id });
              localStorage.removeItem('admin_ai_chat_history');
            }
          } catch (e) {}
        }
        
        // Also upload any v2 local chats that haven't been uploaded
        const savedV2 = localStorage.getItem(CHAT_HISTORY_KEY);
        if (savedV2) {
           try {
              const parsedV2 = JSON.parse(savedV2);
              if (Array.isArray(parsedV2)) {
                 for (const s of parsedV2) {
                    if (s.title === 'New Chat' && s.messages.length <= 1) continue;
                    // Don't duplicate if already in db (if they have similar title and updated time, etc.)
                    // Just simple push for now, usually won't conflict if they only used it briefly.
                    const postRes = await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/chats`, {
                       id: s.id.length === 24 ? s.id : undefined,
                       title: s.title,
                       messages: s.messages,
                       isPinned: s.isPinned
                    }, { headers: { 'x-auth-token': token }});
                    loadedSessions.push({ ...postRes.data, id: postRes.data._id });
                 }
              }
           } catch(e) {}
           localStorage.removeItem(CHAT_HISTORY_KEY);
        }
        
        if (loadedSessions.length > 0) {
          loadedSessions.sort((a: ChatSession, b: ChatSession) => {
            const timeA = typeof a.updatedAt === 'string' ? new Date(a.updatedAt).getTime() : a.updatedAt;
            const timeB = typeof b.updatedAt === 'string' ? new Date(b.updatedAt).getTime() : b.updatedAt;
            return timeB - timeA;
          });
          setChatSessions(loadedSessions);
          setCurrentChatId(loadedSessions[0].id);
        } else {
          startNewChat();
        }
      } catch (err) {
        console.error(err);
        startNewChat();
      }
    };
    fetchChats();
  }, [CHAT_HISTORY_KEY]);

  const startNewChat = async () => {
    try {
      const token = localStorage.getItem('token');
      const newSession = { 
        title: 'New Chat', 
        messages: [{ sender: 'ai', text: 'Welcome! I am your AI Admin Assistant. You can ask to change user roles, assign units, revoke permissions, and modify prices.' }]
      };
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/chats`, newSession, { headers: { 'x-auth-token': token }});
      const created = { ...res.data, id: res.data._id };
      setChatSessions(prev => [created, ...prev]);
      setCurrentChatId(created.id);
    } catch(err) {
      console.error(err);
    }
  };

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/api/admin/users/all`, {
      headers: { 'x-auth-token': localStorage.getItem('token') }
    }).then(res => setUsersList(res.data)).catch(err => console.error(err));
  }, []);

  const currentMessages = chatSessions.find(c => c.id === currentChatId)?.messages || [];

  const updateCurrentMessages = async (newMessages: {sender: string, text: string}[]) => {
    let newTitle = undefined;
    const currentSession = chatSessions.find(c => c.id === currentChatId);
    
    if (currentSession && currentSession.title === 'New Chat') {
      const firstUserMsg = newMessages.find(m => m.sender === 'user');
      if (firstUserMsg) {
        newTitle = 'Generating title...';
        generateAITitle(currentChatId!, firstUserMsg.text);
      }
    }
    
    const payload = {
      id: currentChatId,
      messages: newMessages,
      title: newTitle || currentSession?.title,
      isPinned: currentSession?.isPinned
    };
    
    setChatSessions(prev => prev.map(c => c.id === currentChatId ? { ...c, messages: newMessages, updatedAt: Date.now(), title: newTitle || c.title } : c));
    
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/chats`, payload, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
    } catch(err) { console.error(err); }
  };

  const generateAITitle = async (chatId: string, firstMessage: string) => {
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/ai/generate-title`, { firstMessage }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      const newTitle = res.data.title;
      setChatSessions(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle } : c));
      await axios.put(`${import.meta.env.VITE_API_URL}/api/admin/chats/${chatId}`, { title: newTitle }, { headers: { 'x-auth-token': localStorage.getItem('token') }});
    } catch (err) {
      const newTitle = firstMessage.substring(0, 30) + '...';
      setChatSessions(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle } : c));
      await axios.put(`${import.meta.env.VITE_API_URL}/api/admin/chats/${chatId}`, { title: newTitle }, { headers: { 'x-auth-token': localStorage.getItem('token') }});
    }
  };

  const handleDeleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this chat?')) {
      try {
        await axios.delete(`${import.meta.env.VITE_API_URL}/api/admin/chats/${id}`, {
          headers: { 'x-auth-token': localStorage.getItem('token') }
        });
        setChatSessions(prev => {
          const newSessions = prev.filter(c => c.id !== id);
          if (currentChatId === id) {
            setCurrentChatId(newSessions.length > 0 ? newSessions[0].id : null);
            if (newSessions.length === 0) setTimeout(startNewChat, 0);
          }
          return newSessions;
        });
      } catch (err) { console.error(err); }
    }
  };

  const handleRenameChat = (e: React.MouseEvent, id: string, currentTitle: string) => {
    e.stopPropagation();
    setEditChatId(id);
    setEditTitleText(currentTitle);
  };

  const handleTogglePin = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const chat = chatSessions.find(c => c.id === id);
    if (!chat) return;
    const newPinned = !chat.isPinned;
    setChatSessions(prev => prev.map(c => c.id === id ? { ...c, isPinned: newPinned } : c));
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/api/admin/chats/${id}`, { isPinned: newPinned }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
    } catch (err) { console.error(err); }
  };

  const submitRename = async (id: string) => {
    const newTitle = editTitleText.trim();
    if (newTitle) {
      setChatSessions(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
      try {
        await axios.put(`${import.meta.env.VITE_API_URL}/api/admin/chats/${id}`, { title: newTitle }, {
          headers: { 'x-auth-token': localStorage.getItem('token') }
        });
      } catch (err) { console.error(err); }
    }
    setEditChatId(null);
  };

  const getRelativeTime = (timestamp: number | string) => {
    const timeValue = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
    if (!timeValue || isNaN(timeValue)) return '';
    const diff = Date.now() - timeValue;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  const handleSend = async () => {
    if (!input.trim() || mentionVisible) return;
    const userMsg = input;
    setInput('');
    setMentionVisible(false);
    updateCurrentMessages([...currentMessages, { sender: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/ai/admin-ask`, { question: userMsg }, {
        headers: { 'x-auth-token': token }
      });
      
      const { reply, actions } = res.data;
      
      let finalReply = reply || '';

      if (actions && actions.length > 0) {
        for (const action of actions) {
          if (action.action === 'CHANGE_ROLE' && action.userId) {
            // Downgrade to user
            if (action.newRole === 'user') {
              if (action.currentRole === 'broker') {
                alert(`⚠️ Warning: You revoked Broker permissions from ${action.userName}. These units must be assigned to another broker otherwise they won't appear to buyers!`);
              }
              await axios.put(`${import.meta.env.VITE_API_URL}/api/roles/change-role/${action.userId}`, { newRole: 'user' }, { headers: { 'x-auth-token': token }});
              finalReply += `\n✅ Successfully changed role of ${action.userName} to regular user.`;
            } 
            // Upgrade to Owner/Broker
            else if (action.newRole === 'owner' || action.newRole === 'broker') {
              if (!action.unitsToAssign || action.unitsToAssign.length === 0) {
                // Change role first
                const manualId = `MN-${Math.floor(Math.random()*10000)}`;
                await axios.put(`${import.meta.env.VITE_API_URL}/api/roles/change-role/${action.userId}`, { newRole: action.newRole, manualId }, { headers: { 'x-auth-token': token }});
                
                // Open Catalog manually
                finalReply += `\n🔔 Opening unit selection for ${action.userName} as ${action.newRole}...`;
                onAssignUnits(action.userId, action.newRole);
              } else {
                // Change role first
                const manualId = `MN-${Math.floor(Math.random()*10000)}`;
                await axios.put(`${import.meta.env.VITE_API_URL}/api/roles/change-role/${action.userId}`, { newRole: action.newRole, manualId }, { headers: { 'x-auth-token': token }});
                
                // Fetch catalog to find the correct sourceLayer and objectId
                const catalogRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/roles/catalog?mode=all`, { headers: { 'x-auth-token': token }});
                const catalog = [...(catalogRes.data.units || []), ...(catalogRes.data.villas || [])];
                
                let assignedCount = 0;
                for (const unitId of action.unitsToAssign) {
                  const matchedProp = catalog.find((p: any) => p.arcgisId === String(unitId) || p.OBJECTID === Number(unitId));
                  if (matchedProp) {
                    await axios.post(`${import.meta.env.VITE_API_URL}/api/roles/assign-property`, {
                      userId: action.userId,
                      unitId: matchedProp.arcgisId,
                      targetRole: action.newRole,
                      sourceLayer: matchedProp.sourceLayer,
                      arcgisObjectId: matchedProp.OBJECTID,
                      isVilla: matchedProp.sourceLayer === 'Villas_Global'
                    }, { headers: { 'x-auth-token': token }});
                    assignedCount++;
                  }
                }
                finalReply += `\n✅ Successfully changed role of ${action.userName} to ${action.newRole} and assigned ${assignedCount} units.`;
              }
            } else {
              // Admin, Engineer
              const manualId = `MN-${Math.floor(Math.random()*10000)}`;
              await axios.put(`${import.meta.env.VITE_API_URL}/api/roles/change-role/${action.userId}`, { newRole: action.newRole, manualId }, { headers: { 'x-auth-token': token }});
              finalReply += `\n✅ Successfully changed role of ${action.userName} to ${action.newRole}.`;
            }
          } else if (action.action === 'UPDATE_PRICE_BY_MODEL') {
            try {
              const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/bulk-update-price`, {
                modelType: action.modelType,
                propertyType: action.propertyType,
                newPrice: action.newPrice
              }, { headers: { 'x-auth-token': token }});
              
              finalReply += `\n${res.data.message}`;
              // Dispatch event to trigger refresh in PropertyManagementTab
              window.dispatchEvent(new Event('pricesUpdated'));
            } catch (err: any) {
              console.error("Bulk Price Update Error:", err);
              finalReply += `\n❌ ${err.response?.data?.message || 'An error occurred while updating prices.'}`;
            }
          }
        }
      }

      updateCurrentMessages([...currentMessages, { sender: 'user', text: userMsg }, { sender: 'ai', text: finalReply }]);

    } catch (error) {
      console.error(error);
      updateCurrentMessages([...currentMessages, { sender: 'user', text: userMsg }, { sender: 'ai', text: '❌ An error occurred while processing your request.' }]);
    }
    setIsLoading(false);
  };

  const filteredUsers = usersList.filter(u => u.username?.toLowerCase().includes(mentionFilter)).slice(0, 5);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    const cursorPosition = e.target.selectionStart || 0;
    const textBeforeCursor = val.substring(0, cursorPosition);
    const words = textBeforeCursor.split(' ');
    const currentWord = words[words.length - 1];

    if (currentWord.startsWith('@')) {
      setMentionVisible(true);
      setMentionFilter(currentWord.substring(1).toLowerCase());
      setMentionIndex(0);
    } else {
      setMentionVisible(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionVisible && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filteredUsers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredUsers[mentionIndex].username);
      } else if (e.key === 'Escape') {
        setMentionVisible(false);
      }
    } else if (e.key === 'Enter') {
      handleSend();
    }
  };

  const insertMention = (username: string) => {
    const words = input.split(' ');
    words[words.length - 1] = `[${username}] `;
    setInput(words.join(' '));
    setMentionVisible(false);
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', backgroundColor: 'var(--bg-primary)' }}>
      
      {/* Sidebar for History */}
      <div style={{ width: '280px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-secondary)' }}>
        <div style={{ padding: '15px' }}>
          <button 
            onClick={startNewChat} 
            style={{ width: '100%', padding: '12px', backgroundColor: 'var(--accent-green-bg)', color: 'var(--text-primary)', border: '1px solid rgba(240, 246, 252, 0.1)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
          >
            <span>+</span> New Chat
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {chatSessions.sort((a,b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            const timeA = typeof a.updatedAt === 'string' ? new Date(a.updatedAt).getTime() : a.updatedAt;
            const timeB = typeof b.updatedAt === 'string' ? new Date(b.updatedAt).getTime() : b.updatedAt;
            return timeB - timeA;
          }).map(chat => (
            <div 
              key={chat.id} 
              onClick={() => setCurrentChatId(chat.id)} 
              style={{ 
                padding: '12px 15px', 
                cursor: 'pointer', 
                backgroundColor: currentChatId === chat.id ? '#1f2428' : 'transparent', 
                borderBottom: '1px solid var(--border-color)',
                borderLeft: currentChatId === chat.id ? '3px solid var(--accent-blue)' : '3px solid transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
              onMouseEnter={(e) => (e.currentTarget.lastElementChild as HTMLElement).style.opacity = '1'}
              onMouseLeave={(e) => (e.currentTarget.lastElementChild as HTMLElement).style.opacity = '0'}
            >
              {editChatId === chat.id ? (
                <input 
                  autoFocus
                  value={editTitleText}
                  onChange={e => setEditTitleText(e.target.value)}
                  onBlur={() => submitRename(chat.id)}
                  onKeyDown={e => e.key === 'Enter' && submitRename(chat.id)}
                  style={{ width: '100%', padding: '4px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--accent-blue)', borderRadius: '4px', outline: 'none' }}
                />
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    {chat.isPinned && <span style={{ fontSize: '13px', color: 'var(--accent-blue)' }}>★</span>}
                    <div style={{ color: currentChatId === chat.id ? 'var(--accent-blue)' : 'var(--text-secondary)', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                      {chat.title}
                    </div>
                  </div>
                  <div style={{ opacity: 0, transition: 'opacity 0.2s', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{getRelativeTime(chat.updatedAt)}</span>
                    <span title="Pin Chat" onClick={(e) => handleTogglePin(e, chat.id)} style={{ cursor: 'pointer', fontSize: '15px', color: 'var(--text-secondary)' }}>★</span>
                    <span title="Rename Chat" onClick={(e) => handleRenameChat(e, chat.id, chat.title)} style={{ cursor: 'pointer', fontSize: '15px', color: 'var(--text-secondary)' }}>✎</span>
                    <span title="Delete Chat" onClick={(e) => handleDeleteChat(e, chat.id)} style={{ cursor: 'pointer', fontSize: '15px', color: 'var(--accent-red)' }}>✕</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)' }}>
          <h3 style={{ margin: 0, color: 'var(--accent-blue)' }}>🤖 Admin AI Assistant</h3>
        </div>
        
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {currentMessages.map((msg, index) => (
            <div key={index} style={{ 
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              backgroundColor: msg.sender === 'user' ? 'var(--accent-blue-bg)' : 'var(--bg-tertiary)',
              color: msg.sender === 'user' ? '#ffffff' : 'var(--text-primary)',
              padding: '10px 15px',
              borderRadius: '8px',
              maxWidth: '75%',
              border: msg.sender === 'ai' ? '1px solid var(--border-color)' : 'none',
              whiteSpace: 'pre-wrap'
            }}>
              {msg.text}
            </div>
          ))}
          {isLoading && (
            <div style={{ alignSelf: 'flex-start', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              AI is analyzing your request...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

      {/* Presets (Quick Actions) */}
      <div style={{ padding: '10px 15px', display: 'flex', gap: '8px', overflowX: 'auto', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
        {[
          "Make the price of all ModelU apartments 5 million",
          "Make all TwinHouse villas cost 10,000,000",
          "Make @ owner of unit 123",
          "Make @ a broker",
          "Revoke permissions from @"
        ].map((preset, idx) => (
          <button 
            key={idx}
            onClick={() => {
              setInput(preset);
              if (preset.includes('@')) {
                setMentionVisible(true);
                setMentionFilter('');
              }
            }}
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '16px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {preset}
          </button>
        ))}
      </div>

      <div style={{ padding: '15px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          {mentionVisible && filteredUsers.length > 0 && (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, width: '100%', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', marginBottom: '5px', zIndex: 100, overflow: 'hidden' }}>
              {filteredUsers.map((u, i) => (
                <div 
                  key={i} 
                  onClick={() => insertMention(u.username)}
                  onMouseEnter={() => setMentionIndex(i)}
                  style={{ padding: '10px 15px', cursor: 'pointer', backgroundColor: i === mentionIndex ? 'var(--accent-blue-bg)' : 'transparent', color: 'var(--text-secondary)', borderBottom: i < filteredUsers.length - 1 ? '1px solid var(--border-color)' : 'none', display: 'flex', justifyContent: 'space-between' }}
                >
                  <span>{u.username}</span>
                  <span style={{ fontSize: '12px', color: i === mentionIndex ? 'var(--text-primary)' : 'var(--text-muted)', textTransform: 'capitalize' }}>{u.role}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ position: 'relative', width: '100%', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <div 
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                padding: '12px 15px', fontSize: '14px', fontFamily: 'inherit',
                color: 'var(--text-secondary)', pointerEvents: 'none', whiteSpace: 'pre',
                overflow: 'hidden'
              }}
            >
              {input === '' ? (
                <span style={{ color: 'var(--text-muted)' }}>Type your command here... (Use @ to select a user)</span>
              ) : (
                input.split(/(\[[^\]]+\])/g).map((part, i) => 
                  part.startsWith('[') && part.endsWith(']') 
                    ? <span key={i} style={{ color: 'var(--accent-blue)', backgroundColor: 'rgba(88, 166, 255, 0.2)', padding: '0 4px', borderRadius: '4px' }}>{part.slice(1, -1)}</span>
                    : <span key={i}>{part}</span>
                )
              )}
            </div>
            <input
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onScroll={(e) => {
                const overlay = e.currentTarget.previousElementSibling as HTMLDivElement;
                if (overlay) overlay.scrollLeft = e.currentTarget.scrollLeft;
              }}
              style={{ 
                width: '100%', padding: '12px 15px', fontSize: '14px', 
                backgroundColor: 'transparent', color: 'transparent', caretColor: 'var(--text-secondary)', 
                border: 'none', outline: 'none' 
              }}
            />
          </div>
        </div>

        <VoiceInput 
          disabled={isLoading}
          onTextCapture={(text) => setInput(prev => (prev + ' ' + text).trim())} 
        />

        <button  
          onClick={handleSend}
          disabled={isLoading}
          style={{ padding: '10px 20px', backgroundColor: 'var(--accent-green-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Send
        </button>
      </div>
    </div>
    </div>
  );
};

export default AdminAIChatbotTab;
