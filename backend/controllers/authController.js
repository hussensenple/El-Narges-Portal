const User = require('../models/User');
const bcrypt = require('bcrypt'); // مكتبة تشفير الباسورد
const jwt = require('jsonwebtoken'); // مكتبة عمل التوكن (عشان اليوزر يفضل مسجل دخول)

// 1. دالة إنشاء حساب جديد (Register)
const register = async (req, res) => {
  try {
    // بنستقبل الداتا من الـ Frontend (وضفنا الـ role والـ location)
    const { name, email, phone, password, role, countryStatus, governorate } = req.body;

    // التأكد إن مفيش حد مسجل بنفس التليفون أو الإيميل قبل كده
    const existingUser = await User.findOne({ $or: [{ phone }, { email }] });
    if (existingUser) {
      return res.status(400).json({ msg: 'Phone number or email is already registered.' });
    }

    // تشفير الباسورد (عشان لو الداتابيز اتسربت محدش يعرف الباسوردات)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // حماية: بنحدد الـ Role، لو الـ Frontend بعت 'broker' هنحطه، غير كده هيبقى 'user' افتراضي
    // ده بيمنع أي حد يسجل نفسه كـ admin أو owner بالاختراق
    const userRole = role === 'broker' ? 'broker' : 'user';

    // إنشاء مستخدم جديد
    const newUser = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role: userRole,
      countryStatus,
      governorate
    });

    await newUser.save();

    // إنشاء Token عشان العميل يفضل مسجل دخول
    const token = jwt.sign(
      { id: newUser._id }, 
      process.env.JWT_SECRET || 'ElNargesSecretKey2026', 
      { expiresIn: '7d' } // التوكن بيفضل شغال 7 أيام
    );

    res.status(201).json({
      msg: 'تم إنشاء الحساب بنجاح',
      token,
      user: { id: newUser._id, name: newUser.name, role: newUser.role }
    });

  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ msg: 'حدث خطأ في السيرفر أثناء إنشاء الحساب' });
  }
};

// 2. دالة تسجيل الدخول (Login)
const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // بندور على العميل برقم التليفون
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({ msg: 'رقم الهاتف أو كلمة المرور غير صحيحة' });
    }

    // بنقارن الباسورد اللي العميل كتبه بالباسورد المتشفر في الداتابيز
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'رقم الهاتف أو كلمة المرور غير صحيحة' });
    }

    // لو كله تمام، بنعمله التوكن
    const token = jwt.sign(
      { id: user._id }, 
      process.env.JWT_SECRET || 'ElNargesSecretKey2026', 
      { expiresIn: '7d' }
    );

    res.status(200).json({
      msg: 'تم تسجيل الدخول بنجاح',
      token,
      user: { id: user._id, name: user.name, role: user.role }
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ msg: 'حدث خطأ في السيرفر أثناء تسجيل الدخول' });
  }
};

module.exports = { register, login };