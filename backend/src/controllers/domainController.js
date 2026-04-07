const asyncHandler = require('express-async-handler');
const Domain = require('../models/Domain');
const ScanReport = require('../models/ScanReport');
const { startScan } = require('../services/crawlerService');

// @desc    Get all domains
// @route   GET /api/domains
// @access  Private
const getDomains = asyncHandler(async (req, res) => {
  const domains = await Domain.find({}).sort({ createdAt: -1 });
  res.json(domains);
});

// @desc    Add a new domain
// @route   POST /api/domains
// @access  Private
const addDomain = asyncHandler(async (req, res) => {
  const { url, primaryEmail, secondaryEmails } = req.body;

  const domainExists = await Domain.findOne({ url });

  if (domainExists) {
    res.status(400);
    throw new Error('Domain already exists');
  }

  const domain = await Domain.create({
    url,
    primaryEmail,
    secondaryEmails: secondaryEmails || [],
    status: 'pending',
  });

  res.status(201).json(domain);
});

// @desc    Update a domain
// @route   PUT /api/domains/:id
// @access  Private
const updateDomain = asyncHandler(async (req, res) => {
  const domain = await Domain.findById(req.params.id);

  if (domain) {
    domain.url = req.body.url || domain.url;
    domain.primaryEmail = req.body.primaryEmail || domain.primaryEmail;
    domain.secondaryEmails = req.body.secondaryEmails || domain.secondaryEmails;

    const updatedDomain = await domain.save();
    res.json(updatedDomain);
  } else {
    res.status(404);
    throw new Error('Domain not found');
  }
});

// @desc    Delete a domain
// @route   DELETE /api/domains/:id
// @access  Private
const deleteDomain = asyncHandler(async (req, res) => {
  const domain = await Domain.findById(req.params.id);

  if (domain) {
    await Domain.deleteOne({ _id: domain._id });
    // Also delete reports for this domain
    await ScanReport.deleteMany({ domain: domain._id });
    res.json({ message: 'Domain and associated reports removed' });
  } else {
    res.status(404);
    throw new Error('Domain not found');
  }
});

// @desc    Trigger manual scan
// @route   POST /api/domains/:id/scan
// @access  Private
const triggerScan = asyncHandler(async (req, res) => {
  const domain = await Domain.findById(req.params.id);

  if (domain) {
    if (domain.status === 'scanning') {
      res.status(400);
      throw new Error('Scan already in progress');
    }

    // Trigger scan asynchronously
    startScan(domain._id).catch(err => console.error(`Scan failed for ${domain.url}:`, err));

    res.json({ message: 'Scan started' });
  } else {
    res.status(404);
    throw new Error('Domain not found');
  }
});

module.exports = {
  getDomains,
  addDomain,
  updateDomain,
  deleteDomain,
  triggerScan,
};
