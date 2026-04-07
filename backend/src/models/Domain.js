const mongoose = require('mongoose');

const domainSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  primaryEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  secondaryEmails: {
    type: [String],
    default: [],
  },
  lastScanDate: {
    type: Date,
    default: null,
  },
  nextScanDate: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'scanning', 'completed', 'failed'],
    default: 'pending',
  },
  totalBrokenLinks: {
    type: Number,
    default: 0,
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Domain', domainSchema);
