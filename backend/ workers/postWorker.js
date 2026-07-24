const mongoose = require('mongoose');
const Account = require('../models/Account');
const Ad = require('../models/Ad');
const { postAdOnOLX } = require('../services/olx');

require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI);

async function processPendingAds() {
  console.log('🔄 Checking for pending ads...');
  
  const ads = await Ad.find({ status: 'processing' });
  
  for (const ad of ads) {
    for (const accountId of ad.postedOn) {
      const account = await Account.findById(accountId);
      
      if (account && account.isLoggedIn) {
        const result = await postAdOnOLX(account, ad);
        
        if (result.success) {
          ad.olxUrls.push(result.url);
        }
      }
    }
    
    ad.status = 'posted';
    await ad.save();
  }
  
  console.log('✅ Done processing');
  mongoose.disconnect();
}

processPendingAds();
