const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const unController = require('../controllers/utilityNetworkController');

// @route   POST api/utility-network/trace
// @desc    Perform an Isolation Trace given a starting pipe OBJECTID
// @access  Private (Engineer)
router.post('/trace', auth, unController.performIsolationTrace);

// @route   POST api/utility-network/notify
// @desc    Notify owners of affected meters
// @access  Private (Engineer)
router.post('/notify', auth, unController.notifyOwners);

// @route   POST api/utility-network/connected-trace
// @desc    Perform a Connected Trace
// @access  Private (Engineer)
router.post('/connected-trace', auth, unController.performConnectedTrace);

module.exports = router;
