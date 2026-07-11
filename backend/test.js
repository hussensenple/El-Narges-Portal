const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/elnarges').then(() => {
  return mongoose.connection.db.collection('units').find({ownerId: {$ne: null}}).toArray();
}).then(res => {
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
});
