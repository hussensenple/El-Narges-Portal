// استدعاء المكتبات الأساسية
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); // 👈 استدعاء مكتبة http الأساسية في نود
const { Server } = require("socket.io"); // 👈 استدعاء مكتبة Socket.io

// تشغيل تطبيق الإكسبريس
const app = express();

// 🚀 إعداد سيرفر الـ HTTP وربطه بالـ Express والـ Socket.io
const server = http.createServer(app); 
const io = new Server(server, {
  cors: {
    origin: "*", // بيسمح للفرونت إند يكلم الـ Sockets من أي مكان
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});
app.set('io', io);

// 💡 حفظ نسخة من io في الـ app عشان نقدر نستخدمها في ملفات الـ Routes ونبعت إشعارات
app.set('socketio', io);

// ==========================================
// 1. Middlewares (حراس البوابة)
// ==========================================
app.use(cors()); // بيسمح للـ React يكلم السيرفر من غير مشاكل أمنية
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
// const unitRoutes = require('./routes/unitRoutes');
// app.use('/api/units', unitRoutes); 
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/weather', require('./routes/weatherRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/complaints', require('./routes/complaintRoutes'));
app.use('/api/roles', require('./routes/rolesRoutes')); // 🚀 مسارات إدارة الأدوار الجديدة
app.use('/api/technicians', require('./routes/technicianRoutes'));
app.use('/api/utility-network', require('./routes/utilityNetworkRoutes'));
// ==========================================
// 2. مسار تجريبي (Test Route)
// ==========================================
app.get('/', (req, res) => {
  res.send('El Narges Real Estate API & WebSockets are running... 🦅🚀');
});

// ==========================================
// 3. الاتصال بقاعدة البيانات وتشغيل السيرفر
// ==========================================
const PORT = process.env.PORT || 5000;

// 🎧 مراقبة اتصالات الـ WebSockets (عشان نتأكد إن العميل أو الأدمن شبك معانا)
io.on('connection', (socket) => {
  console.log(`🔌 New Web-Socket Connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`🔌 Web-Socket Disconnected: ${socket.id}`);
  });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully!');
    
    // ⚠️ التعديل الأهم: بنشغل server.listen بدل app.listen عشان الـ API والـ Sockets يشتغلوا سوا
    server.listen(PORT, () => {
      console.log(`🚀 Server & WebSockets are running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ Error connecting to MongoDB:', error.message);
  });