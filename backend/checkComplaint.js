require('dotenv').config();
const mongoose = require('mongoose');
const Complaint = require('./models/Complaint');

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const complaint = await Complaint.findOne({ type: 'internal' }).sort({ createdAt: -1 });
    if (complaint) {
      console.log("Internal Complaint arcgisId:", complaint.arcgisId);
    } else {
      console.log("No internal complaints found");
    }
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
check();
