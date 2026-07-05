import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './context/AuthContext' // 👈 استدعاء مزود السياق

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider> {/* 👈 تغليف التطبيق */}
      <App />
    </AuthProvider>
  </React.StrictMode>,
)