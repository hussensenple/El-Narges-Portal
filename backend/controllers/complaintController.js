const Complaint = require('../models/Complaint');
const User = require('../models/User');
const nodemailer = require('nodemailer');

// ⚙️ إعدادات الإيميل (Nodemailer)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // الإيميل بتاع المنصة (هتضيفه في ملف .env)
    pass: process.env.EMAIL_PASS  // الباسورد بتاع الـ App Passwords من جوجل
  }
});

// 1. تقديم شكوى جديدة (خاص بالـ Owner)
const submitComplaint = async (req, res) => {
  try {
    const { arcgisId, title, description } = req.body;
    const ownerId = req.user.id; // هنجيبه من الـ Token

    // التأكد إن المستخدم فعلاً مالك (Owner)
    const user = await User.findById(ownerId);
    if (user.role !== 'owner') {
      return res.status(403).json({ msg: 'عفواً، يحق للملاك فقط تقديم شكاوى على وحداتهم.' });
    }

    const newComplaint = new Complaint({
      ownerId,
      arcgisId,
      title,
      description
    });

    await newComplaint.save();
    res.status(201).json({ msg: 'تم إرسال شكوتك بنجاح، سيتم مراجعتها في أقرب وقت.' });
  } catch (error) {
    console.error("Complaint Submission Error:", error);
    res.status(500).json({ error: 'حدث خطأ أثناء إرسال الشكوى' });
  }
};

// 2. عرض جميع الشكاوى (خاص بالـ Admin)
const getAllComplaints = async (req, res) => {
  try {
    // هنجيب الشكاوى ونعمل populate عشان نجيب بيانات المالك (الاسم والإيميل)
    const complaints = await Complaint.find().populate('ownerId', 'name email phone');
    res.status(200).json(complaints);
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الشكاوى' });
  }
};

// 3. حل الشكوى وإرسال إيميل للمالك (خاص بالـ Admin)
const resolveComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;

    const complaint = await Complaint.findById(complaintId).populate('ownerId', 'name email');
    if (!complaint) {
      return res.status(404).json({ msg: 'الشكوى غير موجودة' });
    }

    // تحديث حالة الشكوى
    complaint.status = 'Resolved';
    await complaint.save();

    // 📧 إرسال إيميل للمالك بأن المشكلة اتحلت
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: complaint.ownerId.email,
      subject: '✅ تم حل شكوتك - منصة النرجس',
      html: `
        <div style="font-family: Arial, sans-serif; text-align: right; direction: rtl;">
          <h3>أهلاً بك أستاذ ${complaint.ownerId.name}،</h3>
          <p>نود إعلامك بأنه تم بنجاح حل الشكوى المقدمة من طرفكم بخصوص الوحدة الخاصة بكم.</p>
          <p><strong>عنوان الشكوى:</strong> ${complaint.title}</p>
          <p>شكراً لثقتكم بنا، ونتمنى لكم يوماً سعيداً!</p>
          <hr>
          <p style="color: gray; font-size: 12px;">إدارة منصة النرجس العقارية</p>
        </div>
      `
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Email Sending Error:", error);
        // مش هنوقف الـ Request لو الإيميل فشل، بس هنطبع Error
      } else {
        console.log('Email sent: ' + info.response);
      }
    });

    res.status(200).json({ msg: 'تم حل الشكوى وإرسال بريد إلكتروني للمالك بنجاح.' });
  } catch (error) {
    console.error("Resolve Complaint Error:", error);
    res.status(500).json({ error: 'حدث خطأ أثناء حل الشكوى' });
  }
};

module.exports = {
  submitComplaint,
  getAllComplaints,
  resolveComplaint
};