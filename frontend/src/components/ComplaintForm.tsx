import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';

interface ComplaintFormProps {
  onClose: () => void;
  arcgisId: string;
  view?: any;
  onPickingChange?: (isPicking: boolean) => void;
}

const ComplaintForm = ({ onClose, arcgisId, view, onPickingChange }: ComplaintFormProps) => {
  const [type, setType] = useState('internal');
  const [images, setImages] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [coordinates, setCoordinates] = useState<{lat: number, lon: number} | null>(null);
  const [isPickingMap, setIsPickingMap] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSetPicking = (isPicking: boolean) => {
    setIsPickingMap(isPicking);
    if (onPickingChange) {
      onPickingChange(isPicking); 
    }
  };

  useEffect(() => {
    let clickHandle: any = null;

    if (isPickingMap && view) {
      view.container.style.cursor = 'crosshair';

      clickHandle = view.on('click', (event: any) => {
        const lat = event.mapPoint.latitude;
        const lon = event.mapPoint.longitude;
        setCoordinates({ lat, lon });
        handleSetPicking(false); 
        view.container.style.cursor = 'default';
      });
    }

    return () => {
      if (clickHandle) clickHandle.remove();
      if (view) view.container.style.cursor = 'default';
    };
  }, [isPickingMap, view]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert("Please login first to submit a complaint.");
        return;
      }

      // 🚀 تجهيز عنوان أوتوماتيكي للشكوى عشان الباك إند ميزعلش
      const complaintTitle = type === 'external' ? 'External Issue' : 'Internal Maintenance';

      await axios.post(`${import.meta.env.VITE_API_URL}/api/complaints/submit`, {
        title: complaintTitle, // 👈 ضفنا الـ Title هنا
        arcgisId,
        type,
        images,
        description,
        coordinates
      }, {
        headers: { 'x-auth-token': token }
      });

      console.log("Submitted Successfully to Backend!");
      alert("Complaint submitted successfully! 🚀");
      onClose();
    } catch (error) {
      console.error("Error submitting complaint", error);
      alert("Error submitting complaint. Check console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isPickingMap) {
    return createPortal(
      <div style={{ position: 'fixed', top: 30, left: '50%', transform: 'translateX(-50%)', backgroundColor: '#da3633', color: '#fff', padding: '15px 30px', borderRadius: '30px', zIndex: 99999999, fontWeight: 'bold', display: 'flex', gap: '15px', alignItems: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
        📍 Please click on the issue location on the map...
        <button onClick={() => handleSetPicking(false)} style={{ background: '#fff', color: '#da3633', border: 'none', padding: '8px 15px', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel Selection</button>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#0d1117', padding: '20px', borderRadius: '16px', width: '550px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', border: '1px solid #30363d', color: '#fff', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
        <h2 style={{ marginTop: 0, borderBottom: '1px solid #30363d', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '20px' }}>
          🛠️ Submit Maintenance / Complaint Request
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ color: '#8b949e', fontWeight: 'bold' }}>Complaint Type:</label>
            <select 
              value={type} 
              onChange={(e) => {
                setType(e.target.value);
              }} 
              style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#161b22', border: '1px solid #30363d', color: '#fff', fontSize: '15px', cursor: 'pointer' }}
            >
              <option value="internal">Internal Maintenance (Inside the unit)</option>
              <option value="external">External Issue (Street / Public Facilities)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ color: '#8b949e', fontWeight: 'bold' }}>Attach Images (Optional):</label>
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              onChange={handleImageUpload} 
              style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#161b22', border: '1px dashed #30363d', color: '#fff' }}
            />
            {images.length > 0 && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                {images.map((img, i) => (
                  <img key={i} src={img} alt={`Preview ${i}`} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #30363d' }} />
                ))}
              </div>
            )}
          </div>

          {type === 'external' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#161b22', padding: '16px', borderRadius: '8px', border: '1px dashed #58a6ff' }}>
              <label style={{ color: '#8b949e', fontWeight: 'bold' }}>Issue Location on Map:</label>
              {coordinates ? (
                <div style={{ color: '#2ea043', fontSize: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>✅ Selected (Lat: {coordinates.lat.toFixed(4)}, Lon: {coordinates.lon.toFixed(4)})</span>
                  <button type="button" onClick={() => handleSetPicking(true)} style={{ background: 'transparent', color: '#58a6ff', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}>Change Location</button>
                </div>
              ) : (
                <button type="button" onClick={() => handleSetPicking(true)} style={{ padding: '12px', backgroundColor: '#1f6feb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                  📍 Click here to select location on 3D Map
                </button>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ color: '#8b949e', fontWeight: 'bold' }}>Issue Details:</label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe the issue in detail here..."
              style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#161b22', border: '1px solid #30363d', color: '#fff', fontSize: '15px', minHeight: '80px', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '5px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', backgroundColor: 'transparent', color: '#8b949e', border: '1px solid #30363d', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>Cancel</button>
            <button type="submit" disabled={isSubmitting || (type === 'external' && !coordinates)} style={{ padding: '10px 20px', backgroundColor: (isSubmitting || (type === 'external' && !coordinates)) ? '#b6232455' : '#2ea043', color: '#fff', border: 'none', borderRadius: '8px', cursor: (isSubmitting || (type === 'external' && !coordinates)) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
              {isSubmitting ? 'Submitting...' : 'Submit Complaint 🚀'}
            </button>
          </div>

        </form>
      </div>
    </div>,
    document.body
  );
};

export default ComplaintForm;