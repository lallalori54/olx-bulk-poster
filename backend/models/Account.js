const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  proxy: { type: String, default: null },
  isLoggedIn: { type: Boolean, default: false },
  cookies: { type: Object, default: {} },
  status: { 
    type: String, 
    enum: ['active', 'pending', 'banned'],
    default: 'pending'
  },
  totalPosts: { type: Number, default: 0 },
  lastActive: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Account', AccountSchema);
