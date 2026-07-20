/**
 * seed_governorates.js
 * One-time script: assigns a random Egyptian governorate to existing eligible users
 * (owners + users with raised/rejected/approved booking requests) who have no governorate set.
 * Run once with: node seed_governorates.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");
const BookingRequest = require("./models/BookingRequest");

const GOVERNORATES = [
  "Cairo", "Giza", "Alexandria", "Dakahlia", "Red Sea", "Beheira",
  "Fayoum", "Gharbia", "Ismailia", "Menofia", "Minya", "Qaliubiya",
  "New Valley", "Suez", "Aswan", "Assiut", "Beni Suef", "Port Said",
  "Damietta", "Sharkia", "South Sinai", "Kafr Al sheikh", "Matrouh",
  "Luxor", "Qena", "North Sinai", "Sohag"
];

const randomGov = () => GOVERNORATES[Math.floor(Math.random() * GOVERNORATES.length)];

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/elnarges";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  // 1. Find all users with raised/approved/rejected booking requests
  const raisedRequests = await BookingRequest.find({
    status: { $in: ["Reserved", "Approved", "Rejected"] }
  }).select("userId");

  const eligibleIds = [...new Set(raisedRequests.map(r => r.userId.toString()))];

  // 2. Combine with all owners
  const eligibleUsers = await User.find({
    $or: [
      { role: "owner" },
      { _id: { $in: eligibleIds } }
    ],
    $or: [
      { governorate: { $exists: false } },
      { governorate: null },
      { governorate: "" }
    ]
  });

  console.log(`Found ${eligibleUsers.length} users without a governorate to seed.`);

  let updated = 0;
  for (const user of eligibleUsers) {
    const gov = randomGov();
    await User.updateOne(
      { _id: user._id },
      { $set: { governorate: gov, countryStatus: "Egypt" } }
    );
    console.log(`  -> ${user.name} (${user.role}) => ${gov}`);
    updated++;
  }

  console.log(`\nDone! Updated ${updated} users with random governorates.`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error("Seed error:", err);
  mongoose.disconnect();
});
