const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/db');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  return null;
}

// Helper: check whether a room has an overlapping active booking (Confirmed/CheckedIn)
// Two date ranges overlap if: a.check_in < newCheckOut AND a.check_out > newCheckIn
async function hasOverlap(roomId, checkIn, checkOut, excludeBookingId) {
  const params = [roomId, checkOut, checkIn];
  let sql = `
    SELECT booking_id FROM bookings
    WHERE room_id = ?
      AND status IN ('Confirmed', 'CheckedIn')
      AND check_in_date < ?
      AND check_out_date > ?
  `;
  if (excludeBookingId) {
    sql += ' AND booking_id <> ?';
    params.push(excludeBookingId);
  }
  const [rows] = await db.query(sql + ' LIMIT 1', params);
  return rows.length > 0;
}

// GET /api/bookings/my - bookings of the logged-in customer
router.get('/my', authenticate, async (req, res, next) => {
  try {
const [rows] = await db.query(
        `SELECT b.*, r.room_number, r.room_type, h.hotel_id, h.name AS hotel_name, h.city,
              p.payment_status, p.transaction_ref
       FROM bookings b
       JOIN rooms r ON r.room_id = b.room_id
       JOIN hotels h ON h.hotel_id = r.hotel_id
       LEFT JOIN payments p ON p.booking_id = b.booking_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC`,
        [req.user.user_id]
      );
      rows.forEach(function (b) { b.total_amount = Number(b.total_amount); });
      res.json({ success: true, bookings: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings - admin: all bookings (optional status filter)
router.get('/', authenticate, authorizeAdmin, async (req, res, next) => {
  const { status } = req.query;
  let sql = `
    SELECT b.*, r.room_number, r.room_type, h.hotel_id, h.name AS hotel_name, h.city,
           u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
           p.payment_status, p.transaction_ref
    FROM bookings b
    JOIN rooms r ON r.room_id = b.room_id
    JOIN hotels h ON h.hotel_id = r.hotel_id
    JOIN users u ON u.user_id = b.user_id
    LEFT JOIN payments p ON p.booking_id = b.booking_id
  `;
  const params = [];
  if (status) {
    sql += ' WHERE b.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY b.created_at DESC';
  try {
    const [rows] = await db.query(sql, params);
    rows.forEach(function (b) { b.total_amount = Number(b.total_amount); });
    res.json({ success: true, bookings: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/:id - booking detail
// Customers can only fetch their own; admins can fetch any.
router.get('/:id', authenticate, async (req, res, next) => {
  const bookingId = parseInt(req.params.id, 10);
  if (isNaN(bookingId)) {
    return res.status(400).json({ success: false, message: 'Invalid booking id.' });
  }
  try {
    const [rows] = await db.query(
      `SELECT b.*, r.room_number, r.room_type, h.hotel_id, h.name AS hotel_name, h.city,
              u.name AS customer_name, u.email AS customer_email, p.payment_status, p.transaction_ref
       FROM bookings b
       JOIN rooms r ON r.room_id = b.room_id
       JOIN hotels h ON h.hotel_id = r.hotel_id
       JOIN users u ON u.user_id = b.user_id
       LEFT JOIN payments p ON p.booking_id = b.booking_id
       WHERE b.booking_id = ?`,
      [bookingId]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    const booking = rows[0];
    if (req.user.role !== 'admin' && booking.user_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    booking.total_amount = Number(booking.total_amount);
    res.json({ success: true, booking });
  } catch (err) {
    next(err);
  }
});

// POST /api/bookings - create a booking (status Pending)
router.post(
  '/',
  authenticate,
  [
    body('room_id').isInt().withMessage('room_id must be an integer.'),
    body('check_in_date').isISO8601().withMessage('A valid check_in_date is required (YYYY-MM-DD).'),
    body('check_out_date').isISO8601().withMessage('A valid check_out_date is required (YYYY-MM-DD).'),
  ],
  async (req, res, next) => {
    const invalid = handleValidation(req, res);
    if (invalid) return;

    const { room_id, check_in_date, check_out_date } = req.body;

    // Client must not send a future check-in in the past
    const checkIn = new Date(check_in_date + 'T00:00:00');
    const checkOut = new Date(check_out_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkIn >= checkOut) {
      return res.status(400).json({ success: false, message: 'Check-out date must be after check-in date.' });
    }
    if (checkIn < today) {
      return res.status(400).json({ success: false, message: 'Check-in date cannot be in the past.' });
    }

    try {
      // Load room and verify availability + maintenance state
      const [roomRows] = await db.query('SELECT * FROM rooms WHERE room_id = ?', [room_id]);
      const room = roomRows[0];
      if (!room) {
        return res.status(404).json({ success: false, message: 'Room not found.' });
      }
      if (room.status === 'Maintenance') {
        return res.status(400).json({ success: false, message: 'This room is under maintenance and cannot be booked.' });
      }

      const overlap = await hasOverlap(room_id, check_in_date, check_out_date);
      if (overlap) {
        return res.status(409).json({ success: false, message: 'This room is unavailable for the selected dates.' });
      }

      // total_amount = nights * price_per_night
      const nights = Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      const totalAmount = Math.round(nights * parseFloat(room.price_per_night) * 100) / 100;

      const [result] = await db.query(
        `INSERT INTO bookings (user_id, room_id, check_in_date, check_out_date, status, total_amount)
         VALUES (?, ?, ?, ?, 'Pending', ?)`,
        [req.user.user_id, room_id, check_in_date, check_out_date, totalAmount]
      );

      // Optionally flag the room as Booked
      await db.query("UPDATE rooms SET status = 'Booked' WHERE room_id = ? AND status = 'Available'", [room_id]);

      res.status(201).json({
        success: true,
        message: 'Booking created. Please complete payment to confirm.',
        booking_id: result.insertId,
        total_amount: totalAmount,
        nights,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/bookings/:id/cancel - cancel a Pending or Confirmed booking
router.patch('/:id/cancel', authenticate, async (req, res, next) => {
  const bookingId = parseInt(req.params.id, 10);
  if (isNaN(bookingId)) {
    return res.status(400).json({ success: false, message: 'Invalid booking id.' });
  }
  try {
    const [rows] = await db.query('SELECT * FROM bookings WHERE booking_id = ?', [bookingId]);
    const booking = rows[0];
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    if (req.user.role !== 'admin' && booking.user_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (booking.status === 'CheckedIn' || booking.status === 'CheckedOut') {
      return res.status(400).json({
        success: false,
        message: booking.status === 'CheckedIn'
          ? 'A checked-in booking cannot be cancelled.'
          : 'A completed (checked-out) booking cannot be cancelled.',
      });
    }
    if (booking.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'This booking is already cancelled.' });
    }

    await db.query("UPDATE bookings SET status = 'Cancelled' WHERE booking_id = ?", [bookingId]);

    // If the room has no other active booking, free it up
    const [other] = await db.query(
      `SELECT booking_id FROM bookings WHERE room_id = ? AND status IN ('Confirmed','CheckedIn') LIMIT 1`,
      [booking.room_id]
    );
    if (other.length === 0) {
      await db.query("UPDATE rooms SET status = 'Available' WHERE room_id = ?", [booking.room_id]);
    }

    res.json({ success: true, message: 'Booking cancelled. The room is released for those dates.' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/bookings/:id/checkin - admin: Confirmed -> CheckedIn
router.patch('/:id/checkin', authenticate, authorizeAdmin, async (req, res, next) => {
  const bookingId = parseInt(req.params.id, 10);
  if (isNaN(bookingId)) {
    return res.status(400).json({ success: false, message: 'Invalid booking id.' });
  }
  try {
    const [rows] = await db.query('SELECT * FROM bookings WHERE booking_id = ?', [bookingId]);
    const booking = rows[0];
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    if (booking.status !== 'Confirmed') {
      return res.status(400).json({ success: false, message: 'Only confirmed bookings can be checked in.' });
    }
    await db.query("UPDATE bookings SET status = 'CheckedIn' WHERE booking_id = ?", [bookingId]);
    await db.query("UPDATE rooms SET status = 'Booked' WHERE room_id = ?", [booking.room_id]);
    res.json({ success: true, message: 'Guest checked in.' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/bookings/:id/checkout - admin: CheckedIn -> CheckedOut
router.patch('/:id/checkout', authenticate, authorizeAdmin, async (req, res, next) => {
  const bookingId = parseInt(req.params.id, 10);
  if (isNaN(bookingId)) {
    return res.status(400).json({ success: false, message: 'Invalid booking id.' });
  }
  try {
    const [rows] = await db.query('SELECT * FROM bookings WHERE booking_id = ?', [bookingId]);
    const booking = rows[0];
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    if (booking.status !== 'CheckedIn') {
      return res.status(400).json({ success: false, message: 'Only checked-in bookings can be checked out.' });
    }
    await db.query("UPDATE bookings SET status = 'CheckedOut' WHERE booking_id = ?", [bookingId]);

    // Free the room if no other active booking exists
    const [other] = await db.query(
      `SELECT booking_id FROM bookings WHERE room_id = ? AND status IN ('Confirmed','CheckedIn') LIMIT 1`,
      [booking.room_id]
    );
    if (other.length === 0) {
      await db.query("UPDATE rooms SET status = 'Available' WHERE room_id = ?", [booking.room_id]);
    }
    res.json({ success: true, message: 'Guest checked out.' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/bookings/:id/confirm - admin: Pending -> Confirmed
router.patch('/:id/confirm', authenticate, authorizeAdmin, async (req, res, next) => {
  const bookingId = parseInt(req.params.id, 10);
  if (isNaN(bookingId)) {
    return res.status(400).json({ success: false, message: 'Invalid booking id.' });
  }
  try {
    const [rows] = await db.query('SELECT * FROM bookings WHERE booking_id = ?', [bookingId]);
    const booking = rows[0];
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    if (booking.status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Only pending bookings can be confirmed.' });
    }
    await db.query("UPDATE bookings SET status = 'Confirmed' WHERE booking_id = ?", [bookingId]);
    await db.query("UPDATE rooms SET status = 'Booked' WHERE room_id = ?", [booking.room_id]);
    res.json({ success: true, message: 'Booking confirmed.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;