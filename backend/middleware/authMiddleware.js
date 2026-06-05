const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // جلب التوكن من الهيدر
  const token = req.header('x-auth-token');

  // لو مفيش توكن
  if (!token) {
    return res.status(401).json({ msg: 'لا يوجد مفتاح دخول، تم رفض الوصول' });
  }

  try {
    // فك التشفير والتأكد من صحة التوكن
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.user = decoded.user; // حفظ بيانات العميل في الريكويست
    next(); // اتفضل عدي
  } catch (err) {
    res.status(401).json({ msg: 'مفتاح الدخول غير صالح' });
  }
};