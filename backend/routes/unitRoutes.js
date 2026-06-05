const express = require('express');
const router = express.Router();
// بنستدعي الدوال اللي لسه كاتبينها في الـ Controller
const { addUnit, getUnits } = require('../controllers/unitController');

// لو حد بعت GET Request للرابط ده، هنجيبله كل المباني
router.get('/', getUnits);

// لو حد بعت POST Request للرابط ده، هنضيف مبنى جديد
router.post('/', addUnit);

module.exports = router;