const express = require('express');
const router = express.Router();
const {
  getDomains,
  addDomain,
  updateDomain,
  deleteDomain,
  triggerScan,
} = require('../controllers/domainController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getDomains);
router.post('/', protect, addDomain);
router.put('/:id', protect, updateDomain);
router.delete('/:id', protect, deleteDomain);
router.post('/:id/scan', protect, triggerScan);

module.exports = router;
