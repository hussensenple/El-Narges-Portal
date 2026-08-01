import { useEffect, useRef } from 'react';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import esriConfig from '@arcgis/core/config';
import '@arcgis/core/assets/esri/themes/dark/main.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

esriConfig.apiKey = 'AAPTaDbfhBZWiLu4_n_GjVYQ4HQ..-oEYWQVVvlTpQ_TFGjK-E8ZrlsazlpUdEUWIyfTs7fWlDap2D2J5MRQ-ndh0wSxvs8SGPRRuyfUnPUXa5de5nEivBXil92Sf70IklSV8GjW8geEUXSpwf5mVEPP5OcP70UZy0qflYRW6qc0vZZ1dPWRuifw3I8gY_rYJ639ugGPqrg76GNTkEXLB8pv1--d2iPUK4KJIgi1U0PuGLkI1nGIEx1h00mHrRxrP7vTL54bWkeESKA..AT1_iFeRcV9B';



const getColorForCount = (count: number, maxCount: number): [number, number, number, number] => {
  if (maxCount === 0 || count === 0) return [48, 54, 61, 0.4]; // Base dark gray for 0
  const ratio = count / maxCount;
  
  if (ratio <= 0.25) return [144, 238, 144, 0.8]; // Light Green
  if (ratio <= 0.50) return [255, 255, 51, 0.8];  // Yellow
  if (ratio <= 0.75) return [255, 153, 51, 0.9];  // Orange
  return [255, 51, 51, 1]; // Red (MAX)
};

const GOV_ALIASES: Record<string, string[]> = {
  'Cairo': ['Cairo', 'القاهرة', 'Al Qahirah'],
  'Giza': ['Giza', 'الجيزة', 'Al Jizah'],
  'Alexandria': ['Alexandria', 'الإسكندرية', 'Al Iskandariyah'],
  'Dakahlia': ['Dakahlia', 'الدقهلية', 'Ad Daqahliyah'],
  'Red Sea': ['Red Sea', 'البحر الأحمر', 'Al Bahr al Ahmar'],
  'Beheira': ['Beheira', 'البحيرة', 'Al Buhayrah'],
  'Fayoum': ['Fayoum', 'الفيوم', 'Al Fayyum', 'Faiyum'],
  'Gharbia': ['Gharbia', 'الغربية', 'Al Gharbiyah'],
  'Ismailia': ['Ismailia', 'الإسماعيلية'],
  'Menofia': ['Menofia', 'المنوفية', 'Al Minufiyah'],
  'Minya': ['Minya', 'المنيا', 'Al Minya'],
  'Qaliubiya': ['Qaliubiya', 'القليوبية', 'Al Qalyubiyah', 'Qalyubia'],
  'New Valley': ['New Valley', 'الوادي الجديد', 'Al Wadi al Jadid'],
  'Suez': ['Suez', 'السويس', 'As Suways'],
  'Aswan': ['Aswan', 'أسوان'],
  'Assiut': ['Assiut', 'أسيوط', 'Asyut'],
  'Beni Suef': ['Beni Suef', 'بني سويف', 'Bani Suwayf'],
  'Port Said': ['Port Said', 'بورسعيد'],
  'Damietta': ['Damietta', 'دمياط', 'Dumyat'],
  'Sharkia': ['Sharkia', 'الشرقية', 'Ash Sharqiyah', 'Al Sharqia'],
  'South Sinai': ['South Sinai', 'جنوب سيناء'],
  'Kafr Al sheikh': ['Kafr Al sheikh', 'كفر الشيخ', 'Kafr ash Shaykh', 'Kafr el-Sheikh'],
  'Matrouh': ['Matrouh', 'مطروح', 'Matruh'],
  'Luxor': ['Luxor', 'الأقصر', 'Al Uqsur'],
  'Qena': ['Qena', 'قنا', 'Qina'],
  'North Sinai': ['North Sinai', 'شمال سيناء'],
  'Sohag': ['Sohag', 'سوهاج', 'Suhaj']
};

const resolveGovKey = (featureName: string): string | null => {
  const lower = featureName?.toLowerCase().trim();
  for (const [key, aliases] of Object.entries(GOV_ALIASES)) {
    if (aliases.some(a => a.toLowerCase() === lower)) return key;
  }
  return null;
};

interface RegionsWebMapModalProps {
  regionsStats: { governorate: string; count: number; clients: any[] }[];
  onClose: () => void;
}

