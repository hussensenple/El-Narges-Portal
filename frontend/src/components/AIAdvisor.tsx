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
    { sender: 'ai', text: 'Welcome to GeoTwin! How can I assist you in exploring real estate and spatial data?' }
  ]);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFilterActive, setIsFilterActive] = useState(false);
  const highlightHandleRef = useRef<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingBookingId, setPendingBookingId] = useState<number | null>(null);

  const userToken = localStorage.getItem('token'); 
  const isUserLoggedIn = !!userToken;

  const TARGET_LAYERS = ["Villas_Global", "Units"];
  const VISUAL_LAYERS = ["Villas_Global", "Buildings_Global"];

  const handleResetFilter = () => {
    if (view && view.map) {
      VISUAL_LAYERS.forEach(title => {
        const layer = view.map?.layers.find(l => l.title === title) as any;
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
        setMessages(prev => [...prev, { sender: 'ai', text: '❌ Sorry, unit details could not be found on the map.' }]);
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
        text: `✅ Booking request for unit #${objectId} has been successfully sent! We will contact you soon.` 
      }]);

    } catch (error) {
      console.error("Booking error:", error);
      setMessages(prev => [...prev, { sender: 'ai', text: '❌ Sorry, an error occurred while trying to book.' }]);
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
  
  const handleSend = async (overrideInput?: string) => {
    const userMsg = overrideInput || input;
    if (!userMsg.trim()) return;

    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    if (!overrideInput) setInput('');
    setIsLoading(true);

    try {
      let contextData: any[] = [];
      
      if (view && view.map) {
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

        const unitsTable = view.map.tables?.find((t:any) => t.title === "Units") as FeatureLayer || view.map.layers.find((l:any) => l.title === "Units") as FeatureLayer;
        if (unitsTable) {
          const q = unitsTable.createQuery(); q.where = "1=1"; q.outFields = ["*"];
          const res = await unitsTable.queryFeatures(q);
          contextData.push(...res.features.map(f => ({
            id: f.attributes.OBJECTID,
            layer: "Units",
            // 🚀 استخراج آمن للـ FK مهما كان اسمه في الـ Database
            buildingFK: f.attributes.BuildingID_FK || f.attributes.BuildingID_FK || f.attributes.GlobalID_FK, 
            type: "Apartment",
            price: f.attributes.Price,
            status: String(f.attributes.Status || 'available').toLowerCase()
          })));
        }
      }

      const availableOnly = contextData.filter(u => u.status === 'available' || u.status === '1');

      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/ai/ask`, { 
        question: userMsg,
        contextData: availableOnly 
      });
      
      const { reply, isFilterQuery, filteredIds, action, actionUnitId } = res.data; 

      setMessages(prev => [...prev, { sender: 'ai', text: reply, action: action, actionUnitId: actionUnitId }]); 

      if (view && view.map) {
        if (isFilterQuery && filteredIds && filteredIds.length > 0) {
          
          const filteredItems = availableOnly.filter(u => filteredIds.includes(u.id));
          
          const villaIds = filteredItems.filter(u => u.layer === "Villas_Global").map(u => u.id);
          // 🚀 تصفية الـ FKs المكررة والتأكد إنها مش Undefined
          const rawBuildingFKs = filteredItems.filter(u => u.layer === "Units" && u.buildingFK).map(u => `'${u.buildingFK}'`);
          const apartmentBuildingFKs = [...new Set(rawBuildingFKs)]; 

          let allVisualFeatures: any[] = [];

          // 1. فلترة الفيلات
          const villasLayer = view.map.layers.find((l:any) => l.title === "Villas_Global") as FeatureLayer;
          if (villasLayer) {
            if (villaIds.length > 0) {
              const expr = `OBJECTID IN (${villaIds.join(',')})`;
              villasLayer.definitionExpression = expr;
              const q = villasLayer.createQuery(); q.where = expr; q.returnGeometry = true;
              const vRes = await villasLayer.queryFeatures(q);
              allVisualFeatures.push(...vRes.features);
            } else {
              villasLayer.definitionExpression = "1=0"; 
            }
          }

          // 2. فلترة العمارات باحترافية (Reverse Querying)
          const buildingsLayer = view.map.layers.find((l:any) => l.title === "Buildings_Global") as any;
          if (buildingsLayer) {
            if (apartmentBuildingFKs.length > 0) {
              try {
                // هنسأل طبقة العمارات الأول: مين الـ OBJECTID بتاع الـ GlobalIDs دي؟
                const bQuery = buildingsLayer.createQuery();
                bQuery.where = `GlobalID IN (${apartmentBuildingFKs.join(',')})`;
                bQuery.outFields = ["OBJECTID"];
                bQuery.returnGeometry = true;

                const bRes = await buildingsLayer.queryFeatures(bQuery);
                const bObjectIds = bRes.features.map((f:any) => f.attributes.OBJECTID);

                // هنفلتر العمارات بناءً على الـ OBJECTID لأنه مضمون 100% مع الـ SceneLayers
                if (bObjectIds.length > 0) {
                  buildingsLayer.definitionExpression = `OBJECTID IN (${bObjectIds.join(',')})`;
                  allVisualFeatures.push(...bRes.features);
                } else {
                  buildingsLayer.definitionExpression = "1=0";
                }
              } catch (err) {
                console.error("Error applying filter to Buildings:", err);
                // Fallback لو الكويري فشل
                buildingsLayer.definitionExpression = `GlobalID IN (${apartmentBuildingFKs.join(',')})`;
              }
            } else {
              buildingsLayer.definitionExpression = "1=0"; 
            }
          }

          setIsFilterActive(true); 
          if (allVisualFeatures.length > 0) {
            view.goTo(allVisualFeatures, { animate: true, duration: 2000 });
          }

        } else if (!isFilterQuery) {
          const villasLayer = view.map.layers.find((l:any) => l.title === "Villas_Global") as any;
          const buildingsLayer = view.map.layers.find((l:any) => l.title === "Buildings_Global") as any;
          if (villasLayer) villasLayer.definitionExpression = "1=1";
          if (buildingsLayer) buildingsLayer.definitionExpression = "1=1";
          setIsFilterActive(false);
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { sender: 'ai', text: 'Sorry, an error occurred while connecting to the servers.' }]); 
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
                <div key={i} style={{ alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', backgroundColor: m.sender === 'user' ? '#1f6feb' : '#30363d', padding: '10px 14px', borderRadius: '12px', borderBottomRightRadius: m.sender === 'user' ? '2px' : '12px', borderBottomLeftRadius: m.sender === 'ai' ? '2px' : '12px', maxWidth: '85%', fontSize: '14px', lineHeight: '1.5', direction: 'ltr' }}>
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
                      ✅ Confirm Booking for Unit #{m.actionUnitId}
                    </button>
                  )}
                </div>
              ))}
              {isLoading && <div style={{ fontSize: '13px', color: '#8b949e', alignSelf: 'flex-start' }}>Thinking...</div>}
              {messages.length === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', padding: '0 4px' }}>
                  <span style={{ fontSize: '12px', color: '#8b949e' }}>Example questions:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {[
                      "What are the payment plans?", 
                      "What is the ROI for apartments?",
                      "What is the cancellation policy?",
                      "Are pets allowed in the compound?",
                      "Show me villas under 30 million"
                    ].map((q, idx) => (
                      <button 
                        key={idx}
                        onClick={() => handleSend(q)}
                        style={{
                          backgroundColor: '#21262d',
                          color: '#58a6ff',
                          border: '1px solid #30363d',
                          borderRadius: '16px',
                          padding: '6px 12px',
                          fontSize: '12px',
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
              )}
            </div>
            
            <div style={{ padding: '12px', borderTop: '1px solid #30363d', display: 'flex', gap: '8px', backgroundColor: '#0d1117' }}>
              <input 
                value={input} 
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSend()}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #30363d', backgroundColor: '#010409', color: '#fff', direction: 'ltr' }}
                placeholder="Search for an apartment, ask about prices..." 
              />
              <button onClick={() => handleSend()} style={{ padding: '10px 16px', backgroundColor: '#238636', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Send</button>
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