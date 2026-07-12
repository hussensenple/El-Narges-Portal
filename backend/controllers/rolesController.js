const User = require('../models/User');
const BrokerProfile = require('../models/BrokerProfile');
const EngineerProfile = require('../models/EngineerProfile');
const AdminProfile = require('../models/AdminProfile');
const Unit = require('../models/Unit');
const { updateArcGISStatus, checkAndUpdateBuildingCompleteness } = require('../services/arcgisService');

// 1. Get users by role
exports.getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    let users = await User.find({ role }).select('-password');
    
    // Attach profile data based on role
    if (role === 'owner') {
      users = await User.find({ role }).populate('ownedUnits').select('-password');
    } else if (role === 'broker') {
      const profiles = await BrokerProfile.find();
      users = users.map(u => ({ ...u.toObject(), profile: profiles.find(p => p.userId.toString() === u._id.toString()) || null }));
    } else if (role === 'engineer') {
      const profiles = await EngineerProfile.find();
      users = users.map(u => ({ ...u.toObject(), profile: profiles.find(p => p.userId.toString() === u._id.toString()) || null }));
    } else if (role === 'admin') {
      const profiles = await AdminProfile.find();
      users = users.map(u => ({ ...u.toObject(), profile: profiles.find(p => p.userId.toString() === u._id.toString()) || null }));
    }

    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users by role:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// 2. Change User Role (Handles manual IDs and profile creation/deletion)
exports.changeUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newRole, manualId, age, speciality, graduationYear } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const oldRole = user.role;

    // Cleanup old profile/units if downgrading to 'user'
    if (newRole === 'user') {
      if (oldRole === 'broker') {
        await BrokerProfile.findOneAndDelete({ userId });
        await Unit.updateMany({ brokerId: userId }, { brokerId: null });
      } else if (oldRole === 'engineer') {
        await EngineerProfile.findOneAndDelete({ userId });
      } else if (oldRole === 'admin') {
        await AdminProfile.findOneAndDelete({ userId });
      } else if (oldRole === 'owner') {
        // According to PRD, properties become available
        await Unit.updateMany({ ownerId: userId }, { ownerId: null, status: '1' });
        // NOTE: ArcGIS spatial layer sync would ideally happen here for each unit.
        user.ownedUnits = [];
      }
    }

    // Create new profile if upgrading
    if (newRole === 'broker') {
      if (!manualId) return res.status(400).json({ error: 'Manual ID required for Broker' });
      await BrokerProfile.findOneAndUpdate({ userId }, { manualId }, { upsert: true });
    } else if (newRole === 'engineer') {
      if (!manualId) return res.status(400).json({ error: 'Manual ID required for Engineer' });
      await EngineerProfile.findOneAndUpdate({ userId }, { manualId, age, speciality, graduationYear }, { upsert: true });
    } else if (newRole === 'admin') {
      if (!manualId) return res.status(400).json({ error: 'Manual ID required for Admin' });
      await AdminProfile.findOneAndUpdate({ userId }, { manualId, age }, { upsert: true });
    }

    // Update the base user role
    user.role = newRole;
    await user.save();

    res.status(200).json({ message: `Role successfully changed to ${newRole}`, user });
  } catch (error) {
    console.error('Error changing role:', error);
    res.status(500).json({ error: 'Failed to change role' });
  }
};

// 3. Edit User & Profile Info
exports.editUserInfo = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, phone, email, manualId, age, speciality, graduationYear } = req.body;

    const user = await User.findByIdAndUpdate(userId, { name, phone, email }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.role === 'broker' && manualId) {
      await BrokerProfile.findOneAndUpdate({ userId }, { manualId });
    } else if (user.role === 'engineer' && manualId) {
      await EngineerProfile.findOneAndUpdate({ userId }, { manualId, age, speciality, graduationYear });
    } else if (user.role === 'admin' && manualId) {
      await AdminProfile.findOneAndUpdate({ userId }, { manualId, age });
    }

    res.status(200).json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('Error editing user:', error);
    res.status(500).json({ error: 'Failed to edit user' });
  }
};

