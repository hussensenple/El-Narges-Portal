const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const User = require('../models/User');
const EngineerProfile = require('../models/EngineerProfile');

dotenv.config();

const seedEngineers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elnarges');
    console.log('MongoDB Connected...');

    // 1. Delete ALL existing engineers and their profiles
    const existingEngs = await User.find({ role: 'engineer' });
    const engIds = existingEngs.map(t => t._id);
    await EngineerProfile.deleteMany({ userId: { $in: engIds } });
    await User.deleteMany({ role: 'engineer' });
    console.log('Old engineer accounts removed.');

    // 2. Create new engineer
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Eng@1234', salt); // Standard password

    const user = new User({
      name: 'System Engineer',
      email: 'engineer@elnarges.com',
      phone: '01555000000',
      password: hashedPassword,
      role: 'engineer'
    });
    await user.save();

    const profile = new EngineerProfile({
      userId: user._id,
      manualId: 'ENG-001',
      age: 35,
      graduationYear: 2012
    });
    await profile.save();
    
    console.log(`Created: ${user.name} | Phone: ${user.phone} | Password: Eng@1234`);

    console.log('Engineer account generated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding engineers:', error);
    process.exit(1);
  }
};

seedEngineers();
