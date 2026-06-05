// بنستدعي جدول المباني اللي عملناه
const Unit = require('../models/Unit');

// 1. دالة إضافة مبنى جديد (Add Unit)
const addUnit = async (req, res) => {
  try {
    const newUnit = new Unit(req.body); // بناخد الداتا اللي جاية من الـ Frontend
    await newUnit.save(); // بنحفظها في MongoDB
    res.status(201).json({ message: "تم إضافة المبنى بنجاح! 🏢", unit: newUnit });
  } catch (error) {
    res.status(500).json({ error: "حدث خطأ: " + error.message });
  }
};

// 2. دالة جلب كل المباني (Get all Units)
const getUnits = async (req, res) => {
  try {
    const units = await Unit.find(); // بنجيب كل الداتا من الجدول
    res.status(200).json(units);
  } catch (error) {
    res.status(500).json({ error: "حدث خطأ: " + error.message });
  }
};

module.exports = { addUnit, getUnits };