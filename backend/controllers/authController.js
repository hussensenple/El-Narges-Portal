const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// تسجيل حساب جديد
exports.register = async (req, res) => {
  try {
    const { name, phone, password } = req.body;

    let user = await User.findOne({ phone });
    if (user) return res.status(400).json({ msg: 'رقم الهاتف مسجل بالفعل' });

    user = new User({ name, phone, password });

    // تشفير الباسورد
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    // إنشاء التوكن
    const payload = { user: { id: user.id, role: user.role, name: user.name } };
    jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: payload.user });
    });
  } catch (err) {
    console.error("🔴 خطأ في دالة إنشاء الحساب (Register):", err); // 👈 السطر ده هيكشف إيرور الـ 500
    res.status(500).json({ error: 'خطأ في السيرفر' });
  }
};

// تسجيل الدخول
exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ msg: 'بيانات الدخول غير صحيحة' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'بيانات الدخول غير صحيحة' });

    const payload = { user: { id: user.id, role: user.role, name: user.name } };
    jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: payload.user });
    });
  } catch (err) {
    console.error("🔴 خطأ في دالة تسجيل الدخول (Login):", err);
    res.status(500).json({ error: 'خطأ في السيرفر' });
  }
};