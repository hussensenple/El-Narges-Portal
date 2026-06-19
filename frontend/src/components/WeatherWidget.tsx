import { useState, useEffect, useRef } from 'react';
import SceneView from '@arcgis/core/views/SceneView';

// 🚀 خليت الأيقونات كلها تدعم تغيير الحجم (size) واللون (color)
const Icons = {
  MapPin: ({ size = 16, color = "currentColor" }) => <svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth="2" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>,
  Satellite: ({ size = 18, color = "currentColor" }) => <svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth="2" fill="none"><path d="M2 10s3-3 3-8 5-1 5-1 1 5 6 5 8 3 8 3-3 8-3 8-5 1-5 1-1-5-6-5-3-3-3-3z"></path><path d="m14 22-10-10"></path><path d="m20 16-10-10"></path><path d="m18 12-10-10"></path></svg>,
  Sun: ({ size = 18, color = "currentColor" }) => <svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth="2" fill="none"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line></svg>,
  Cloud: ({ size = 18, color = "currentColor" }) => <svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth="2" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>,
  Rain: ({ size = 18, color = "currentColor" }) => <svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth="2" fill="none"><path d="M16 13v8"></path><path d="M8 13v8"></path><path d="M12 15v8"></path><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path></svg>,
  Fog: ({ size = 18, color = "currentColor" }) => <svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth="2" fill="none"><line x1="4" y1="14" x2="20" y2="14"></line><line x1="4" y1="18" x2="20" y2="18"></line><line x1="4" y1="22" x2="20" y2="22"></line></svg>
};

interface WeatherWidgetProps { view: SceneView | null; onClose: () => void; }

