const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  return null;
}

// POST /api/payments - process a mock payment for a booking
// Body: { booking_id, payment_method }
// Any card number ending in an odd digit fails; everything else succeeds.
// On success the booking is set to 'Confirmed'.
router.post(
  '/',
  authenticate,
  [
    body('booking_id').isInt().withMessage('booking_id must be an integer.'),
    body('payment_method').isIn(['Card', 'UPI', 'NetBanking']).withMessage('Invalid payment method.'),
  ],
  async (req, res, next) => {
    const invalid = handleValidation(req, res);
    if (invalid) return;

    const { booking_id, payment_method } = req.body;

    try {
      const [rows] = await db.query(
        `SELECT b.*, r.price_per_night, r.hotel_id FROM bookings b
         JOIN rooms r ON r.room_id = b.room_id
         WHERE b.booking_id = ?`,
        [booking_id]
      );
      const booking = rows[0];
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found.' });
      }
      // Only the booking owner can pay
      if (req.user.role !== 'admin' && booking.user_id !== req.user.user_id) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }

      const [existing] = await db.query(
        'SELECT payment_id FROM payments WHERE booking_id = ? AND payment_status = ?',
        [booking_id, 'Success']
      );
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: 'This booking has already been paid for.' });
      }
      if (booking.status === 'Cancelled') {
        return res.status(400).json({ success: false, message: 'A cancelled booking cannot be paid.' });
      }

      // Guard against double-confirmation: if another booking already
      // holds this room for overlapping dates as Confirmed/CheckedIn,
      // reject the payment so the same room is never double-booked.
      const [clash] = await db.query(
        `SELECT booking_id FROM bookings
         WHERE room_id = ? AND booking_id <> ?
           AND status IN ('Confirmed', 'CheckedIn')
           AND check_in_date < ? AND check_out_date > ?
         LIMIT 1`,
        [booking.room_id, booking_id, booking.check_out_date, booking.check_in_date]
      );
      if (clash.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'This room is no longer available for those dates. Booking cannot be confirmed.',
        });
      }

      // --- Mock gateway simulation ---
      // Simulate a short processing delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      const mockCardLast = (req.body.card_number || '').slice(-1);
      const willFail = req.body.card_number ? ['1', '3', '5', '7', '9'].includes(mockCardLast) : false;

      const transaction_ref = crypto.randomBytes(8).toString('hex').toUpperCase();
      const payment_status = willFail ? 'Failed' : 'Success';
      const amount = parseFloat(booking.total_amount);

      // Record the payment attempt
      await db.query(
        `INSERT INTO payments (booking_id, amount, payment_method, payment_status, transaction_ref, paid_at)
         VALUES (?, ?, ?, ?, ?, ${payment_status === 'Success' ? 'NOW()' : 'NULL'})`,
        [booking_id, amount, payment_method, payment_status, transaction_ref]
      );

      if (payment_status === 'Success') {
        await db.query("UPDATE bookings SET status = 'Confirmed' WHERE booking_id = ?", [booking_id]);
        await db.query("UPDATE rooms SET status = 'Booked' WHERE room_id = ?", [booking.room_id]);
        return res.json({
          success: true,
          message: 'Payment successful. Your booking is confirmed.',
          payment: { payment_status, transaction_ref, amount, paid_at: new Date() },
        });
      }

      // Failed payment: keep booking Pending so it can be retried
      res.status(402).json({
        success: false,
        message: 'Payment failed. Please try a different card.',
        payment: { payment_status, transaction_ref, amount },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/payments/booking/:bookingId - payment status for a booking
router.get('/booking/:bookingId', authenticate, async (req, res, next) => {
  const bookingId = parseInt(req.params.bookingId, 10);
  if (isNaN(bookingId)) {
    return res.status(400).json({ success: false, message: 'Invalid booking id.' });
  }
  try {
    const [rows] = await db.query(
      'SELECT * FROM payments WHERE booking_id = ? ORDER BY payment_id DESC',
      [bookingId]
    );
    res.json({ success: true, payments: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;