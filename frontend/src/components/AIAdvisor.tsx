import { useState, useRef } from 'react';
import SceneView from '@arcgis/core/views/SceneView';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import axios from 'axios';
import AuthModal from './AuthModal'; 

interface AIAdvisorProps {
  view: SceneView | null;
}

const AIAdvisor = ({ view }: AIAdvisorProps) => {
  const [isOpen, setIsOpen] = useState(false); 
  const [messages, setMessages] = useState<{sender: string, text: string, action?: string, actionUnitId?: number}[]>([
    { sender: 'ai', text: 'أهلاً بك في النرجس! كيف يمكنني مساعدتك في العثور على عقارك؟' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [isFilterActive, setIsFilterActive] = useState(false);
  const highlightHandleRef = useRef<any>(null);

  // المتغيرات للتحكم في اللوجن والحجز المعلق
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingBookingId, setPendingBookingId] = useState<number | null>(null);

  // التحقق من تسجيل الدخول
  const userToken = localStorage.getItem('token'); 
  const isUserLoggedIn = !!userToken;

  // دالة إلغاء الفلتر
  const handleResetFilter = () => {
    if (view && view.map) {
      const layer = view.map.layers.find(l => l.title === "Residential1") as FeatureLayer;
      if (layer) {
        layer.definitionExpression = "1=1"; 
        setIsFilterActive(false);
        if (highlightHandleRef.current) highlightHandleRef.current.remove();
      }
    }
  };

  // دالة التنفيذ الفعلي للحجز (تُستدعى بعد التأكد من تسجيل الدخول)
  const executeBooking = async (unitId: number) => {
    try {
      // 🚀 تم التعديل هنا: إضافة /request وتغيير الـ key لـ unitId
      await axios.post('http://localhost:5000/api/bookings/request', { 
        unitId: unitId 
      }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });

      setMessages(prev => [...prev, { 
        sender: 'ai', 
        text: `✅ تم إرسال طلب حجز الوحدة رقم ${unitId} للأدمن بنجاح! سيتم التواصل معك قريباً.` 
      }]);

    } catch (error) {
      console.error("Booking error:", error);
      setMessages(prev => [...prev, { sender: 'ai', text: '❌ عذراً، حدث خطأ أثناء محاولة الحجز.' }]);
    }
  };

  // دالة تأكيد الحجز (لما العميل يدوس على الزرار في الشات)
  const handleConfirmBooking = (unitId: number) => {
    if (!isUserLoggedIn) {
      // لو مش مسجل دخول، نعلق الحجز ونفتح المودال
      setPendingBookingId(unitId);
      setIsAuthModalOpen(true);
    } else {
      // لو مسجل، ننفذ فوراً
      executeBooking(unitId);
    }
  };

  // دالة تُستدعى لما اليوزر ينجح في تسجيل الدخول من المودال
  const handleLoginSuccess = () => {
    setIsAuthModalOpen(false);
    // لو في حجز متعلق، نفذه
    if (pendingBookingId !== null) {
      executeBooking(pendingBookingId);
      setPendingBookingId(null); // فضي الذاكرة
    }
  };

  // دالة إرسال الرسالة للـ AI
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await axios.post('http://localhost:5000/api/ai/ask', { question: userMsg });
      
      const { reply, targetUnitId, isFilterQuery, filteredIds, action, actionUnitId } = res.data; 

      // إضافة رد الذكاء الاصطناعي مع الأكشن
      setMessages(prev => [...prev, { sender: 'ai', text: reply, action: action, actionUnitId: actionUnitId }]); 

      if (view && view.map) {
        const layer = view.map.layers.find(l => l.title === "Residential1") as FeatureLayer;
        
        if (layer) {
          if (isFilterQuery && filteredIds && filteredIds.length > 0) {
            const expression = `OBJECTID IN (${filteredIds.join(',')})`;
            layer.definitionExpression = expression;
            setIsFilterActive(true); 

            const query = layer.createQuery();
            query.where = expression;
            const results = await layer.queryFeatures(query);
            if (results.features.length > 0) {
              view.goTo(results.features, { animate: true, duration: 2000 });
            }

          } else {
            layer.definitionExpression = "1=1";
            setIsFilterActive(false);

            if (targetUnitId) {
              const query = layer.createQuery();
              query.where = `OBJECTID = ${targetUnitId}`;
              query.returnGeometry = true;
              const results = await layer.queryFeatures(query);
              
              if (results.features.length > 0) {
                const feature = results.features[0];
                if (feature.geometry) {
                  view.goTo({ target: feature.geometry, tilt: 60, zoom: 20 }, { animate: true, duration: 2000 });
                }
                
                const layerView = await view.whenLayerView(layer);
                if (highlightHandleRef.current) highlightHandleRef.current.remove();
                highlightHandleRef.current = layerView.highlight(feature);
              }
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { sender: 'ai', text: 'عذراً، حدث خطأ في الاتصال بالخوادم. تأكد من تشغيل السيرفر.' }]); 
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* دمج شاشة تسجيل الدخول هنا (مخفية وتظهر عند الحاجة) */}
      {isAuthModalOpen && (
        <AuthModal 
          isOpen={isAuthModalOpen} 
          onClose={() => setIsAuthModalOpen(false)} 
          onSuccess={handleLoginSuccess} 
        />
      )}

      <div style={{ position: 'absolute', bottom: '30px', right: '30px', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        
        {isOpen && (
          <div style={{ width: '350px', height: '450px', backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '12px', display: 'flex', flexDirection: 'column', color: '#c9d1d9', overflow: 'hidden', marginBottom: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            
            <div style={{ padding: '12px 16px', backgroundColor: '#21262d', fontWeight: 'bold', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🤖 AI Property Advisor</span> 
              <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: '20px', cursor: 'pointer' }}>✖</button>
            </div>
            
            {isFilterActive && (
              <div style={{ padding: '8px', backgroundColor: '#1f2428', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'center' }}>
                <button 
                  onClick={handleResetFilter}
                  style={{ backgroundColor: '#d29922', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', width: '100%', transition: 'background-color 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e3a82e'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#d29922'}
                >
                  🔄 Reset Filtering
                </button>
              </div>
            )}

            <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {messages.map((m, i) => (
                <div key={i} style={{ alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', backgroundColor: m.sender === 'user' ? '#1f6feb' : '#30363d', padding: '10px 14px', borderRadius: '12px', borderBottomRightRadius: m.sender === 'user' ? '2px' : '12px', borderBottomLeftRadius: m.sender === 'ai' ? '2px' : '12px', maxWidth: '85%', fontSize: '14px', lineHeight: '1.5' }}>
                  {m.text}
                  
                  {/* زرار تأكيد الحجز من الذكاء الاصطناعي */}
                  {m.action === 'BOOK_UNIT' && m.actionUnitId && (
                    <button 
                      onClick={() => handleConfirmBooking(m.actionUnitId as number)}
                      style={{ 
                        display: 'block', marginTop: '10px', backgroundColor: '#238636', 
                        color: '#fff', border: 'none', padding: '8px 12px', 
                        borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', width: '100%',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2ea043'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#238636'}
                    >
                      ✅ تأكيد حجز الوحدة {m.actionUnitId}
                    </button>
                  )}
                </div>
              ))}
              {isLoading && <div style={{ fontSize: '13px', color: '#8b949e', alignSelf: 'flex-start' }}>جاري التفكير...</div>}
            </div>
            
            <div style={{ padding: '12px', borderTop: '1px solid #30363d', display: 'flex', gap: '8px', backgroundColor: '#0d1117' }}>
              <input 
                value={input} 
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSend()}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #30363d', backgroundColor: '#010409', color: '#fff' }}
                placeholder="ابحث عن فيلا، اسأل عن الأسعار..." 
              />
              <button onClick={handleSend} style={{ padding: '10px 16px', backgroundColor: '#238636', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>إرسال</button>
            </div>
          </div>
        )}

        {!isOpen && (
          <button 
            onClick={() => setIsOpen(true)}
            style={{
              width: '60px', height: '60px', borderRadius: '30px',
              backgroundColor: '#1f6feb', color: '#fff', border: 'none',
              fontSize: '28px', cursor: 'pointer', boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            💬
          </button>
        )}
      </div>
    </>
  );
};

export default AIAdvisor;