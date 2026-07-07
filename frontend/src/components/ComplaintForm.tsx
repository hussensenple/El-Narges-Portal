import React, { useState } from 'react';
import axios from 'axios';

interface ComplaintFormProps {
  arcgisId: string; // الـ ID بتاع الوحدة من الخريطة
  onClose: () => void; // دالة بتقفل الفورم بعد الإرسال
}

const ComplaintForm: React.FC<ComplaintFormProps> = ({ arcgisId, onClose }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // هنجيب التوكن من الـ Local Storage (أو من الـ AuthContext لو بتخزنه هناك)
      const token = localStorage.getItem('token'); 

      // التأكد من تعديل البورت لو الباك إند شغال على بورت مختلف
      const response = await axios.post('http://localhost:5000/api/complaints/submit', {
        arcgisId,
        title,
        description
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setMessage({ text: response.data.msg, type: 'success' });
      
      // تفريغ الحقول وقفل الفورم بعد ثانيتين
      setTitle('');
      setDescription('');
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error: any) {
      setMessage({ 
        text: error.response?.data?.msg || 'حدث خطأ أثناء إرسال الشكوى', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={{ color: '#2c3e50', textAlign: 'center' }}>تقديم شكوى / صيانة 🛠️</h2>
        <p style={{ textAlign: 'center', color: '#7f8c8d', fontSize: '14px' }}>
          رقم الوحدة: {arcgisId}
        </p>

        {message && (
          <div style={{
            padding: '10px',
            marginBottom: '15px',
            borderRadius: '5px',
            textAlign: 'center',
            backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
            color: message.type === 'success' ? '#155724' : '#721c24'
          }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>عنوان الشكوى:</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={styles.input}
            placeholder="مثال: تسريب مياه، مشكلة بالكهرباء..."
          />

          <label style={styles.label}>تفاصيل الشكوى:</label>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...styles.input, height: '100px', resize: 'none' }}
            placeholder="اشرح المشكلة بالتفصيل هنا..."
          />

          <div style={styles.buttonContainer}>
            <button type="button" onClick={onClose} style={styles.cancelBtn} disabled={loading}>
              إلغاء
            </button>
            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? 'جاري الإرسال...' : 'إرسال الشكوى'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 🎨 ستايلات بسيطة عشان الفورم تطلع بشكل Modal محترم (تقدر تغيرها لـ Tailwind أو CSS لاحقاً)
const styles = {
  overlay: {
    position: 'fixed' as 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  modal: {
    backgroundColor: '#fff',
    padding: '30px',
    borderRadius: '10px',
    width: '400px',
    maxWidth: '90%',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    direction: 'rtl' as 'rtl',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as 'column',
  },
  label: {
    marginBottom: '8px',
    fontWeight: 'bold',
    color: '#34495e',
  },
  input: {
    padding: '10px',
    marginBottom: '20px',
    borderRadius: '5px',
    border: '1px solid #ccc',
    fontSize: '16px',
    fontFamily: 'inherit',
  },
  buttonContainer: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  submitBtn: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  cancelBtn: {
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '16px',
  }
};

export default ComplaintForm;