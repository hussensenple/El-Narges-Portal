import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';

interface Technician {
  _id: string;
  name: string;
  phone: string;
  age: number;
  specialization: string;
  status: string;
  createdAt: string;
  taskCount?: number;
}

interface TechniciansModalProps {
  onClose: () => void;
}

const SPECIALIZATIONS = [
  'Plumbing (سباكة)',
  'Electrical (كهرباء)',
  'Carpentry (نجارة)',
  'HVAC / Air Conditioning (تكييف وتبريد)',
  'Landscaping / Agriculture (زراعة ولاند سكيب)',
  'Structural / Construction (إنشاءات ومباني)',
  'Sanitation / Cleaning (نظافة وصرف صحي)',
  'Elevators (مصاعد)',
  'Infrastructure (بنية تحتية / شبكات المياه)',
  'Other (أخرى)'
];

const TechniciansModal = ({ onClose }: TechniciansModalProps) => {
  const [activeTab, setActiveTab] = useState<'add' | 'list'>('list');
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedSpecialization, setSelectedSpecialization] = useState<string>('All');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Complaints State
  const [complaints, setComplaints] = useState<any[]>([]);

  const fetchComplaints = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/complaints/engineer`, {
        headers: { 'x-auth-token': token }
      });
      setComplaints(res.data.complaints || []);
    } catch (e) {
      console.error("Error fetching complaints:", e);
    }
  };

  useEffect(() => {
    if (activeTab === 'list') {
      setIsLoading(true);
      setTechnicians([]);
      fetchTechnicians();
      fetchComplaints();
      const interval = setInterval(() => {
        fetchTechnicians();
        fetchComplaints();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const fetchTechnicians = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/technicians`, {
        headers: { 'x-auth-token': token }
      });
      setTechnicians(res.data);
    } catch (e) {
      console.error("Error fetching technicians:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTechnician = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this technician? This cannot be undone.")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/technicians/${id}`, {
        headers: { 'x-auth-token': token }
      });
      alert('Technician deleted successfully!');
      fetchTechnicians();
    } catch (e: any) {
      console.error("Error deleting technician:", e);
      alert(e.response?.data?.msg || 'Failed to delete technician');
    }
  };

  // Group technicians by specialization
  const groupedTechnicians = SPECIALIZATIONS.reduce((acc, spec) => {
    acc[spec] = technicians.filter(t => t.specialization === spec);
    return acc;
  }, {} as Record<string, Technician[]>);

  // Group active complaints by specialization (using taskCount + unassigned pending issues)
  const complaintCounts = SPECIALIZATIONS.reduce((acc, spec) => {
    // 1. Get assigned issues from technicians' taskCount
    const group = groupedTechnicians[spec] || [];
    let assignedCount = group.reduce((sum, tech) => sum + (tech.taskCount || 0), 0);

    // 2. Add unassigned/pending issues whose problemName matches this specialization
    let unassignedCount = complaints.filter(c =>
      c.status === 'Pending' &&
      (c.problemName === spec || c.assignedSpecialization === spec)
    ).length;

    // 3. Fallback: if we somehow have 'In Progress' complaints that weren't caught by taskCount 
    let extraInProgress = complaints.filter(c =>
      c.status === 'In Progress' && c.assignedSpecialization === spec
    ).length;

    acc[spec] = Math.max(assignedCount, extraInProgress) + unassignedCount;
    return acc;
  }, {} as Record<string, number>);

  // Sort specializations by complaint count descending
  const sortedSpecializations = [...SPECIALIZATIONS].sort((a, b) => complaintCounts[b] - complaintCounts[a]);

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(13, 17, 23, 0.85)', zIndex: 99999999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div onClick={(e) => { e.stopPropagation(); setIsDropdownOpen(false); }} style={{ backgroundColor: 'var(--bg-primary)', width: '1100px', maxWidth: '96vw', height: '85vh', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', padding: '12px 20px' }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' }}>
            👷 Technicians Management
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#ff7b72', fontSize: '20px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
          <button
            onClick={() => setActiveTab('list')}
            style={{ flex: 1, padding: '12px', border: 'none', backgroundColor: activeTab === 'list' ? 'var(--accent-blue-bg)' : 'transparent', color: activeTab === 'list' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', transition: '0.2s' }}
          >
            📋 Technicians Directory
          </button>
          <button
            onClick={() => setActiveTab('add')}
            style={{ flex: 1, padding: '12px', border: 'none', backgroundColor: activeTab === 'add' ? 'var(--accent-green)' : 'transparent', color: activeTab === 'add' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', transition: '0.2s' }}
          >
            ➕ Add New Technician
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: activeTab === 'list' ? 'auto' : 'hidden', padding: activeTab === 'list' ? '15px' : '0px', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>

          {/* TAB: Add Technician via Survey123 (AGOL + MongoDB Live Sync) */}
          {activeTab === 'add' && (
            <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '10px 20px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
                <h3 style={{ margin: 0, color: 'var(--accent-blue)', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ⚡ Register New Technician
                </h3>
                <a
                  href="https://survey123.arcgis.com/share/3700b74cb725401cb567bbdbefa7c41c"
                  target="_blank"
                  rel="noreferrer"
                  style={{ padding: '6px 12px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent-blue)', border: '1px solid var(--border-color)', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="Open Esri Survey123 external form"
                >
                  🌐 Esri Survey123 Link
                </a>
              </div>

              <div style={{ width: '100%', flex: 1, backgroundColor: 'var(--bg-primary)', overflow: 'hidden' }}>
                <iframe
                  src="https://survey123.arcgis.com/share/3700b74cb725401cb567bbdbefa7c41c?hide=navbar,footer"
                  width="100%"
                  height="100%"
                  style={{ border: 'none', display: 'block', width: '100%', height: '100%' }}
                  title="Survey123 Technician Registration"
                />
              </div>
            </div>
          )}






          {/* TAB: Technicians Directory */}
          {activeTab === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

              {/* Filter Pills */}
              {/* Custom Dropdown Filter */}
              <div style={{ marginBottom: '20px', position: 'relative', flexShrink: 0 }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>Filter by Specialization:</label>
                <div
                  onClick={(e) => { e.stopPropagation(); setIsDropdownOpen(!isDropdownOpen); }}
                  style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px 16px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '15px', fontWeight: 'bold' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {selectedSpecialization === 'All' ? 'All Specialists' : selectedSpecialization}
                    {selectedSpecialization !== 'All' && complaintCounts[selectedSpecialization] > 0 && (
                      <span style={{ backgroundColor: 'var(--accent-red-bg)', color: 'var(--text-primary)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>{complaintCounts[selectedSpecialization]} Active Issues</span>
                    )}
                  </div>
                  <span style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>▼</span>
                </div>

                {isDropdownOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 10, maxHeight: '300px', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    <div
                      onClick={() => { setSelectedSpecialization('All'); setIsDropdownOpen(false); }}
                      style={{ padding: '14px 16px', cursor: 'pointer', color: selectedSpecialization === 'All' ? 'var(--accent-blue)' : 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', backgroundColor: selectedSpecialization === 'All' ? 'var(--bg-hover)' : 'transparent', fontWeight: 'bold' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedSpecialization === 'All' ? 'var(--bg-hover)' : 'transparent'}
                    >
                      All Specialists
                    </div>
                    {sortedSpecializations.map(spec => (
                      <div
                        key={spec}
                        onClick={() => { setSelectedSpecialization(spec); setIsDropdownOpen(false); }}
                        style={{ padding: '14px 16px', cursor: 'pointer', color: selectedSpecialization === spec ? 'var(--accent-blue)' : 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', backgroundColor: selectedSpecialization === spec ? 'var(--bg-hover)' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedSpecialization === spec ? 'var(--bg-hover)' : 'transparent'}
                      >
                        <span>{spec}</span>
                        {complaintCounts[spec] > 0 && (
                          <span style={{ backgroundColor: 'var(--accent-red-bg)', color: 'var(--text-primary)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', boxShadow: '0 0 10px rgba(218,54,51,0.4)' }}>
                            {complaintCounts[spec]} Issues
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* List Content */}
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
                {isLoading ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading technicians...</div>
                ) : technicians.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No technicians found. Add some!</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    {sortedSpecializations.filter(spec => selectedSpecialization === 'All' || selectedSpecialization === spec).map(spec => {
                      const group = groupedTechnicians[spec];
                      if (!group || group.length === 0) return null;
                      return (
                        <div key={spec} style={{ backgroundColor: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                          <h3 style={{ margin: '0 0 15px 0', color: 'var(--accent-blue)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🛠️ {spec} <span style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{group.length}</span>
                          </h3>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                            {group.map(tech => (
                              <div key={tech._id} style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '13px' }}>{tech.name}</span>
                                  <span style={{ backgroundColor: tech.status === 'Active' ? 'var(--accent-green)33' : 'var(--accent-red-bg)33', color: tech.status === 'Active' ? '#3fb950' : '#ff7b72', padding: '2px 6px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}>
                                    {tech.status}
                                  </span>
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  📞 <a href={`tel:${tech.phone}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>{tech.phone}</a>
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>🎂 {tech.age} Years Old</div>
                                <div style={{ color: 'var(--accent-red)', fontSize: '11px', fontWeight: 'bold', marginTop: '2px' }}>
                                  🚨 Tasks: {tech.taskCount || 0} Active
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '3px' }}>Added: {new Date(tech.createdAt).toLocaleDateString()}</div>
                                <button
                                  onClick={() => handleDeleteTechnician(tech._id)}
                                  style={{ marginTop: '8px', padding: '4px', backgroundColor: 'var(--accent-red-bg)22', color: '#ff7b72', border: '1px solid var(--accent-red-bg)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TechniciansModal;
