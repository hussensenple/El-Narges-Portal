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
  'Cleaning (نظافة)', 
  'General Maintenance (صيانة عامة)'
];

const TechniciansModal = ({ onClose }: TechniciansModalProps) => {
  const [activeTab, setActiveTab] = useState<'add' | 'list'>('list');
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [specialization, setSpecialization] = useState(SPECIALIZATIONS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>('All');

  useEffect(() => {
    if (activeTab === 'list') {
      fetchTechnicians();
    }
  }, [activeTab]);

  const fetchTechnicians = async () => {
    setIsLoading(true);
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

  const handleAddTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !age || !specialization) {
      alert('Please fill all fields');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${import.meta.env.VITE_API_URL}/api/technicians`, {
        name, phone, age: Number(age), specialization
      }, {
        headers: { 'x-auth-token': token }
      });
      
      alert('✅ Technician added successfully!');
      setName('');
      setPhone('');
      setAge('');
      setSpecialization(SPECIALIZATIONS[0]);
      setActiveTab('list'); // Switch to list view to see the new addition
    } catch (e: any) {
      console.error("Error adding technician:", e);
      alert(e.response?.data?.msg || 'Failed to add technician');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group technicians by specialization
  const groupedTechnicians = SPECIALIZATIONS.reduce((acc, spec) => {
    acc[spec] = technicians.filter(t => t.specialization === spec);
    return acc;
  }, {} as Record<string, Technician[]>);

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(13, 17, 23, 0.85)', zIndex: 99999999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#0d1117', width: '900px', maxWidth: '95vw', height: '80vh', borderRadius: '16px', border: '1px solid #30363d', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #30363d', padding: '20px' }}>
          <h2 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            👷 Technicians Management
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#ff7b72', fontSize: '24px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #30363d', backgroundColor: '#161b22' }}>
          <button 
            onClick={() => setActiveTab('list')}
            style={{ flex: 1, padding: '15px', border: 'none', backgroundColor: activeTab === 'list' ? '#1f6feb' : 'transparent', color: activeTab === 'list' ? '#fff' : '#8b949e', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', transition: '0.2s' }}
          >
            📋 Technicians Directory
          </button>
          <button 
            onClick={() => setActiveTab('add')}
            style={{ flex: 1, padding: '15px', border: 'none', backgroundColor: activeTab === 'add' ? '#2ea043' : 'transparent', color: activeTab === 'add' ? '#fff' : '#8b949e', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', transition: '0.2s' }}
          >
            ➕ Add New Technician
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#0d1117' }}>
          
          {/* TAB: Add Technician */}
          {activeTab === 'add' && (
            <div style={{ maxWidth: '500px', margin: '0 auto', backgroundColor: '#161b22', padding: '30px', borderRadius: '16px', border: '1px solid #30363d' }}>
              <h3 style={{ margin: '0 0 20px 0', color: '#58a6ff', textAlign: 'center' }}>Register New Technician</h3>
              <form onSubmit={handleAddTechnician} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ color: '#c9d1d9', fontWeight: 'bold' }}>Full Name:</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Ahmed Ali" style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#fff', fontSize: '15px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ color: '#c9d1d9', fontWeight: 'bold' }}>Phone Number:</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="01xxxxxxxxx" style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#fff', fontSize: '15px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ color: '#c9d1d9', fontWeight: 'bold' }}>Age:</label>
                  <input type="number" value={age} onChange={e => setAge(e.target.value)} required placeholder="e.g. 35" min="18" max="70" style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#fff', fontSize: '15px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ color: '#c9d1d9', fontWeight: 'bold' }}>Specialization:</label>
                  <select value={specialization} onChange={e => setSpecialization(e.target.value)} style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#fff', fontSize: '15px', cursor: 'pointer' }}>
                    {SPECIALIZATIONS.map(spec => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" disabled={isSubmitting} style={{ marginTop: '10px', padding: '14px', backgroundColor: isSubmitting ? '#2ea04388' : '#2ea043', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                  {isSubmitting ? 'Registering...' : 'Register Technician'}
                </button>
              </form>
            </div>
          )}

          {/* TAB: Technicians Directory */}
          {activeTab === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              
              {/* Filter Pills */}
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '15px', borderBottom: '1px solid #30363d', marginBottom: '20px', flexShrink: 0 }}>
                <button
                  onClick={() => setSelectedSpecialization('All')}
                  style={{ padding: '8px 16px', borderRadius: '20px', border: '1px solid #30363d', backgroundColor: selectedSpecialization === 'All' ? '#58a6ff' : '#21262d', color: selectedSpecialization === 'All' ? '#0d1117' : '#c9d1d9', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', transition: '0.2s' }}
                >
                  All Specialists
                </button>
                {SPECIALIZATIONS.map(spec => (
                  <button
                    key={spec}
                    onClick={() => setSelectedSpecialization(spec)}
                    style={{ padding: '8px 16px', borderRadius: '20px', border: '1px solid #30363d', backgroundColor: selectedSpecialization === spec ? '#58a6ff' : '#21262d', color: selectedSpecialization === spec ? '#0d1117' : '#c9d1d9', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', transition: '0.2s' }}
                  >
                    {spec}
                  </button>
                ))}
              </div>

              {/* List Content */}
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
                {isLoading ? (
                  <div style={{ color: '#8b949e', textAlign: 'center', padding: '40px' }}>Loading technicians...</div>
                ) : technicians.length === 0 ? (
                  <div style={{ color: '#8b949e', textAlign: 'center', padding: '40px' }}>No technicians found. Add some!</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    {SPECIALIZATIONS.filter(spec => selectedSpecialization === 'All' || selectedSpecialization === spec).map(spec => {
                      const group = groupedTechnicians[spec];
                      if (!group || group.length === 0) return null;
                      return (
                        <div key={spec} style={{ backgroundColor: '#161b22', padding: '20px', borderRadius: '12px', border: '1px solid #30363d' }}>
                          <h3 style={{ margin: '0 0 15px 0', color: '#58a6ff', borderBottom: '1px solid #30363d', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🛠️ {spec} <span style={{ backgroundColor: '#21262d', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', color: '#c9d1d9' }}>{group.length}</span>
                          </h3>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                            {group.map(tech => (
                              <div key={tech._id} style={{ backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '15px' }}>{tech.name}</span>
                                  <span style={{ backgroundColor: tech.status === 'Active' ? '#2ea04333' : '#da363333', color: tech.status === 'Active' ? '#3fb950' : '#ff7b72', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                                    {tech.status}
                                  </span>
                                </div>
                                <div style={{ color: '#8b949e', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  📞 <a href={`tel:${tech.phone}`} style={{ color: '#58a6ff', textDecoration: 'none' }}>{tech.phone}</a>
                                </div>
                                <div style={{ color: '#8b949e', fontSize: '13px' }}>🎂 {tech.age} Years Old</div>
                                <div style={{ color: '#f85149', fontSize: '13px', fontWeight: 'bold', marginTop: '2px' }}>
                                  🚨 Tasks: {tech.taskCount || 0} Active
                                </div>
                                <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '5px' }}>Added: {new Date(tech.createdAt).toLocaleDateString()}</div>
                                <button 
                                  onClick={() => handleDeleteTechnician(tech._id)}
                                  style={{ marginTop: '10px', padding: '6px', backgroundColor: '#da363322', color: '#ff7b72', border: '1px solid #da3633', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
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
