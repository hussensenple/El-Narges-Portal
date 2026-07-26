const express = require('express');
const router = express.Router();
const technicianController = require('../controllers/technicianController');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, technicianController.addTechnician);
router.post('/webhook/survey123', technicianController.addTechnicianFromSurvey123);
router.get('/', auth, technicianController.getTechnicians);
router.delete('/:id', auth, technicianController.deleteTechnician);

module.exports = router;

