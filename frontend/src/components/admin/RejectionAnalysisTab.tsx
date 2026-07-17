import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface RejectionRecord {
  _id: string;
  customerName: string;
  customerPhone: string;
  customerGmail: string;
  objectId?: number;
  unitId: string;
  sourceLayer: string;
  status: 'Rejected' | 'Declined';
  rejectionReason?: string;
  rejectionNotes?: string;
  updatedAt: string;
  userId?: { name: string; email: string };
}

const REASON_COLORS: Record<string, string> = {
  'Served By Another Client': '#8957e5',
  'Management Decision':      '#1f6feb',
  'Downpayment Delay':        '#d29922',
  'Client Unresponsive':      '#f85149',
  'Changed mind':             '#3fb950',
  'Spam or fake info':        '#e3b341',
  'Duplicate Request':        '#58a6ff',
  'Insufficient Budget':      '#bc8cff',
  'Rejected payment plan':    '#ff7b72',
};
const DEFAULT_COLOR = '#8b949e';

const RejectionAnalysisTab = () => {
  const [allRejections, setAllRejections] = useState<RejectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterReason, setFilterReason] = useState<string>('__all__');
  const [filterSource, setFilterSource] = useState<string>('__all__');

  useEffect(() => {
    const fetchRejections = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/rejection-analysis`, {
          headers: { 'x-auth-token': token }
        });
        setAllRejections(res.data);
      } catch (err) {
        console.error('Failed to load rejection analysis:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRejections();
  }, []);

  // All unique reasons for the dropdown — scoped to the selected source
  const uniqueReasons = useMemo(() => {
    const pool =
      filterSource === 'admin'  ? allRejections.filter(r => r.status === 'Rejected') :
      filterSource === 'broker' ? allRejections.filter(r => r.status === 'Declined') :
      allRejections;
    const reasons = new Set<string>();
    pool.forEach(r => { if (r.rejectionReason) reasons.add(r.rejectionReason); });
    return Array.from(reasons).sort();
  }, [allRejections, filterSource]);

  // Filtered list for the scrollable panel
  const filteredList = useMemo(() => {
    return allRejections.filter(r => {
      const reasonMatch = filterReason === '__all__' || r.rejectionReason === filterReason;
      const sourceMatch =
        filterSource === '__all__' ||
        (filterSource === 'admin' && r.status === 'Rejected') ||
        (filterSource === 'broker' && r.status === 'Declined');
      return reasonMatch && sourceMatch;
    });
  }, [allRejections, filterReason, filterSource]);

  // Chart data — always shows ALL reasons regardless of filter
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    allRejections.forEach(r => {
      const key = r.rejectionReason || 'No Reason';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }, [allRejections]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = allRejections.length;
      const count = payload[0].value;
      return (
        <div style={{ backgroundColor: '#161b22', padding: '10px 14px', border: '1px solid #30363d', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 4px', color: '#e6edf3', fontWeight: 'bold', fontSize: '13px' }}>{label}</p>
          <p style={{ margin: '0 0 2px', color: '#f85149' }}>Count: <strong>{count}</strong></p>
          <p style={{ margin: 0, color: '#8b949e', fontSize: '12px' }}>{total > 0 ? ((count / total) * 100).toFixed(1) : 0}% of total</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#8b949e' }}>Loading Rejection Analysis...</div>;
  }

  return (
    <div style={{ display: 'flex', height: '100%', gap: '15px', padding: '15px', overflow: 'hidden', boxSizing: 'border-box' }}>

      {/* ─── LEFT PANEL: Scrollable Filtered List ─── */}
      <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>

        {/* Header + Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: '10px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, color: '#f85149' }}>📋 Rejected Requests</h3>
            <span style={{ color: '#8b949e', fontSize: '13px' }}>
              {filteredList.length} record{filteredList.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Source Filter */}
            <select
              value={filterSource}
              onChange={e => {
                setFilterSource(e.target.value);
                setFilterReason('__all__'); // Reset reason filter when source changes
              }}
              style={{
                padding: '8px 12px', backgroundColor: '#21262d', color: '#e6edf3',
                border: '1px solid #30363d', borderRadius: '8px', cursor: 'pointer', fontSize: '13px'
              }}
            >
              <option value="__all__">All Sources</option>
              <option value="admin">🔴 Admin Rejected</option>
              <option value="broker">🟠 Broker Declined</option>
            </select>
            {/* Reason Filter */}
            <select
              value={filterReason}
              onChange={e => setFilterReason(e.target.value)}
              style={{
                padding: '8px 12px', backgroundColor: '#21262d', color: '#e6edf3',
                border: '1px solid #30363d', borderRadius: '8px', cursor: 'pointer', fontSize: '13px'
              }}
            >
              <option value="__all__">All Reasons ({allRejections.length})</option>
              {uniqueReasons.map(r => (
                <option key={r} value={r}>{r} ({allRejections.filter(x => x.rejectionReason === r).length})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Card List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
          {filteredList.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8b949e', padding: '40px', backgroundColor: '#161b22', borderRadius: '12px', border: '1px solid #30363d' }}>
              No rejections found for the selected criteria.
            </div>
          ) : (
            filteredList.map(record => {
              const isAdmin = record.status === 'Rejected';
              const borderColor = isAdmin ? '#f85149' : '#d29922';
              const reasonColor = REASON_COLORS[record.rejectionReason || ''] || DEFAULT_COLOR;

              return (
                <div
                  key={record._id}
                  style={{
                    backgroundColor: '#161b22', border: `1px solid ${borderColor}33`,
                    borderLeft: `4px solid ${borderColor}`, borderRadius: '10px',
                    padding: '14px 16px', flexShrink: 0
                  }}
                >
                  {/* Top Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <span style={{ color: '#e6edf3', fontWeight: 'bold', fontSize: '15px' }}>{record.customerName}</span>
                      <span
                        style={{
                          marginLeft: '10px', fontSize: '11px', fontWeight: 'bold',
                          backgroundColor: isAdmin ? '#f8514922' : '#d2992222',
                          color: borderColor, padding: '2px 8px', borderRadius: '20px',
                          border: `1px solid ${borderColor}55`
                        }}
                      >
                        {isAdmin ? '🔴 Admin Rejected' : '🟠 Broker Declined'}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'block', color: '#8b949e', fontSize: '12px', marginBottom: '4px' }}>
                        🕐 {new Date(record.updatedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ color: '#58a6ff', fontSize: '16px', fontWeight: 'bold' }}>Unit #{record.objectId || record.unitId}</span>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px', fontSize: '12px', color: '#c9d1d9' }}>
                    <span>📞 {record.customerPhone}</span>
                    <span>✉️ {record.customerGmail}</span>
                  </div>

                  {/* Reason */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    {record.rejectionReason && (
                      <span style={{
                        backgroundColor: `${reasonColor}22`, color: reasonColor,
                        border: `1px solid ${reasonColor}55`, padding: '3px 10px',
                        borderRadius: '20px', fontSize: '12px', fontWeight: 'bold'
                      }}>
                        {record.rejectionReason}
                      </span>
                    )}
                    {record.rejectionNotes && (
                      <span style={{ color: '#8b949e', fontSize: '12px', fontStyle: 'italic' }}>
                        "{record.rejectionNotes}"
                      </span>
                    )}
                    {!record.rejectionReason && !record.rejectionNotes && (
                      <span style={{ color: '#444c56', fontSize: '12px', fontStyle: 'italic' }}>No reason provided</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── RIGHT PANEL: Bar Chart ─── */}
      <div style={{ flex: 2, backgroundColor: '#161b22', borderRadius: '12px', border: '1px solid #30363d', padding: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <h3 style={{ margin: '0 0 16px', color: '#e6edf3' }}>📊 Rejection Reasons</h3>
        <div style={{ flex: 1, minHeight: 0 }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 80 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" horizontal={false} />
                <XAxis type="number" stroke="#8b949e" tick={{ fontSize: 12, fill: '#8b949e' }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="reason"
                  stroke="#8b949e"
                  tick={{ fontSize: 11, fill: '#c9d1d9' }}
                  width={160}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#21262d' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.reason}
                      fill={REASON_COLORS[entry.reason] || DEFAULT_COLOR}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#8b949e' }}>
              No rejection data available yet.
            </div>
          )}
        </div>

        {/* Summary Footer */}
        {allRejections.length > 0 && (
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #30363d', display: 'flex', justifyContent: 'space-around', flexShrink: 0 }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ display: 'block', color: '#f85149', fontWeight: 'bold', fontSize: '18px' }}>
                {allRejections.filter(r => r.status === 'Rejected').length}
              </span>
              <span style={{ color: '#8b949e', fontSize: '11px' }}>Admin Rejected</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ display: 'block', color: '#d29922', fontWeight: 'bold', fontSize: '18px' }}>
                {allRejections.filter(r => r.status === 'Declined').length}
              </span>
              <span style={{ color: '#8b949e', fontSize: '11px' }}>Broker Declined</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ display: 'block', color: '#e6edf3', fontWeight: 'bold', fontSize: '18px' }}>
                {allRejections.length}
              </span>
              <span style={{ color: '#8b949e', fontSize: '11px' }}>Total</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default RejectionAnalysisTab;
