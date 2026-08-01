const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

exports.sendComplaintEmail = async (userEmail, userName, complaintTitle, status) => {
    try {
        let emailSubject = 'تحديث بخصوص شكوتك - منصة النرجس';
        let emailMessage = '';

        if (status === 'Maintenance') {
            emailSubject = '🚧 الشكوى قيد الصيانة - منصة النرجس';
            emailMessage = 'نود إعلامك بأنه تم مراجعة شكوتك وتحويلها لقسم الصيانة، وجاري العمل على حل المشكلة في أسرع وقت.';
        } else if (status === 'Dismissed') {
            emailSubject = '❌ تم رفض الشكوى - منصة النرجس';
            emailMessage = 'نود إعلامك بأنه تم مراجعة شكوتك وإغلاقها، إما لعدم استيفاء الشروط أو لأن المشكلة تقع خارج نطاق الإدارة.';
        } else {
            emailSubject = '✅ تم حل شكوتك - منصة النرجس';
            emailMessage = 'نود إعلامك بأنه تم بنجاح حل الشكوى المقدمة من طرفكم.';
        }

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: emailSubject,
            html: `
              <div style="font-family: Arial, sans-serif; text-align: right; direction: rtl;">
                <h3>أهلاً بك أستاذ ${userName}،</h3>
                <p>${emailMessage}</p>
                <p style="color: #555;"><strong>تفاصيل الشكوى المُقدمة:</strong> ${complaintTitle}</p>
                <p>شكراً لثقتكم بنا، ونتمنى لكم يوماً سعيداً!</p>
                <hr>
                <p style="color: gray; font-size: 12px;">إدارة منصة النرجس العقارية</p>
              </div>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log(`Complaint status email sent to ${userEmail}`);
    } catch (error) {
        console.error('Error sending complaint email:', error);
    }
};

exports.sendBookingEmail = async (userEmail, userName, status, unitId, additionalMessage = '') => {
    try {
        let subject = '';
        let html = '';
        
        if (status === 'Approved') {
            subject = '🎉 تمت الموافقة على طلب الشراء - منصة النرجس';
            html = `
              <div style="font-family: Arial, sans-serif; text-align: right; direction: rtl;">
                <h3>أهلاً بك أستاذ ${userName}،</h3>
                <p>تهانينا! لقد تمت <strong>الموافقة</strong> على طلب شراء الوحدة/الفيلا رقم <strong>${unitId}</strong>.</p>
                <p>سيقوم فريق المبيعات بالتواصل معك قريباً لإتمام إجراءات التعاقد.</p>
                <p>شكراً لثقتكم بنا، ونتمنى لكم يوماً سعيداً!</p>
                <hr>
                <p style="color: gray; font-size: 12px;">إدارة منصة النرجس العقارية</p>
              </div>
            `;
        } else if (status === 'Declined') {
            subject = '❌ تم رفض طلب الشراء (الوسيط) - منصة النرجس';
            html = `
              <div style="font-family: Arial, sans-serif; text-align: right; direction: rtl;">
                <h3>أهلاً بك أستاذ ${userName}،</h3>
                <p>نأسف لإبلاغك بأنه تم <strong>رفض</strong> طلب الشراء للوحدة/الفيلا رقم <strong>${unitId}</strong> من قِبل الوسيط العقاري المسؤول.</p>
                ${additionalMessage ? `<p style="color: #555;"><strong>السبب:</strong> ${additionalMessage}</p>` : ''}
                <p>شكراً لثقتكم بنا، ونتمنى لكم يوماً سعيداً!</p>
                <hr>
                <p style="color: gray; font-size: 12px;">إدارة منصة النرجس العقارية</p>
              </div>
            `;
        } else if (status === 'Rejected') {
            subject = '❌ تم رفض طلب الشراء (الإدارة) - منصة النرجس';
            html = `
              <div style="font-family: Arial, sans-serif; text-align: right; direction: rtl;">
                <h3>أهلاً بك أستاذ ${userName}،</h3>
                <p>نأسف لإبلاغك بأنه تم <strong>رفض</strong> طلب الشراء للوحدة/الفيلا رقم <strong>${unitId}</strong> من قِبل الإدارة.</p>
                ${additionalMessage ? `<p style="color: #555;"><strong>السبب:</strong> ${additionalMessage}</p>` : ''}
                <p>شكراً لثقتكم بنا، ونتمنى لكم يوماً سعيداً!</p>
                <hr>
                <p style="color: gray; font-size: 12px;">إدارة منصة النرجس العقارية</p>
              </div>
            `;
        }

        if (!subject) return;

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject,
            html
        };
        await transporter.sendMail(mailOptions);
        console.log(`Booking ${status} email sent to ${userEmail}`);
    } catch (error) {
        console.error('Error sending booking email:', error);
        // Fallback: Send error report to Admin (hussiensenple@gmail.com)
        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: process.env.EMAIL_USER,
                subject: `⚠️ فشل في إرسال إيميل للعميل (${userEmail})`,
                html: `<div style="direction: rtl; text-align: right;">
                    <p>لقد فشل النظام في إرسال الإيميل الخاص بالموافقة/الرفض إلى العميل.</p>
                    <p><strong>إيميل العميل:</strong> ${userEmail}</p>
                    <p><strong>حالة الوحدة:</strong> ${status}</p>
                    <p><strong>رسالة الخطأ:</strong> ${error.message}</p>
                    <p>قد يكون إيميل العميل غير صحيح (Fake) أو غير موجود.</p>
                </div>`
            });
            console.log(`Fallback error email sent to admin for ${userEmail}`);
        } catch (adminError) {
            console.error('Failed to send fallback email to admin:', adminError);
        }
    }
};