const RegionsWebMapModal: React.FC<RegionsWebMapModalProps> = ({ regionsStats, onClose }) => {
  const mapDiv = useRef<HTMLDivElement>(null);
  const maxCount = regionsStats.length > 0 ? Math.max(...regionsStats.map(r => r.count)) : 1;
  const countMap: Record<string, number> = {};
  regionsStats.forEach(r => { countMap[r.governorate] = r.count; });
  const chartData = [...regionsStats].sort((a, b) => b.count - a.count);

  useEffect(() => {
    if (!mapDiv.current) return;
    const map = new Map({ basemap: 'dark-gray-vector' });
    const view = new MapView({ 
      container: mapDiv.current, 
      map: map,
      center: [30.8025, 26.8206], // Center roughly on Egypt
      zoom: 5
    });

    const govLayer = new FeatureLayer({
      url: "https://services1.arcgis.com/dRxtwawTOPZm6CPj/arcgis/rest/services/egypt_governorates/FeatureServer/0",
      renderer: {
        type: "simple",
        symbol: {
          type: "simple-fill",
          color: [0, 0, 0, 0],
          outline: {
            color: [255, 255, 255, 0.2],
            width: 0.5
          }
        }
      } as any,
      opacity: 0.8
    });
    map.add(govLayer);

    const usersHeatmapLayer = new FeatureLayer({
      url: "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Users/FeatureServer/0",
      renderer: {
        type: "heatmap",
        colorStops: [
          { color: "rgba(63, 40, 102, 0)", ratio: 0 },
          { color: "#472b77", ratio: 0.083 },
          { color: "#4e2d87", ratio: 0.166 },
          { color: "#563098", ratio: 0.25 },
          { color: "#5d32a8", ratio: 0.333 },
          { color: "#6735be", ratio: 0.416 },
          { color: "#7139d4", ratio: 0.5 },
          { color: "#7b3ce9", ratio: 0.583 },
          { color: "#853fff", ratio: 0.666 },
          { color: "#a46fbf", ratio: 0.75 },
          { color: "#c29f80", ratio: 0.833 },
          { color: "#e0cf40", ratio: 0.916 },
          { color: "#ffff00", ratio: 1 }
        ],
        maxPixelIntensity: 25,
        minPixelIntensity: 0
      } as any,
      opacity: 1
    });
    map.add(usersHeatmapLayer);

    return () => { try { view.destroy(); } catch (_) {} };
  }, []);

  const colorStr = (c: number, m: number) => {
    const [r, g, b] = getColorForCount(c, m);
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1200, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '14px', width: '96vw', maxWidth: '1350px', height: '88vh', border: '1px solid var(--border-color)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--accent-blue)', fontSize: '18px' }}>🔥 Users Heatmap Map</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '26px', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div ref={mapDiv} style={{ flex: 2, minWidth: 0, height: '100%', position: 'relative' }} />
          <div style={{ width: '300px', flexShrink: 0, borderLeft: '1px solid var(--border-color)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
            <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>📊 Clients by Region</h4>
            {regionsStats.length > 0 ? (
              <>
                <div style={{ height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                      <XAxis type="number" stroke="var(--text-muted)" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="governorate" stroke="var(--text-muted)" tick={{ fontSize: 10 }} width={85} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '12px' }} />
                      <Bar dataKey="count" name="Clients" radius={[0, 4, 4, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={colorStr(entry.count, maxCount)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Color Legend</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                    {[
                      { label: '0 Clients', color: 'rgba(48, 54, 61, 0.4)' },
                      { label: '1 - 25%', color: 'rgba(144, 238, 144, 0.8)' },
                      { label: '26 - 50%', color: 'rgba(255, 255, 51, 0.8)' },
                      { label: '51 - 75%', color: 'rgba(255, 153, 51, 0.9)' },
                      { label: '76 - 100%', color: 'rgba(255, 51, 51, 1)' }
                    ].map((bucket, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '16px', height: '16px', backgroundColor: bucket.color, borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{bucket.label} of Max ({maxCount})</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                  {chartData.map((r) => (
                    <div key={r.governorate} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: colorStr(r.count, maxCount), flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-primary)', fontSize: '12px' }}>{r.governorate}</span>
                      </div>
                      <span style={{ color: 'var(--accent-blue)', fontWeight: 'bold', fontSize: '12px' }}>{r.count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0', fontSize: '13px' }}>No regional data available yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegionsWebMapModal;
