const asyncHandler = require('express-async-handler');
const ScanReport = require('../models/ScanReport');

// @desc    Get all reports for a domain
// @route   GET /api/reports/domain/:domainId
// @access  Private
const getReportsByDomain = asyncHandler(async (req, res) => {
  const reports = await ScanReport.find({ domain: req.params.domainId }).sort({ createdAt: -1 });
  res.json(reports);
});

// @desc    Get single report details
// @route   GET /api/reports/:id
// @access  Private
const getReportById = asyncHandler(async (req, res) => {
  const report = await ScanReport.findById(req.params.id).populate('domain');

  if (report) {
    res.json(report);
  } else {
    res.status(404);
    throw new Error('Report not found');
  }
});

// @desc    Get latest report for a domain
// @route   GET /api/reports/domain/:domainId/latest
// @access  Private
const getLatestReportByDomain = asyncHandler(async (req, res) => {
  const report = await ScanReport.findOne({ domain: req.params.domainId })
    .sort({ createdAt: -1 })
    .populate('domain');

  if (report) {
    res.json(report);
  } else {
    res.status(404);
    throw new Error('No reports found for this domain');
  }
});

module.exports = {
  getReportsByDomain,
  getReportById,
  getLatestReportByDomain,
};
