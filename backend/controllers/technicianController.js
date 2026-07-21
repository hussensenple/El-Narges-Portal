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