const WeatherWidget = ({ view, onClose }: WeatherWidgetProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRealTimeSun, setIsRealTimeSun] = useState<boolean>(false);
  // شلنا الـ icon من الـ State عشان هنعتمد على الـ mainCondition
  const [weatherData, setWeatherData] = useState<{ temp: number; description: string; mainCondition: string; } | null>(null);

  const [pos, setPos] = useState({ x: 20, y: 80 }); 
  const [isDragging, setIsDragging] = useState(false);
  const dragInfo = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPos({ x: dragInfo.current.startPosX + (e.clientX - dragInfo.current.startX), y: dragInfo.current.startPosY + (e.clientY - dragInfo.current.startY) });
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) { document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp); }
    return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true); dragInfo.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y };
  };

  useEffect(() => {
    let sunInterval: any;
    if (view && view.type === "3d") {
      if (isRealTimeSun) {
        (view.environment as any).lighting = { type: "sun", date: new Date(), directShadowsEnabled: true };
        sunInterval = setInterval(() => { (view.environment as any).lighting = { type: "sun", date: new Date(), directShadowsEnabled: true }; }, 60000);
      } else {
        const defaultDate = new Date(); defaultDate.setHours(14, 0, 0);
        (view.environment as any).lighting = { type: "sun", date: defaultDate, directShadowsEnabled: true };
      }
    }
    return () => { if (sunInterval) clearInterval(sunInterval); };
  }, [view, isRealTimeSun]);

  const apply3DWeatherEffect = (currentView: SceneView, conditionStr: string) => {
    if (!currentView || currentView.type !== "3d") return;
    let weatherType = "sunny"; const cond = conditionStr.toLowerCase();
    if (cond.includes("rain") || cond.includes("drizzle") || cond.includes("thunderstorm")) weatherType = "rainy";
    else if (cond.includes("cloud")) weatherType = "cloudy";
    else if (cond.includes("snow")) weatherType = "snowy";
    else if (cond.includes("fog") || cond.includes("mist") || cond.includes("haze")) weatherType = "foggy";
    (currentView.environment as any).weather = { type: weatherType };
  };

  const fetchLiveWeather = async () => {
    if (!view || !view.ready || !view.center) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/weather/current?lat=${view.center.latitude}&lon=${view.center.longitude}`);
      const data = await response.json();
      
      const newWeather = { 
        temp: Math.round(data.main.temp), 
        description: data.weather[0].description, 
        mainCondition: data.weather[0].main 
      };
      
      setWeatherData(newWeather); 
      apply3DWeatherEffect(view, newWeather.mainCondition);
    } catch (error: any) { console.error(error); } finally { setIsLoading(false); }
  };

  const manualWeatherOverride = (weatherType: string) => {
    if (view) (view.environment as any).weather = { type: weatherType };
  };

  // 🚀 دالة لاختيار الأيقونة المناسبة بناءً على حالة الطقس
  const renderWeatherIcon = (condition: string, size: number) => {
    const cond = condition.toLowerCase();
    if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('thunderstorm')) return <Icons.Rain size={size} color="#fff" />;
    if (cond.includes('cloud')) return <Icons.Cloud size={size} color="#fff" />;
    if (cond.includes('fog') || cond.includes('mist') || cond.includes('haze')) return <Icons.Fog size={size} color="#fff" />;
    return <Icons.Sun size={size} color="#fff" />;
  };

  const btnStyle: React.CSSProperties = { width: '100%', padding: '14px', backgroundColor: '#1f6feb', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', marginBottom: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' };
  const secBtnStyle: React.CSSProperties = { flex: '1 1 calc(50% - 8px)', padding: '12px', backgroundColor: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };

  return (
    <div style={{ position: 'absolute', top: `${pos.y}px`, left: `${pos.x}px`, width: '320px', backgroundColor: '#0d1117', borderRadius: '14px', boxShadow: '0 20px 50px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', color: '#c9d1d9', fontFamily: 'sans-serif', zIndex: 1000, overflow: 'hidden' }}>
      
      <div onMouseDown={handleMouseDown} style={{ padding: '16px 20px', backgroundColor: '#161b22', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: isDragging ? 'grabbing' : 'grab' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* 👈 غيرنا الاسم هنا لـ Weather */}
          <div style={{color: '#58a6ff'}}><Icons.Cloud size={18} color="#58a6ff" /></div>
          <h5 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 'bold', userSelect: 'none' }}>Weather</h5>
        </div>
        <button onMouseDown={(e) => e.stopPropagation()} onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: '20px', cursor: 'pointer' }}>✖</button>
      </div>

      <div style={{ padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '11px', backgroundColor: view ? 'rgba(40, 167, 69, 0.15)' : 'rgba(220, 53, 69, 0.15)', color: view ? '#2ecc71' : '#e74c3c', fontWeight: 'bold' }}>{view ? '🟢 Live Map Linked' : '🔴 Map Disconnected'}</span>
        </div>

        <div style={{ backgroundColor: '#161b22', borderRadius: '14px', padding: '16px', border: '1px solid #30363d', marginBottom: '16px', minHeight: '110px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
          {weatherData ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                {/* 🚀 السحر هنا: بنرسم الأيقونة النظيفة بتاعتنا بحجم كبير */}
                {renderWeatherIcon(weatherData.mainCondition, 45)}
                <div style={{ fontSize: '40px', fontWeight: 'bold', color: '#fff' }}>{weatherData.temp}<span style={{fontSize: '20px', color: '#8b949e'}}>°C</span></div>
              </div>
              <div style={{ fontSize: '13px', color: '#c9d1d9', backgroundColor: '#21262d', padding: '4px 12px', borderRadius: '15px', border: '1px solid #30363d', marginTop: '10px', display: 'inline-block' }}>{weatherData.description}</div>
            </div>
          ) : <div style={{ color: '#8b949e' }}><Icons.Satellite size={18} /> Awaiting sync...</div>}
        </div>

        <button onClick={fetchLiveWeather} disabled={isLoading || !view} style={btnStyle}><Icons.Satellite size={18} color="#fff" /> {isLoading ? 'Fetching Data...' : 'Sync Live Weather'}</button>
        <button onClick={() => setIsRealTimeSun(!isRealTimeSun)} style={{...btnStyle, backgroundColor: isRealTimeSun ? '#fff3cd' : '#21262d', color: isRealTimeSun ? '#856404' : '#c9d1d9', border: isRealTimeSun ? '1px solid #ffeeba' : '1px solid #30363d'}}><Icons.Sun size={18} color={isRealTimeSun ? "#856404" : "#c9d1d9"} /> {isRealTimeSun ? 'Live Time & Shadows: Active' : 'Enable Live Time & Shadows'}</button>

        <div style={{ marginTop: '20px', borderTop: '1px solid #30363d', paddingTop: '16px' }}>
          <div style={{ fontSize: '11px', color: '#8b949e', fontWeight: 'bold', marginBottom: '10px' }}>MANUAL OVERRIDE</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => manualWeatherOverride('sunny')} style={secBtnStyle}><Icons.Sun size={16} /> Sunny</button>
            <button onClick={() => manualWeatherOverride('cloudy')} style={secBtnStyle}><Icons.Cloud size={16} /> Cloudy</button>
            <button onClick={() => manualWeatherOverride('rainy')} style={secBtnStyle}><Icons.Rain size={16} /> Rainy</button>
            <button onClick={() => manualWeatherOverride('foggy')} style={secBtnStyle}><Icons.Fog size={16} /> Foggy</button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default WeatherWidget;