const express = require('express');
const router = express.Router();
const { bulkSyncUsers } = require('../controllers/arcgisSyncController');

// مسار المزامنة الشاملة (لاستخدامه مرة واحدة من الـ Admin)
router.post('/bulk-sync', bulkSyncUsers);

module.exports = router;
