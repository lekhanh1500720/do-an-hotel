require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const { testConnection } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const hotelRoutes = require('./routes/hotelRoutes');
const roomRoutes = require('./routes/roomRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const reportRoutes = require('./routes/reportRoutes');
const customerRoutes = require('./routes/customerRoutes');

const app = express();

// Allow only configured frontend origins (comma-separated in .env)
app.use(
  cors({
    origin: function (origin, callback) {
      const allowed = (process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5500')
        .split(',')
        .map(function (s) { return s.trim(); });
      if (!origin || allowed.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Hotel Management API is running', time: new Date().toISOString() });
});

// Serve the frontend statically so the whole app runs on one server
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/customers', customerRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error. Please try again later.' });
});

const PORT = process.env.PORT || 5000;

// Start the server only after confirming DB connectivity
async function start() {
  try {
    await testConnection();
    console.log('Connected to MySQL database successfully.');
    app.listen(PORT, () => {
      console.log(`Hotel Management API listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to connect to MySQL. Check your .env credentials:', err.message);
    process.exit(1);
  }
}

start();