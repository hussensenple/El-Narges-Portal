import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './context/AuthContext.tsx' // 👈 استدعينا الذاكرة

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider> {/* 👈 غلفنا بيها الأبلكيشن */}
      <App />
    </AuthProvider>
  </React.StrictMode>,
)