// 4. Assign Property (Owner or Broker)
exports.assignProperty = async (req, res) => {
  try {
    const { userId, unitId, arcgisObjectId, sourceLayer, targetRole } = req.body;

    if (targetRole === 'owner') {
      // 1. Save to MongoDB — also store sourceLayer and OBJECTID (display ID matching property catalog)
      const updatedUnit = await Unit.findOneAndUpdate(
        { arcgisId: unitId },
        { ownerId: userId, status: '4', sourceLayer: sourceLayer, objectId: arcgisObjectId },
        { upsert: true, new: true }
      );
      // 2. Add to user's ownedUnits array (MUST be ObjectId)
      await User.findByIdAndUpdate(userId, { $addToSet: { ownedUnits: updatedUnit._id } });
      // 3. Ensure user role is 'owner'
      await User.findByIdAndUpdate(userId, { role: 'owner' });
      // 4. ✅ Sync ArcGIS: mark property as Sold (status 4)
      const owner = await User.findById(userId);
      if (arcgisObjectId && sourceLayer) {
        await updateArcGISStatus(
          arcgisObjectId,
          '4',
          owner?.name || null,
          owner?.phone || null,
          owner?.email || null,
          sourceLayer
        );
      }
    } else if (targetRole === 'broker') {
      // Assign unit to broker — also store sourceLayer and OBJECTID
      await Unit.findOneAndUpdate(
        { arcgisId: unitId },
        { brokerId: userId, sourceLayer: sourceLayer, objectId: arcgisObjectId },
        { upsert: true }
      );
    }

    res.status(200).json({ message: `Property assigned to ${targetRole} successfully` });
  } catch (error) {
    console.error('Assign property error:', error);
    res.status(500).json({ error: 'Failed to assign property' });
  }
};

// 5. Remove Property (Owner or Broker)
exports.removeProperty = async (req, res) => {
  try {
    const { userId, unitId, currentRole } = req.body;

    if (currentRole === 'owner') {
      // ✅ Look up the unit FIRST to get its stored sourceLayer — don't trust the client
      const unitToRemove = await Unit.findOne({ arcgisId: unitId });
      const correctSourceLayer = unitToRemove?.sourceLayer || 'Units';
      const correctArcgisId = unitToRemove?.arcgisId || unitId;

      // Unlink from MongoDB unit
      const updatedUnit = await Unit.findOneAndUpdate(
        { arcgisId: unitId }, 
        { ownerId: null, status: '1' }
      );
      if (updatedUnit) {
        // Remove from user's ownedUnits array (MUST be ObjectId)
        await User.findByIdAndUpdate(userId, { $pull: { ownedUnits: updatedUnit._id } });
      }
      // Check if owner has no more properties — auto-downgrade to user
      const updatedUser = await User.findById(userId);
      if (!updatedUser.ownedUnits || updatedUser.ownedUnits.length === 0) {
        await User.findByIdAndUpdate(userId, { role: 'user' });
      }
      // ✅ Sync ArcGIS using the correct sourceLayer from MongoDB (Units vs Villas_Global)
      await updateArcGISStatus(correctArcgisId, '1', null, null, null, correctSourceLayer, unitToRemove?.objectId);
      console.log(`✅ ArcGIS reverted to Available for ${correctArcgisId} on layer ${correctSourceLayer}`);
      
      if (correctSourceLayer === 'Units') {
        try {
          const axios = require('axios');
          const unitsLayerUrl = "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37";
          const unitRes = await axios.get(`${unitsLayerUrl}/query`, {
            params: { where: `OBJECTID=${correctArcgisId}`, outFields: 'BuildingID_FK', f: 'json' }
          });
          const bldgFK = unitRes.data.features?.[0]?.attributes?.BuildingID_FK;
          if (bldgFK) {
            await checkAndUpdateBuildingCompleteness(bldgFK, correctArcgisId, 'Available');
          }
        } catch(err) { console.error('Failed to update building completeness on revert', err); }
      }
    } else if (currentRole === 'broker') {
      // Unassign broker from unit
      await Unit.findOneAndUpdate({ arcgisId: unitId }, { brokerId: null });
    }

    res.status(200).json({ message: 'Property removed successfully' });
  } catch (error) {
    console.error('Remove property error:', error);
    res.status(500).json({ error: 'Failed to remove property' });
  }
};

