import { useState, useEffect, useRef, useContext } from 'react';
import SceneView from '@arcgis/core/views/SceneView';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Graphic from '@arcgis/core/Graphic';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import AuthModal from './AuthModal';

interface UnitCatalogProps {
  view: SceneView | null;
  onClose: () => void;
}

const UnitCatalog = ({ view, onClose }: UnitCatalogProps) => {
  const [units, setUnits] = useState<Graphic[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // 🚀 حالات نظام الحسابات (Auth)
  const auth = useContext(AuthContext);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [bookingUnit, setBookingUnit] = useState<Graphic | null>(null);
  
  // حالات الفلاتر
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All Types'); 
  const [maxPrice, setMaxPrice] = useState(''); 
  
  const highlightHandleRef = useRef<any>(null);

  // حالات التحكم في تحريك الشاشة (Drag & Drop)
  const [pos, setPos] = useState({ x: 80, y: 80 }); 
  const [isDragging, setIsDragging] = useState(false);
  const dragInfo = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

  useEffect(() => {
    if (view && view.map) {
      const layer = view.map.layers.find(l => l.title === "Residential1") as FeatureLayer;
      if (layer) loadUnitsData(layer);
    }
  }, [view]);

  // منطق تحريك الشاشة
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPos({
        x: dragInfo.current.startPosX + (e.clientX - dragInfo.current.startX),
        y: dragInfo.current.startPosY + (e.clientY - dragInfo.current.startY),
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    dragInfo.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y };
  };

  const loadUnitsData = async (layer: FeatureLayer) => {
    setIsLoading(true);
    try {
      const query = layer.createQuery();
      query.where = "1=1";
      query.outFields = ["*"];
      query.returnGeometry = true; 
      const results = await layer.queryFeatures(query);
      setUnits(results.features);
    } catch (error) {
      console.error("Error loading units:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardClick = async (unit: Graphic) => {
    if (!view || !view.map) return;
    if (unit.geometry) {
      view.goTo({ target: unit.geometry, tilt: 45, zoom: 19 }, { animate: true, duration: 2000 });
    }
    const layer = view.map.layers.find(l => l.title === "Residential1") as FeatureLayer;
    if (layer) {
      const layerView = await view.whenLayerView(layer);
      if (highlightHandleRef.current) highlightHandleRef.current.remove();
      highlightHandleRef.current = layerView.highlight(unit);
    }
  };

  // 🚀 دالة زرار الشراء (بتتشيك العميل مسجل ولا لأ)
  const handleBuyClick = (e: React.MouseEvent, unit: Graphic) => {
    e.stopPropagation(); 
    handleCardClick(unit); 

    if (!auth?.token) {
      setShowAuthModal(true); // افتحله شاشة الدخول لو مش مسجل
    } else {
      setBookingUnit(unit);   // افتحله شاشة تأكيد الحجز لو مسجل
    }
  };

  // 🚀 دالة إرسال الطلب الفعلي للسيرفر
  const submitBookingRequest = async () => {
    if (!bookingUnit || !auth?.token) return;

    setIsLoading(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/bookings/request`, {
        unitId: bookingUnit.attributes.OBJECTID,
      }, {
        headers: { 'x-auth-token': auth.token } // 👈 إرسال التوكن في الهيدر
      });

      alert("🎉 تم إرسال طلب الحجز بنجاح! سيقوم فريق المبيعات بمراجعة طلبك.");
      setBookingUnit(null); // قفل شاشة التأكيد
    } catch (error: any) {
      if (error.response?.status === 400) {
          alert("❌ " + (error.response.data.error || error.response.data.msg));
      } else {
          alert("❌ حدث خطأ، يرجى التأكد من تشغيل السيرفر والمحاولة لاحقاً.");
      }
      setBookingUnit(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetFilters = () => {
    // 1. تصفير الفلاتر
    setSearchTerm(''); 
    setStatusFilter('All'); 
    setTypeFilter('All Types'); 
    setMaxPrice('');

    // 2. إزالة التحديد اليدوي (لو جاي من الكتالوج)
    if (highlightHandleRef.current) { 
      highlightHandleRef.current.remove(); 
      highlightHandleRef.current = null; 
    }

    // 3. 🚀 إزالة تحديد الخريطة الافتراضي وقفل الـ Popup (السطر السحري)
    if (view) {
      view.popup?.close(); // 👈 ضفنا علامة الاستفهام هنا
    }
  };

  const filteredUnits = units.filter(unit => {
    const attrs = unit.attributes || {};
    const matchesSearch = attrs.OBJECTID?.toString().includes(searchTerm);
    const matchesStatus = statusFilter === 'All' || String(attrs.Status).toLowerCase() === statusFilter.toLowerCase();
    const matchesType = typeFilter === 'All Types' || attrs.Unit_Type === typeFilter;
    let matchesPrice = true;
    if (maxPrice.trim() !== '') { matchesPrice = (attrs.Total_Price || 0) <= Number(maxPrice); }
    return matchesSearch && matchesStatus && matchesType && matchesPrice;
  });

  return (
    <>
      <div style={{ position: 'absolute', top: `${pos.y}px`, left: `${pos.x}px`, width: '80vw', height: '80vh', minWidth: '400px', minHeight: '300px', backgroundColor: '#0d1117', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', color: '#c9d1d9', fontFamily: 'sans-serif', zIndex: 1000, resize: 'both', overflow: 'hidden' }}>
        
        <div onMouseDown={handleMouseDown} style={{ padding: '16px 24px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#161b22', cursor: isDragging ? 'grabbing' : 'grab' }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', userSelect: 'none' }}>🏢 Property Catalog</h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {/* 👤 لو العميل مسجل، نعرض اسمه وزرار خروج شيك */}
            {auth?.user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', backgroundColor: '#21262d', padding: '6px 12px', borderRadius: '20px', border: '1px solid #30363d' }}>
                <span style={{ color: '#58a6ff' }}>👤 {auth.user.name}</span>
                <button onClick={auth.logout} style={{ background: 'none', border: 'none', color: '#ff7b72', cursor: 'pointer', fontWeight: 'bold' }}>Sign Out</button>
              </div>
            )}
            <button onMouseDown={(e) => e.stopPropagation()} onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: '24px', cursor: 'pointer' }}>×</button>
          </div>
        </div>

        <div style={{ padding: '16px 24px', display: 'flex', gap: '16px', borderBottom: '1px solid #30363d', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" placeholder="🔍 Search by ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ flex: 1, minWidth: '120px', padding: '10px', borderRadius: '6px', border: '1px solid #30363d', backgroundColor: '#010409', color: '#fff' }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #30363d', backgroundColor: '#010409', color: '#fff', cursor: 'pointer' }}>
            <option value="All">All Statuses</option> <option value="Available">Available</option> <option value="Reserved">Reserved</option> <option value="Sold">Sold</option>
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #30363d', backgroundColor: '#010409', color: '#fff', cursor: 'pointer' }}>
            <option value="All Types">All Types</option> <option value="Tower">Tower</option> <option value="Building">Building</option> <option value="Villa">Villa</option>
          </select>
          <input type="number" placeholder="💰 Max Price (M EGP)..." value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} min="0" step="any" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #30363d', backgroundColor: '#010409', color: '#fff', width: '180px' }} />
          <button onClick={handleResetFilters} style={{ padding: '10px 16px', backgroundColor: '#d29922', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🔄 Reset</button>
        </div>
        
        <div style={{ padding: '12px 24px 0', color: '#8b949e', fontSize: '14px' }}>
          📊 Total Displayed Units: <strong style={{ color: '#fff' }}>{filteredUnits.length}</strong> unit
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', alignContent: 'start' }}>
          {isLoading && <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#58a6ff' }}>Loading Units...</div>}
          {filteredUnits.length === 0 && !isLoading && <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#8b949e', padding: '40px' }}>No units match your criteria. 🕵️‍♂️</div>}

          {filteredUnits.map((unit, idx) => {
            const status = String(unit.attributes.Status).toLowerCase();
            const isAvailable = status === 'available';
            const isReserved = status === 'reserved';
            const badgeColor = isAvailable ? '#2ea043' : (isReserved ? '#d29922' : '#f85149');
            const borderColor = isAvailable ? '#2ea04355' : (isReserved ? '#d2992255' : '#f8514955');
            const rawPrice = unit.attributes.Total_Price;
            const formattedPrice = rawPrice ? Number(rawPrice).toLocaleString() + ' M EGP' : 'Contact Sales';

            return (
              <div key={idx} onClick={() => handleCardClick(unit)} style={{ background: '#161b22', padding: '20px', borderRadius: '10px', border: `1px solid ${borderColor}`, cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <strong style={{ color: '#fff', fontSize: '1.2rem' }}>Unit #{unit.attributes.OBJECTID}</strong>
                  <span style={{ border: `1px solid ${badgeColor}`, color: badgeColor, padding: '4px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>{unit.attributes.Status}</span>
                </div>
                <div style={{ fontSize: '13px', color: '#8b949e', marginBottom: '20px', lineHeight: '1.8' }}>
                  <div>🧱 Type: <strong style={{ color: '#fff' }}>{unit.attributes.Unit_Type || 'Building'}</strong></div>
                  <div>🏢 Floor: <strong style={{ color: '#fff' }}>{unit.attributes.Floor || 'Ground'}</strong></div>
                  <div>💰 Price: <strong style={{ color: '#fff' }}>{formattedPrice}</strong></div>
                </div>
                <button onClick={(e) => handleBuyClick(e, unit)} disabled={!isAvailable} style={{ width: '100%', padding: '10px', backgroundColor: isAvailable ? '#1f6feb' : '#21262d', color: isAvailable ? '#fff' : '#8b949e', border: 'none', borderRadius: '6px', cursor: isAvailable ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>
                  {isAvailable ? "Proceed to Buy" : unit.attributes.Status}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🚀 شاشة تسجيل الدخول */}
      {showAuthModal && <AuthModal 
          onClose={() => setShowAuthModal(false)} 
          onSuccess={() => {
              setShowAuthModal(false);
              // submitBookingRequest(); // لو حابب تخليه يبعت الطلب تلقائي بعد ما يلوجن
          }} 
      />}

      {/* 🚀 شاشة تأكيد الحجز */}
      {bookingUnit && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div style={{ backgroundColor: '#161b22', padding: '24px', borderRadius: '12px', border: '1px solid #30363d', width: '320px', textAlign: 'center', color: '#c9d1d9', fontFamily: 'sans-serif' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>📝 تأكيد طلب الحجز</h3>
            <p style={{ color: '#8b949e', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>هل أنت متأكد من تقديم طلب شراء للوحدة رقم <strong style={{color: '#fff'}}>#{bookingUnit.attributes.OBJECTID}</strong>؟</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={submitBookingRequest} disabled={isLoading} style={{ flex: 1, padding: '10px', backgroundColor: '#238636', color: '#fff', border: 'none', borderRadius: '6px', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                {isLoading ? 'جاري الإرسال...' : 'تأكيد وإرسال'}
              </button>
              <button onClick={() => setBookingUnit(null)} disabled={isLoading} style={{ flex: 1, padding: '10px', backgroundColor: '#21262d', color: '#8b949e', border: '1px solid #30363d', borderRadius: '6px', cursor: 'pointer' }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UnitCatalog;