const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // 1. جلب التوكن من الهيدر (سواء x-auth-token أو Authorization القياسي)
  let token = req.header('x-auth-token') || req.header('Authorization');

  // لو مفيش توكن خالص في الطلب
  if (!token) {
    return res.status(401).json({ msg: 'لا يوجد مفتاح دخول، تم رفض الوصول' });
  }

  // 2. إذا كان التوكن يحتوي على كلمة "Bearer " (الخاصة بـ Axios)، قم بقصها للحصول على التوكن الصافي
  if (token.startsWith('Bearer ')) {
    token = token.split(' ')[1];
  }

  try {
    // فك التشفير والتأكد من صحة التوكن
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ElNargesSecretKey2026');
    
    // طباعة التوكن بعد فكه للتأكد في الكونسول
    console.log("Decoded Token Successfully ✅:", decoded);

    // حفظ بيانات المستخدم في الـ request
    req.user = decoded.user || decoded; 
    
    next(); // السماح بالمرور للمسار التالي
  } catch (err) {
    console.error("Token Verification Error ❌:", err.message);
    res.status(401).json({ msg: 'مفتاح الدخول غير صالح أو انتهت صلاحيته' });
  }
};