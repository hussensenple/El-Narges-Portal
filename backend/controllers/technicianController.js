const Technician = require('../models/Technician');
const User = require('../models/User');
const Complaint = require('../models/Complaint');

exports.addTechnician = async (req, res) => {
  try {
    const { name, phone, age, specialization } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'engineer') {
      return res.status(403).json({ msg: 'Access denied. Only engineers can add technicians.' });
    }

    const technician = new Technician({
      name,
      phone,
      age,
      specialization,
      addedBy: req.user.id
    });

    await technician.save();
    res.status(201).json({ msg: 'Technician added successfully', technician });
  } catch (error) {
    console.error("Error adding technician:", error);
    res.status(500).json({ msg: 'Server error adding technician' });
  }
};

exports.getTechnicians = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'engineer') {
      return res.status(403).json({ msg: 'Access denied. Only engineers can view technicians.' });
    }

    const technicians = await Technician.find().lean().sort({ createdAt: -1 });

    for (let tech of technicians) {
      tech.taskCount = await Complaint.countDocuments({
        assignedTechnician: tech._id,
        status: { $nin: ['Solved', 'Resolved'] }
      });
    }

    res.json(technicians);
  } catch (error) {
    console.error("Error fetching technicians:", error);
    res.status(500).json({ msg: 'Server error fetching technicians' });
  }
};

exports.deleteTechnician = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'engineer') {
      return res.status(403).json({ msg: 'Access denied. Only engineers can delete technicians.' });
    }

    const technician = await Technician.findById(req.params.id);
    if (!technician) {
      return res.status(404).json({ msg: 'Technician not found' });
    }

    // Optional: Check if technician has active tasks
    const activeTasks = await Complaint.countDocuments({
      'assignedTechnician': req.params.id,
      status: { $nin: ['Solved', 'Resolved', 'Dismissed'] }
    });

    if (activeTasks > 0) {
      return res.status(400).json({ msg: `Cannot delete technician. They have ${activeTasks} active tasks.` });
    }

    await Technician.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Technician deleted successfully' });
  } catch (error) {
    console.error("Error deleting technician:", error);
    res.status(500).json({ msg: 'Server error deleting technician' });
  }
};

exports.addTechnicianFromSurvey123 = async (req, res) => {
  try {
    console.log("📥 Received Survey123 Webhook Payload:", JSON.stringify(req.body, null, 2));
    const payload = req.body || {};
    const feature = payload.feature || payload;
    const attributes = feature.attributes || payload.attributes || payload;

    const name = attributes.name || attributes.Name || attributes['Full Name'] || attributes.full_name || attributes.fullName || 'فني من Survey123';
    const phone = attributes.phone || attributes.Phone || attributes['Phone Number'] || attributes.phone_number || attributes.phoneNumber || 'غير محدد';
    const age = Number(attributes.age || attributes.Age || attributes['Age']) || 30;
    
    let rawSpec = attributes.specialization || attributes.Specialization || attributes['Specialization'] || attributes.spec || '';
    const validSpecs = [
      'Plumbing (سباكة)', 
      'Electrical (كهرباء)', 
      'Carpentry (نجارة)', 
      'HVAC / Air Conditioning (تكييف وتبريد)', 
      'Landscaping / Agriculture (زراعة ولاند سكيب)', 
      'Structural / Construction (إنشاءات ومباني)', 
      'Sanitation / Cleaning (نظافة وصرف صحي)',
      'Elevators (مصاعد)',
      'Infrastructure (بنية تحتية / شبكات المياه)',
      'Other (أخرى)'
    ];

    let specialization = 'Other (أخرى)';
    if (validSpecs.includes(rawSpec)) {
      specialization = rawSpec;
    } else if (rawSpec) {
      const match = validSpecs.find(s => 
        s.toLowerCase().includes(rawSpec.toString().toLowerCase()) || 
        rawSpec.toString().toLowerCase().includes(s.split(' ')[0].toLowerCase())
      );
      if (match) specialization = match;
    }

    const addedBy = attributes.addedBy || attributes.added_by || null;

    const technician = new Technician({
      name,
      phone,
      age,
      specialization,
      addedBy
    });

    await technician.save();
    console.log("✅ New Technician saved to MongoDB from Survey123:", technician.name, "| Spec:", specialization);
    res.status(200).json({ success: true, technician });
  } catch (error) {
    console.error("❌ Survey123 Technician Webhook Error:", error);
    res.status(500).json({ error: "Failed to process Survey123 webhook", details: error.message });
  }
};


