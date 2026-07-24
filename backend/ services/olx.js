const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const Account = require('../models/Account');

async function loginWithOTP(account) {
  console.log(`🔐 Logging in ${account.email}...`);
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  await page.goto('https://www.olx.in/login/', { 
    waitUntil: 'networkidle2' 
  });

  await page.type('#userEmail', account.phone);
  await page.click('#submit-btn');

  console.log(`📱 Enter OTP for ${account.phone} in browser`);
  console.log(`⏳ Waiting 2 minutes...`);

  try {
    await page.waitForNavigation({ timeout: 120000 });
    
    const cookies = await page.cookies();
    account.cookies = cookies;
    account.isLoggedIn = true;
    account.status = 'active';
    account.lastActive = new Date();
    await account.save();

    console.log(`✅ Login successful for ${account.email}`);
  } catch (error) {
    console.log(`❌ Login timeout for ${account.email}`);
  }

  await browser.close();
  return account;
}

async function postAdOnOLX(account, ad) {
  console.log(`🚀 Posting "${ad.title}" on ${account.email}`);
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  // Load cookies
  if (account.cookies) {
    await page.setCookie(...account.cookies);
  }

  await page.goto('https://www.olx.in/post-ad/', { 
    waitUntil: 'networkidle2' 
  });

  // Check if logged in
  const isLoggedIn = await page.evaluate(() => {
    return document.querySelector('.login-wrapper') === null;
  });

  if (!isLoggedIn) {
    console.log(`🔐 Session expired, login required`);
    await loginWithOTP(account);
    await page.setCookie(...account.cookies);
    await page.goto('https://www.olx.in/post-ad/');
  }

  // Fill form
  await page.waitForSelector('input[data-testid="title-input"]', { timeout: 30000 });
  
  await page.type('input[data-testid="title-input"]', ad.title);
  await page.type('input[data-testid="price-input"]', ad.price.toString());
  await page.type('textarea[data-testid="description-textarea"]', ad.description);
  await page.type('input[data-testid="location-input"]', ad.location);
  await page.keyboard.press('Enter');

  // Click post
  await page.click('button[data-testid="post-ad-button"]');

  // Check CAPTCHA
  await page.waitForTimeout(5000);
  const captchaExists = await page.evaluate(() => {
    return document.querySelector('.captcha-container') !== null;
  });

  if (captchaExists) {
    console.log(`⚠️ CAPTCHA! Solve manually in browser`);
    await page.waitForTimeout(60000);
  }

  // Wait for success
  try {
    await page.waitForSelector('.success-message, .ad-posted-message', { 
      timeout: 60000 
    });
    
    const url = await page.url();
    console.log(`✅ Ad posted: ${url}`);
    
    account.totalPosts += 1;
    await account.save();

    await browser.close();
    return { success: true, url };

  } catch (error) {
    console.log(`❌ Post failed for ${account.email}`);
    await browser.close();
    return { success: false, error: error.message };
  }
}

module.exports = { loginWithOTP, postAdOnOLX };
