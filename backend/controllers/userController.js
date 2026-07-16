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

const getBrokerUnits = async (req, res) => {
  try {
    const Unit = require('../models/Unit');
    const units = await Unit.find({ brokerId: req.user.id });
    res.status(200).json(units);
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الوحدات للوسيط' });
  }
};

const bcrypt = require('bcrypt');

const updateProfile = async (req, res) => {
  try {
    const { name, email, phone, secondaryEmail, secondaryPhone } = req.body;
    
    // Check if the primary email is being changed and if it already exists
    if (email) {
      const existingEmail = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (existingEmail) {
        return res.status(400).json({ msg: 'This primary email is already in use by another account.' });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { name, email, phone, secondaryEmail, secondaryPhone } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ msg: 'User not found.' });
    }

    res.status(200).json({ msg: 'Profile updated successfully!', user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while updating the profile.' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Incorrect current password.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ msg: 'Password changed successfully!' });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while changing the password.' });
  }
};

module.exports = { addUser, getMyUnits, getBrokerUnits, updateProfile, changePassword };