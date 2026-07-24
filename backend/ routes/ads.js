const express = require('express');
const router = express.Router();
const Ad = require('../models/Ad');
const Account = require('../models/Account');

// CREATE ad
router.post('/', async (req, res) => {
  try {
    const { title, price, description, location, images } = req.body;
    
    const ad = new Ad({
      title,
      price,
      description,
      location,
      images: images || []
    });

    await ad.save();
    res.json({ success: true, ad });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET all ads
router.get('/', async (req, res) => {
  try {
    const ads = await Ad.find().sort({ createdAt: -1 });
    res.json(ads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST ad on accounts (trigger worker)
router.post('/:id/post', async (req, res) => {
  try {
    const { accountIds } = req.body;
    const ad = await Ad.findById(req.params.id);
    
    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    // Update ad with accounts
    ad.postedOn = accountIds;
    ad.status = 'processing';
    await ad.save();

    // Trigger background worker (via API call)
    // For now, return success
    res.json({ 
      success: true, 
      message: 'Posting started in background',
      adId: ad._id,
      accountCount: accountIds.length
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
