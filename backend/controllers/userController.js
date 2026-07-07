const User = require('../models/User');

const addUser = async (req, res) => {
  try {
    // بناخد البيانات من الـ Frontend
    const { name, email, phone, password, role } = req.body;

    // تحديد الـ Role، لو مبعوت 'broker' هنقبله، ولو مش مبعوت هيبقى 'user'
    const userRole = role === 'broker' ? 'broker' : 'user';

    const newUser = new User({
      name,
      email,
      phone,
      password, // (يفضل في المستقبل تعملها Hashing هنا كمان لو الدالة دي بتستخدم من غير الـ Admin)
      role: userRole
    });

    await newUser.save();
    res.status(201).json({ message: "تم تسجيل العميل بنجاح! 👤", user: newUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// دالة لجلب وحدات المالك الحالي
const getMyUnits = async (req, res) => {
  try {
    // هنجيب اليوزر من التوكن ونعمل populate عشان نجيب بيانات الوحدات كاملة
    const user = await User.findById(req.user.id).populate('ownedUnits');
    
    if (!user) return res.status(404).json({ msg: 'المستخدم غير موجود' });
    
    // هنبعت مصفوفة الوحدات للفرونت إند
    res.status(200).json(user.ownedUnits);
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الوحدات' });
  }
};

module.exports = { addUser, getMyUnits };