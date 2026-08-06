require('dotenv').config();
const mongoose = require('mongoose');

const REASONS = [
  'Served By Another Client',
  'Management Decision',
  'Downpayment Delay',
  'Client Unresponsive',
  'Changed mind',
  'Spam or fake info',
  'Duplicate Request',
  'Insufficient Budget',
  'Rejected payment plan',
];

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const BookingRequest = mongoose.model('BookingRequest', new mongoose.Schema({}, { strict: false }), 'bookingrequests');

  // Find ALL requests (Rejected + Declined) with no reason
  const noReasonRequests = await BookingRequest.find({
    status: { $in: ['Rejected', 'Declined'] },
    $or: [
      { rejectionReason: null },
      { rejectionReason: '' },
      { rejectionReason: { $exists: false } }
    ]
  });

  console.log(`Found ${noReasonRequests.length} with no reason.`);
  
  // Show breakdown by status
  const rejected = noReasonRequests.filter(r => r.status === 'Rejected');
  const declined = noReasonRequests.filter(r => r.status === 'Declined');
  console.log(`  Rejected: ${rejected.length}, Declined: ${declined.length}`);

  for (const req of noReasonRequests) {
    const randomReason = REASONS[Math.floor(Math.random() * REASONS.length)];
    await BookingRequest.findByIdAndUpdate(req._id, { rejectionReason: randomReason });
  }

  console.log('✅ Done! All rejections/declines now have a reason.');
  process.exit(0);
}).catch(err => {
  console.error('DB Error:', err);
  process.exit(1);
});
