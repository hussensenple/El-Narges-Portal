const express = require('express');
const router = express.Router();
const rolesController = require('../controllers/rolesController');

// 2. Change User Role (creates/deletes profiles automatically)
router.put('/change-role/:userId', rolesController.changeUserRole);

// 3. Edit User Info & Profile
router.put('/edit/:userId', rolesController.editUserInfo);

// 4. Assign Property
router.post('/assign-property', rolesController.assignProperty);

// 5. Remove Property
router.post('/remove-property', rolesController.removeProperty);

// 6. Admin Catalog (for property assignment UI)
router.get('/catalog', rolesController.getAdminCatalog);

// 7. Get units assigned to a specific user
router.get('/user-units/:userId', rolesController.getUserUnits);

// 1. Get users by role (MUST BE LAST to avoid intercepting /catalog)
router.get('/:role', rolesController.getUsersByRole);

// 8. Delete User
router.delete('/:userId', rolesController.deleteUser);

module.exports = router;
