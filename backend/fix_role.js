const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = require('./models/User');
  await User.updateOne({name: /Hussien/i}, {$set: {role: 'admin'}});
  console.log('Role restored to admin!');
  process.exit(0);
});
