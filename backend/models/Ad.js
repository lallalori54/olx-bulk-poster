const mongoose = require('mongoose');

const AdSchema = new mongoose.Schema({
  title: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  images: { type: [String], default: [] },
  postedOn: { type: [String], default: [] },
  status: { 
    type: String, 
    enum: ['draft', 'posted', 'failed'],
    default: 'draft'
  },
  olxUrls: { type: [String], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Ad', AdSchema);
