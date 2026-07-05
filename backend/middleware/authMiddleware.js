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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ElNargesSecretKey2026'); // استخدمنا نفس الـ Secret اللي في الـ Register
    
    // 🚀 التعديل هنا: بنطبع الـ decoded عشان نتأكد شكل الداتا إيه
    console.log("Decoded Token:", decoded);

    // بنحفظ الداتا بناءً على شكلها جوه التوكن (يا إما جوه كائن user أو مباشرة)
    req.user = decoded.user || decoded; 
    
    next(); // اتفضل عدي
  } catch (err) {
    console.error("Token Verification Error:", err.message);
    res.status(401).json({ msg: 'مفتاح الدخول غير صالح' });
  }
};