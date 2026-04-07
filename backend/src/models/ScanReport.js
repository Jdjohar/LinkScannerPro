const mongoose = require('mongoose');

const scanReportSchema = new mongoose.Schema({
  domain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Domain',
    required: true,
  },
  totalLinksFound: {
    type: Number,
    default: 0,
  },
  totalBrokenLinks: {
    type: Number,
    default: 0,
  },
  brokenLinks: [
    {
      pageUrl: {
        type: String,
        required: true,
      },
      brokenUrl: {
        type: String,
        required: true,
      },
      anchorText: {
        type: String,
        default: '',
      },
      statusCode: {
        type: Number,
        default: 0,
      },
      type: {
        type: String,
        enum: ['link', 'image', 'script', 'stylesheet', 'iframe', 'seo'],
        default: 'link',
      },
      errorType: {
        type: String,
        default: 'Broken',
      }
    }
  ],
  scanDuration: {
    type: Number, // In milliseconds
    default: 0,
  },
  status: {
    type: String,
    default: 'completed',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('ScanReport', scanReportSchema);
