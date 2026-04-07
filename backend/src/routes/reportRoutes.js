const express = require('express');
const router = express.Router();
const {
  getReportsByDomain,
  getReportById,
  getLatestReportByDomain,
} = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');

router.get('/:id', protect, getReportById);
router.get('/domain/:domainId', protect, getReportsByDomain);
router.get('/domain/:domainId/latest', protect, getLatestReportByDomain);

module.exports = router;
