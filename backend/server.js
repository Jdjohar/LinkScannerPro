const express = require('express');
const http = require('http');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./src/config/db');
const { errorHandler, notFound } = require('./src/middleware/errorMiddleware');
const { initSocket } = require('./src/socket');

// Route imports
const authRoutes = require('./src/routes/authRoutes');
const domainRoutes = require('./src/routes/domainRoutes');
const reportRoutes = require('./src/routes/reportRoutes');

// Service imports
const { initScheduler } = require('./src/services/schedulerService');

// Load env vars
dotenv.config();

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);

// Socket.io Setup
const io = initSocket(server);

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true,
}));
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/reports', reportRoutes);

// Root Route
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'Active', 
    message: 'Link Scanner Engine is online.',
    endpoint: '/api'
  });
});

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Broken Link Scanner API is running' });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Initialize Scheduler
initScheduler();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Export server for testing or other uses
module.exports = { app, server, io };
