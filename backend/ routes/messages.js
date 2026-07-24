const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// GET all messages (unified inbox)
router.get('/', async (req, res) => {
  try {
    const messages = await Message.find()
      .sort({ time: -1 })
      .limit(200);
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET unread count
router.get('/unread/count', async (req, res) => {
  try {
    const count = await Message.countDocuments({ isRead: false });
    res.json({ unread: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// MARK as read
router.put('/:id/read', async (req, res) => {
  try {
    await Message.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// REPLY to message
router.post('/reply', async (req, res) => {
  try {
    const { messageId, replyText } = req.body;
    
    // Update in database
    await Message.findByIdAndUpdate(messageId, {
      replySent: true,
      replyText: replyText,
      repliedAt: new Date()
    });

    // Trigger actual reply via worker
    res.json({ 
      success: true, 
      message: 'Reply will be sent shortly' 
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
