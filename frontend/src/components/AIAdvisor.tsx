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
  // 1. تغيير اسم المساعد إلى GeoTwin
  const [messages, setMessages] = useState<{sender: string, text: string, action?: string, actionUnitId?: number}[]>([
    { sender: 'ai', text: 'أهلاً بك في GeoTwin! كيف يمكنني مساعدتك في استكشاف العقارات والبيانات المكانية؟' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [isFilterActive, setIsFilterActive] = useState(false);
  const highlightHandleRef = useRef<any>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingBookingId, setPendingBookingId] = useState<number | null>(null);

  const userToken = localStorage.getItem('token'); 
  const isUserLoggedIn = !!userToken;

  // 2. تحديد الطبقات الجديدة المستهدفة للبحث والفلترة
  const TARGET_LAYERS = ["Villas_Global", "Units"];
  const VISUAL_LAYERS = ["Villas_Global", "Buildings_Global"];

  // 3. تحديث دالة إلغاء الفلتر لتشمل جميع الطبقات
  // 3. تحديث دالة إلغاء الفلتر لتشمل جميع الطبقات المرئية على الخريطة
  const handleResetFilter = () => {
    if (view && view.map) {
      // 🚀 استخدام VISUAL_LAYERS بدلاً من TARGET_LAYERS
      VISUAL_LAYERS.forEach(title => {
        const layer = view.map?.layers.find(l => l.title === title) as FeatureLayer;
        if (layer) layer.definitionExpression = "1=1"; 
      });
      setIsFilterActive(false);
      if (highlightHandleRef.current) {
        highlightHandleRef.current.remove();
        highlightHandleRef.current = null;
      }
    }
  };

  const executeBooking = async (objectId: number) => {
    try {
      let targetGlobalId = null;
      let targetSourceLayer = null;

      if (view && view.map) {
        for (const title of TARGET_LAYERS) {
          const layer = view.map.layers.find(l => l.title === title) as FeatureLayer;
          if (layer) {
            const query = layer.createQuery();
            query.where = `OBJECTID = ${objectId}`;
            query.outFields = ["GlobalID"];
            const results = await layer.queryFeatures(query);
            
            if (results.features.length > 0) {
              targetGlobalId = results.features[0].attributes.GlobalID;
              targetSourceLayer = title;
              break; 
            }
          }
        }
      }

      if (!targetGlobalId || !targetSourceLayer) {
        setMessages(prev => [...prev, { sender: 'ai', text: '❌ عذراً، تعذر العثور على تفاصيل الوحدة في الخريطة.' }]);
        return;
      }

      await axios.post(`${import.meta.env.VITE_API_URL}/api/bookings/request`, { 
        unitId: targetGlobalId,
        sourceLayer: targetSourceLayer
      }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });

      setMessages(prev => [...prev, { 
        sender: 'ai', 
        text: `✅ تم إرسال طلب حجز الوحدة رقم ${objectId} للأدمن بنجاح! سيتم التواصل معك قريباً.` 
      }]);

    } catch (error) {
      console.error("Booking error:", error);
      setMessages(prev => [...prev, { sender: 'ai', text: '❌ عذراً، حدث خطأ أثناء محاولة الحجز.' }]);
    }
  };

  const handleConfirmBooking = (unitId: number) => {
    if (!isUserLoggedIn) {
      setPendingBookingId(unitId);
      setIsAuthModalOpen(true);
    } else {
      executeBooking(unitId);
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthModalOpen(false);
    if (pendingBookingId !== null) {
      executeBooking(pendingBookingId);
      setPendingBookingId(null); 
    }
  };

  // 2. تعديل دالة الإرسال لسحب الداتا من الطبقات وبعتها للـ AI
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      let contextData: any[] = [];
      
      if (view && view.map) {
        // 1. سحب بيانات الفيلات
        const villasLayer = view.map.layers.find((l:any) => l.title === "Villas_Global") as FeatureLayer;
        if (villasLayer) {
          const q = villasLayer.createQuery(); q.where = "1=1"; q.outFields = ["*"];
          const res = await villasLayer.queryFeatures(q);
          contextData.push(...res.features.map(f => ({
            id: f.attributes.OBJECTID,
            layer: "Villas_Global",
            type: f.attributes.BuildingType === 2 ? "TwinHouse" : "Villa",
            price: f.attributes.Total_Price || f.attributes.Price,
            status: String(f.attributes.Status).toLowerCase()
          })));
        }

        // 2. سحب بيانات الشقق من الـ Tables
        const unitsTable = view.map.tables?.find((t:any) => t.title === "Units") as FeatureLayer || view.map.layers.find((l:any) => l.title === "Units") as FeatureLayer;
        if (unitsTable) {
          const q = unitsTable.createQuery(); q.where = "1=1"; q.outFields = ["*"];
          const res = await unitsTable.queryFeatures(q);
          contextData.push(...res.features.map(f => ({
            id: f.attributes.OBJECTID,
            layer: "Units",
            buildingFK: f.attributes.BuildingID_FK, // 👈 مهم جداً لفلترة العمارات
            type: "Apartment",
            price: f.attributes.Price,
            status: String(f.attributes.Status || 'available').toLowerCase()
          })));
        }
      }

      // إرسال المتاح فقط للذكاء الاصطناعي لتخفيف الحمل
      const availableOnly = contextData.filter(u => u.status === 'available' || u.status === '1');

      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/ai/ask`, { 
        question: userMsg,
        contextData: availableOnly 
      });
      
      const { reply, isFilterQuery, filteredIds, action, actionUnitId } = res.data; 

      setMessages(prev => [...prev, { sender: 'ai', text: reply, action: action, actionUnitId: actionUnitId }]); 

      // 3. تطبيق الفلتر على الخريطة بذكاء
      if (view && view.map) {
        const villasLayer = view.map.layers.find((l:any) => l.title === "Villas_Global") as FeatureLayer;
        const buildings3DLayer = view.map.layers.find((l:any) => l.title === "Buildings_Global" && l.type === "scene") as any;

        if (isFilterQuery && filteredIds && filteredIds.length > 0) {
          
          // تحديد العناصر اللي الـ AI اختارها
          const filteredItems = availableOnly.filter(u => filteredIds.includes(u.id));
          
          // 🚀 فصل الـ IDs مع استخدام Set لمنع التكرار في العمارات
          const villaIds = filteredItems.filter(u => u.layer === "Villas_Global").map(u => u.id);
          const rawBuildingFKs = filteredItems.filter(u => u.layer === "Units").map(u => `'${u.buildingFK}'`);
          const apartmentBuildingFKs = [...new Set(rawBuildingFKs)]; // استخراج مفاتيح فريدة فقط

          let allVisualFeatures: any[] = [];

          // فلترة الفيلات
          if (villasLayer) {
            if (villaIds.length > 0) {
              const expr = `OBJECTID IN (${villaIds.join(',')})`;
              villasLayer.definitionExpression = expr;
              const q = villasLayer.createQuery(); q.where = expr; q.returnGeometry = true;
              const vRes = await villasLayer.queryFeatures(q);
              allVisualFeatures.push(...vRes.features);
            } else {
              villasLayer.definitionExpression = "1=0"; // إخفاء الفيلات لو البحث عن شقق
            }
          }

          // فلترة العمارات
          if (buildings3DLayer) {
            if (apartmentBuildingFKs.length > 0) {
              const expr = `GlobalID IN (${apartmentBuildingFKs.join(',')})`;
              buildings3DLayer.definitionExpression = expr;
              const q = buildings3DLayer.createQuery(); q.where = expr; q.returnGeometry = true;
              const bRes = await buildings3DLayer.queryFeatures(q);
              allVisualFeatures.push(...bRes.features);
            } else {
              buildings3DLayer.definitionExpression = "1=0"; // إخفاء العمارات لو البحث عن فيلات
            }
          }

          setIsFilterActive(true); 
          if (allVisualFeatures.length > 0) {
            view.goTo(allVisualFeatures, { animate: true, duration: 2000 });
          }

        } else if (!isFilterQuery) {
          // Reset
          if (villasLayer) villasLayer.definitionExpression = "1=1";
          if (buildings3DLayer) buildings3DLayer.definitionExpression = "1=1";
          setIsFilterActive(false);
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { sender: 'ai', text: 'عذراً، حدث خطأ في الاتصال بالخوادم.' }]); 
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
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
              <span>🤖 GeoTwin AI Advisor</span> 
              <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: '20px', cursor: 'pointer' }}>✖</button>
            </div>
            
            {isFilterActive && (
              <div style={{ padding: '8px', backgroundColor: '#1f2428', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'center' }}>
                <button 
                  onClick={handleResetFilter}
                  style={{ backgroundColor: '#d29922', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', width: '100%', transition: 'background-color 0.2s' }}
                >
                  🔄 Reset Filtering
                </button>
              </div>
            )}

            <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {messages.map((m, i) => (
                <div key={i} style={{ alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', backgroundColor: m.sender === 'user' ? '#1f6feb' : '#30363d', padding: '10px 14px', borderRadius: '12px', borderBottomRightRadius: m.sender === 'user' ? '2px' : '12px', borderBottomLeftRadius: m.sender === 'ai' ? '2px' : '12px', maxWidth: '85%', fontSize: '14px', lineHeight: '1.5' }}>
                  {m.text}
                  
                  {m.action === 'BOOK_UNIT' && m.actionUnitId && (
                    <button 
                      onClick={() => handleConfirmBooking(m.actionUnitId as number)}
                      style={{ 
                        display: 'block', marginTop: '10px', backgroundColor: '#238636', 
                        color: '#fff', border: 'none', padding: '8px 12px', 
                        borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', width: '100%',
                        transition: 'background-color 0.2s'
                      }}
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
          >
            💬
          </button>
        )}
      </div>
    </>
  );
};

export default AIAdvisor;