// 6. GET properties for admin assignment catalog
exports.getAdminCatalog = async (req, res) => {
  try {
    const { mode } = req.query; // 'owner' = Available only | 'broker' = Available + Interested, unassigned
    const axios = require('axios');

    const UNITS_URL   = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37';
    const VILLAS_URL  = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WSL3/FeatureServer/8';

    // For 'owner': only ArcGIS Status=Available (1)
    // For 'broker': ArcGIS Status=Available (1) OR Interested (2)
    // For 'all': Everything (for user map)
    let statusWhere = "1=1";
    if (mode === 'owner') statusWhere = `Status = '1' OR Status = 'Available'`;
    if (mode === 'broker') statusWhere = `Status = '1' OR Status = '2' OR Status = 'Available' OR Status = 'Interested'`;

    const [unitsRes, villasRes] = await Promise.all([
      axios.get(`${UNITS_URL}/query`, { params: { where: statusWhere, outFields: '*', f: 'json' } }),
      axios.get(`${VILLAS_URL}/query`, { params: { where: statusWhere, outFields: '*', f: 'json' } }),
    ]);

    let units = (unitsRes.data.features || []).map(f => ({ ...f.attributes, sourceLayer: 'Units', arcgisId: String(f.attributes.OBJECTID) }));
    let villas = (villasRes.data.features || []).map(f => ({ ...f.attributes, sourceLayer: 'Villas_Global', arcgisId: f.attributes.GlobalID || String(f.attributes.OBJECTID) }));

    // ✅ Always filter out properties already owned (ownerId set in MongoDB) IF mode is owner or broker.
    // For 'all' mode, we don't filter them out, but we SHOULD mark them as Sold (4) if MongoDB says they have an owner, ensuring perfect sync.
    const ownedUnits = await Unit.find({ ownerId: { $ne: null } }).select('arcgisId');
    const ownedIds = new Set(ownedUnits.map(u => u.arcgisId));
    
    if (mode !== 'all') {
      units  = units.filter(u => !ownedIds.has(u.arcgisId));
      villas = villas.filter(v => !ownedIds.has(v.arcgisId));
    } else {
      // For user catalog ('all'), force the Status to 4 (Sold) if MongoDB says it's owned
      units  = units.map(u => ownedIds.has(u.arcgisId) ? { ...u, Status: '4' } : u);
      villas = villas.map(v => ownedIds.has(v.arcgisId) ? { ...v, Status: '4' } : v);
    }

    if (mode === 'broker') {
      // ✅ Also filter out units already assigned to a broker in MongoDB
      const assignedUnits = await Unit.find({ brokerId: { $ne: null } }).select('arcgisId');
      const assignedIds = new Set(assignedUnits.map(u => u.arcgisId));
      units  = units.filter(u => !assignedIds.has(u.arcgisId));
      villas = villas.filter(v => !assignedIds.has(v.arcgisId));
    }

    res.status(200).json({ units, villas });
  } catch (error) {
    console.error('Admin catalog error:', error);
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
};

// 7. GET units assigned to a specific user (owner or broker)
exports.getUserUnits = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.query; // 'owner' or 'broker'

    let units = [];
    if (role === 'owner') {
      units = await Unit.find({ ownerId: userId });
    } else if (role === 'broker') {
      units = await Unit.find({ brokerId: userId });
    }
    res.status(200).json(units);
  } catch (error) {
    console.error('getUserUnits error:', error);
    res.status(500).json({ error: 'Failed to fetch user units' });
  }
};

// 8. Delete User
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Cleanup if they were not a standard user
    if (user.role === 'broker') {
      await BrokerProfile.findOneAndDelete({ userId });
      await Unit.updateMany({ brokerId: userId }, { brokerId: null });
    } else if (user.role === 'engineer') {
      await EngineerProfile.findOneAndDelete({ userId });
    } else if (user.role === 'admin') {
      await AdminProfile.findOneAndDelete({ userId });
    } else if (user.role === 'owner') {
      await Unit.updateMany({ ownerId: userId }, { ownerId: null, status: '1' });
    }
    
    await User.findByIdAndDelete(userId);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};
