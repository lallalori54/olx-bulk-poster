const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  accountId: { type: String, required: true },
  accountEmail: { type: String, required: true },
  from: { type: String, required: true },
  phone: { type: String, default: '' },
  adTitle: { type: String, default: '' },
  message: { type: String, required: true },
  time: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false },
  replySent: { type: Boolean, default: false },
  replyText: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);
