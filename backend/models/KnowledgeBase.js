const mongoose = require('mongoose');

const knowledgeBaseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  subcategory: { type: String, required: true },
  content: { type: String, required: true },
  embedding: { type: [Number], required: true }
}, { timestamps: true });

module.exports = mongoose.model('KnowledgeBase', knowledgeBaseSchema);
