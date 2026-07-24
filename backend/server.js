require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cron = require('node-cron');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// Import Routes
const accountRoutes = require('./routes/accounts');
const adRoutes = require('./routes/ads');
const messageRoutes = require('./routes/messages');
const replyRoutes = require('./routes/reply');

// Use Routes
app.use('/api/accounts', accountRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reply', replyRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        accounts: '50+ supported'
    });
});

// ============ BACKGROUND CRON JOBS ============

// Fetch messages every 5 minutes
cron.schedule('*/5 * * * *', async () => {
    console.log('🔄 Fetching messages from all accounts...');
    try {
        const { fetchAllMessages } = require('./services/message-fetcher');
        await fetchAllMessages();
        console.log('✅ Messages fetched successfully');
    } catch (error) {
        console.error('❌ Error fetching messages:', error);
    }
});

// Check sessions every 30 minutes (refresh if needed)
cron.schedule('*/30 * * * *', async () => {
    console.log('🔄 Checking sessions...');
    try {
        const { refreshSessions } = require('./services/session-manager');
        await refreshSessions();
    } catch (error) {
        console.error('❌ Session refresh error:', error);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
