const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { sendComplaintEmail } = require('../utils/emailService');

// 1. تقديم شكوى جديدة (خاص بالـ Owner)
const submitComplaint = async (req, res) => {
  try {
    const { arcgisId, title, type, images, description, coordinates } = req.body;
    const ownerId = req.user.id;

    // التأكد إن المستخدم فعلاً مالك (Owner)
    const user = await User.findById(ownerId);
    if (user.role !== 'owner') {
      return res.status(403).json({ msg: 'عفواً، يحق للملاك فقط تقديم شكاوى على وحداتهم.' });
    }

    const newComplaint = new Complaint({
      ownerId,
      arcgisId,
      title,
      type,
      images,
      description,
      coordinates
    });

    await newComplaint.save();

    // إرسال الإشعار اللحظي للأدمن
    req.app.get('io').emit('newComplaint');

    res.status(201).json({ msg: 'تم إرسال شكوتك بنجاح، سيتم مراجعتها في أقرب وقت.' });
  } catch (error) {
    console.error("Complaint Submission Error:", error);
    res.status(500).json({ error: 'حدث خطأ أثناء إرسال الشكوى' });
  }
};

// 2. عرض جميع الشكاوى (خاص بالـ Admin)
const getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find()
      .populate('ownerId', 'name email phone')
      .sort({ createdAt: -1 });

    res.status(200).json(complaints);
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الشكاوى' });
  }
};

// 3. تحديث حالة الشكوى وإرسال إيميل ديناميكي للمالك (خاص بالـ Admin)
const resolveComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { status } = req.body; // 🚀 التريكة هنا: استقبال الحالة من الفرونت إند

    const complaint = await Complaint.findById(complaintId).populate('ownerId', 'name email');
    if (!complaint) {
      return res.status(404).json({ msg: 'الشكوى غير موجودة' });
    }

    // 🚀 تحديث حالة الشكوى بالحالة اللي جاية من زرار الأدمن (Maintenance أو Dismissed)
    complaint.status = status || 'Resolved';
    await complaint.save();

    // 📧 إرسال إيميل بالقرار للمالك
    await sendComplaintEmail(complaint.ownerId.email, complaint.ownerId.name, complaint.title, status);

    res.status(200).json({ msg: 'تم تحديث حالة الشكوى وإرسال بريد إلكتروني للمالك بنجاح.' });
  } catch (error) {
    console.error("Resolve Complaint Error:", error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث الشكوى' });
  }
};

// 4. جلب الشكاوى الخاصة بالمالك الحالي
const getMyComplaints = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const complaints = await Complaint.find({ ownerId }).sort({ createdAt: -1 });
    res.status(200).json(complaints);
  } catch (error) {
    console.error("Get My Complaints Error:", error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الشكاوى الخاصة بك' });
  }
};

// 5. Get Complaints for Engineer
const getEngineerComplaints = async (req, res) => {
  try {
    const engineerId = req.user.id;
    const EngineerProfile = require('../models/EngineerProfile');
    const profile = await EngineerProfile.findOne({ userId: engineerId });
    if (!profile) return res.status(403).json({ error: 'Engineer profile not found' });

    // Assuming the engineer gets all complaints
    const complaints = await Complaint.find()
      .populate('ownerId', 'name email phone')
      .populate('messages.senderId', 'name role')
      .populate('assignedTechnician', 'name phone')
      .sort({ createdAt: -1 });

    res.status(200).json({ complaints });
  } catch (error) {
    console.error("Get Engineer Complaints Error:", error);
    res.status(500).json({ error: 'Failed to fetch engineer complaints' });
  }
};

// 6. Update Priority (Admin)
const updateComplaintPriority = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { priority } = req.body;

    const complaint = await Complaint.findByIdAndUpdate(complaintId, { priority }, { new: true });
    if (!complaint) return res.status(404).json({ msg: 'Complaint not found' });

    res.status(200).json({ msg: 'Priority updated', complaint });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update priority' });
  }
};

// 7. Update Status & Problem Name (Technician/Admin)
const updateComplaintStatus = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { status, problemName } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (problemName) updateData.problemName = problemName;

    // If reverting back to Pending, clear the technician assignment so it
    // re-appears in the "New Complaints" pool for the engineer.
    if (status && status.toLowerCase() === 'pending') {
      updateData.assignedTechnician = null;
      updateData.assignedSpecialization = null;
    }

    const complaint = await Complaint.findByIdAndUpdate(complaintId, updateData, { new: true });
    if (!complaint) return res.status(404).json({ msg: 'Complaint not found' });

    res.status(200).json({ msg: 'Status updated', complaint });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
};

// 8. Add Message to Chat
const addComplaintMessage = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { text, senderName, senderRole } = req.body;
    const mongoose = require('mongoose');
    let validSenderId = req.user ? req.user.id : null;
    if (validSenderId && !mongoose.Types.ObjectId.isValid(validSenderId)) {
      validSenderId = null;
    }

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) return res.status(404).json({ msg: 'Complaint not found' });

    complaint.messages.push({
      senderId: validSenderId,
      senderName,
      senderRole,
      text
    });

    await complaint.save();

    res.status(200).json({ msg: 'Message sent', complaint });
  } catch (error) {
    console.error("Detailed Add Message Error:", error);
    res.status(500).json({ error: 'Failed to send message: ' + error.message });
  }
};

// 9. Assign Specialization and Technician
const assignComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedSpecialization, assignedTechnician } = req.body;

    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'engineer') {
      return res.status(403).json({ msg: 'Access denied. Only engineers can assign complaints.' });
    }

    const complaintToUpdate = await Complaint.findById(id);
    if (!complaintToUpdate) {
      return res.status(404).json({ msg: 'Complaint not found.' });
    }

    const updateData = { assignedSpecialization, assignedTechnician };
    
    // Automatically change status to 'In Progress' if it is 'Pending'
    if (complaintToUpdate.status === 'Pending') {
      updateData.status = 'In Progress';
    }

    const complaint = await Complaint.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('assignedTechnician');

    if (!complaint) {
      return res.status(404).json({ msg: 'Complaint not found.' });
    }

    res.status(200).json({ msg: 'Complaint assigned successfully', complaint });
  } catch (error) {
    console.error("Error assigning complaint:", error);
    res.status(500).json({ msg: 'Server error assigning complaint' });
  }
};

module.exports = {
  submitComplaint,
  getAllComplaints,
  resolveComplaint,
  getMyComplaints,
  getEngineerComplaints,
  updateComplaintPriority,
  updateComplaintStatus,
  addComplaintMessage,
  assignComplaint
};