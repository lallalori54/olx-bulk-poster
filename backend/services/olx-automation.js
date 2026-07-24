const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const Account = require('../models/Account');
const Ad = require('../models/Ad');
const Message = require('../models/Message');

class OLXAutomation {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async initBrowser(proxy = null) {
        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1366,768'
        ];

        if (proxy) {
            args.push(`--proxy-server=${proxy}`);
        }

        this.browser = await puppeteer.launch({
            headless: false, // Show browser for OTP/CAPTCHA
            args: args,
            timeout: 60000
        });

        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1366, height: 768 });
        await this.page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        return this.page;
    }

    async loginWithOTP(account) {
        console.log(`🔐 Logging in ${account.email}...`);
        
        const page = await this.initBrowser(account.proxy);
        
        // Go to OLX login
        await page.goto('https://www.olx.in/login/', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });

        // Wait for page load
        await page.waitForSelector('#userEmail', { timeout: 10000 });

        // Enter phone number
        await page.type('#userEmail', account.phone);
        await page.click('#submit-btn');

        console.log(`📱 Please enter OTP for ${account.phone} in browser`);
        console.log(`⏳ Waiting 2 minutes for OTP...`);

        // Wait for OTP and login completion
        try {
            await page.waitForNavigation({ 
                timeout: 120000, 
                waitUntil: 'networkidle2' 
            });
        } catch (error) {
            console.log('⏰ OTP timeout, please try again');
            await this.browser.close();
            return false;
        }

        // Save cookies
        const cookies = await page.cookies();
        account.cookies = cookies;
        account.isLoggedIn = true;
        account.lastActive = new Date();
        await account.save();

        // Save session to file (for persistence)
        const fs = require('fs');
        fs.writeFileSync(`./sessions/${account._id}.json`, JSON.stringify(cookies));

        console.log(`✅ Login successful for ${account.email}`);
        await this.browser.close();
        return true;
    }

    async postAd(accountId, adId, accountIds) {
        const account = await Account.findById(accountId);
        const ad = await Ad.findById(adId);

        if (!account || !ad) {
            throw new Error('Account or Ad not found');
        }

        console.log(`🚀 Posting ad "${ad.title}" for ${account.email}`);

        const page = await this.initBrowser(account.proxy);

        // Load saved session
        if (account.cookies) {
            await page.setCookie(...account.cookies);
        }

        // Go to post ad page
        await page.goto('https://www.olx.in/post-ad/', { 
            waitUntil: 'networkidle2',
            timeout: 60000 
        });

        // Check if logged in
        const isLoggedIn = await page.evaluate(() => {
            return document.querySelector('.login-wrapper') === null;
        });

        if (!isLoggedIn) {
            console.log(`🔐 Session expired, logging in again...`);
            await this.loginWithOTP(account);
            // Reload page with new cookies
            await page.setCookie(...account.cookies);
            await page.goto('https://www.olx.in/post-ad/');
        }

        // Wait for form
        await page.waitForSelector('input[data-testid="title-input"]', { timeout: 30000 });

        // Fill ad form
        console.log('📝 Filling ad form...');
        
        // Title
        await page.type('input[data-testid="title-input"]', ad.title);
        
        // Price
        await page.type('input[data-testid="price-input"]', ad.price.toString());
        
        // Description
        await page.type('textarea[data-testid="description-textarea"]', ad.description);
        
        // Category selection (Mobiles)
        await page.click('button[data-testid="category-select"]');
        await page.waitForTimeout(2000);
        await page.click('li[data-testid="category-option"]:contains("Mobiles")');
        
        // Upload images (using Cloudinary URLs or local files)
        if (ad.images && ad.images.length > 0) {
            const fileInput = await page.$('input[type="file"]');
            // Download image from Cloudinary and upload
            const imagePath = await this.downloadImage(ad.images[0]);
            await fileInput.uploadFile(imagePath);
            await page.waitForTimeout(3000);
        }
        
        // Location
        await page.type('input[data-testid="location-input"]', ad.location);
        await page.waitForTimeout(1000);
        await page.keyboard.press('Enter');

        // Click Post
        console.log('📤 Submitting ad...');
        await page.click('button[data-testid="post-ad-button"]');

        // Check for CAPTCHA
        await page.waitForTimeout(5000);
        const captchaExists = await page.evaluate(() => {
            return document.querySelector('.captcha-container') !== null;
        });

        if (captchaExists) {
            console.log('⚠️ CAPTCHA detected! Please solve manually in browser');
            console.log('⏳ Waiting 60 seconds...');
            await page.waitForTimeout(60000);
        }

        // Wait for success
        try {
            await page.waitForSelector('.success-message, .ad-posted-message', { 
                timeout: 60000 
            });
            const adUrl = await page.url();
            
            // Update ad
            ad.olxUrls.push(adUrl);
            ad.status = 'posted';
            await ad.save();

            // Update account
            account.totalPosts += 1;
            await account.save();

            console.log(`✅ Ad posted successfully: ${adUrl}`);
            
            // Send notification (optional)
            // await this.sendNotification(account, adUrl);

            await this.browser.close();
            return { success: true, url: adUrl };

        } catch (error) {
            console.error('❌ Post failed:', error);
            ad.status = 'failed';
            await ad.save();
            
            await this.browser.close();
            return { success: false, error: error.message };
        }
    }

    async fetchMessages(accountId) {
        const account = await Account.findById(accountId);
        if (!account) return [];

        console.log(`📩 Fetching messages for ${account.email}`);

        const page = await this.initBrowser(account.proxy);

        // Load session
        if (account.cookies) {
            await page.setCookie(...account.cookies);
        }

        // Go to messages
        await page.goto('https://www.olx.in/messages/', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Check login
        const isLoggedIn = await page.evaluate(() => {
            return document.querySelector('.login-wrapper') === null;
        });

        if (!isLoggedIn) {
            console.log(`🔐 Session expired for ${account.email}`);
            await this.browser.close();
            return [];
        }

        // Scrape messages
        const messages = await page.evaluate(() => {
            const items = document.querySelectorAll('.message-item, .conversation-item');
            const result = [];
            
            items.forEach(item => {
                const from = item.querySelector('.sender-name')?.textContent?.trim() || 'Unknown';
                const message = item.querySelector('.message-text')?.textContent?.trim() || '';
                const time = item.querySelector('.message-time')?.textContent?.trim() || '';
                const phone = item.querySelector('.phone-number')?.textContent?.trim() || '';
                const adTitle = item.querySelector('.ad-title')?.textContent?.trim() || '';
                
                if (message) {
                    result.push({ from, message, time, phone, adTitle });
                }
            });
            
            return result;
        });

        // Save to database
        for (const msg of messages) {
            const existing = await Message.findOne({
                accountId: account._id,
                message: msg.message,
                from: msg.from
            });

            if (!existing) {
                await Message.create({
                    accountId: account._id,
                    accountEmail: account.email,
                    from: msg.from,
                    phone: msg.phone,
                    adTitle: msg.adTitle,
                    message: msg.message,
                    time: new Date(msg.time || Date.now()),
                    isRead: false,
                    replySent: false
                });
                console.log(`💬 New message from ${msg.from}`);
            }
        }

        await this.browser.close();
        return messages;
    }

    async replyToMessage(accountId, messageId, replyText) {
        const account = await Account.findById(accountId);
        const message = await Message.findById(messageId);

        if (!account || !message) {
            throw new Error('Account or Message not found');
        }

        console.log(`✉️ Replying to ${message.from} from ${account.email}`);

        const page = await this.initBrowser(account.proxy);

        // Load session
        if (account.cookies) {
            await page.setCookie(...account.cookies);
        }

        // Go to messages
        await page.goto('https://www.olx.in/messages/', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Find and click on message
        await page.evaluate((from) => {
            const items = document.querySelectorAll('.message-item');
            for (const item of items) {
                if (item.textContent.includes(from)) {
                    item.click();
                    break;
                }
            }
        }, message.from);

        await page.waitForTimeout(2000);

        // Type reply
        await page.type('textarea[placeholder*="reply"], .reply-input', replyText);
        await page.click('button[type="submit"], .send-btn');

        // Update message
        message.replySent = true;
        message.replyText = replyText;
        message.repliedAt = new Date();
        await message.save();

        console.log(`✅ Reply sent to ${message.from}`);
        await this.browser.close();

        return { success: true };
    }

    async downloadImage(url) {
        const axios = require('axios');
        const fs = require('fs');
        const path = require('path');
        
        const response = await axios({
            url: url,
            method: 'GET',
            responseType: 'stream'
        });

        const filename = `temp_${Date.now()}.jpg`;
        const filepath = path.join(__dirname, '../temp', filename);
        
        const writer = fs.createWriteStream(filepath);
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(filepath));
            writer.on('error', reject);
        });
    }
}

module.exports = new OLXAutomation();
