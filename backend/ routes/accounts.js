const express = require('express');
const router = express.Router();
const Account = require('../models/Account');
const bcrypt = require('bcryptjs');

// GET all accounts
router.get('/', async (req, res) => {
  try {
    const accounts = await Account.find().sort({ createdAt: -1 });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ADD account
router.post('/', async (req, res) => {
  try {
    const { email, phone, password, proxy } = req.body;
    
    const existing = await Account.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Account already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const account = new Account({
      email,
      phone,
      password: hashedPassword,
      proxy: proxy || null
    });

    await account.save();
    res.json({ success: true, account });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE account
router.delete('/:id', async (req, res) => {
  try {
    await Account.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// BULK ADD
router.post('/bulk', async (req, res) => {
  try {
    const { accounts } = req.body;
    const results = [];
    
    for (const acc of accounts) {
      const hashedPassword = await bcrypt.hash(acc.password, 10);
      const account = new Account({
        email: acc.email,
        phone: acc.phone,
        password: hashedPassword,
        proxy: acc.proxy || null
      });
      await account.save();
      results.push(account);
    }

    res.json({ success: true, count: results.length, accounts: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
