const express = require('express');
const { query, validationResult } = require('express-validator');
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

// GET /api/reports/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD
// Total revenue from successful payments in the given range.
router.get(
  '/revenue',
  authenticate,
  authorizeAdmin,
  [
    query('from').isISO8601().withMessage('A valid from date is required (YYYY-MM-DD).'),
    query('to').isISO8601().withMessage('A valid to date is required (YYYY-MM-DD).'),
  ],
  async (req, res, next) => {
    const invalid = handleValidation(req, res);
    if (invalid) return;

    const { from, to } = req.query;
    if (new Date(to) < new Date(from)) {
      return res.status(400).json({ success: false, message: 'to date cannot be before from date.' });
    }
    try {
      const [rows] = await db.query(
        `SELECT COALESCE(SUM(amount), 0) AS total_revenue,
                COUNT(*) AS total_transactions
         FROM payments
         WHERE payment_status = 'Success'
           AND DATE(paid_at) BETWEEN ? AND ?`,
        [from, to]
      );
      res.json({
        success: true,
        from,
        to,
        total_revenue: Number(rows[0].total_revenue),
        total_transactions: Number(rows[0].total_transactions),
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/reports/occupancy
// Occupancy rate per hotel = occupied room-nights / available room-nights
// computed over confirmed/checked-in stays within the last 30 days.
router.get('/occupancy', authenticate, authorizeAdmin, async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT h.hotel_id, h.name AS hotel_name,
             COUNT(DISTINCT r.room_id) AS total_rooms,
             COALESCE(SUM(
               CASE WHEN b.status IN ('Confirmed','CheckedIn')
                    THEN GREATEST(DATEDIFF(
                      LEAST(b.check_out_date, CURDATE()),
                      GREATEST(b.check_in_date, DATE_SUB(CURDATE(), INTERVAL 30 DAY))
                    ), 0)
                    ELSE 0 END
             ), 0) AS occupied_room_nights,
             (COUNT(DISTINCT r.room_id) * 30) AS available_room_nights
      FROM hotels h
      LEFT JOIN rooms r ON r.hotel_id = h.hotel_id
      LEFT JOIN bookings b ON b.room_id = r.room_id
      GROUP BY h.hotel_id, h.name
      ORDER BY occupied_room_nights DESC
    `);
    const enriched = rows.map((r) => ({
      ...r,
      occupancy_rate: r.available_room_nights > 0
        ? Math.round((r.occupied_room_nights / r.available_room_nights) * 10000) / 100
        : 0,
    }));
    res.json({ success: true, occupancy: enriched });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/bookings-by-status
router.get('/bookings-by-status', authenticate, authorizeAdmin, async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT status, COUNT(*) AS count FROM bookings GROUP BY status
    `);
    res.json({ success: true, statuses: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/top-rated-hotels
router.get('/top-rated-hotels', authenticate, authorizeAdmin, async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT h.hotel_id, h.name AS hotel_name, h.city,
             COALESCE(AVG(rv.rating), 0) AS avg_rating,
             COUNT(rv.review_id) AS review_count
      FROM hotels h
      LEFT JOIN reviews rv ON rv.hotel_id = h.hotel_id
      GROUP BY h.hotel_id, h.name, h.city
      HAVING review_count > 0
      ORDER BY avg_rating DESC, review_count DESC
      LIMIT 10
    `);
    res.json({ success: true, hotels: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/dashboard - aggregated summary for the admin dashboard
router.get('/dashboard', authenticate, authorizeAdmin, async (req, res, next) => {
  try {
    const [revenue] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_revenue FROM payments WHERE payment_status = 'Success'`
    );
    const [bookings] = await db.query(`SELECT COUNT(*) AS total FROM bookings`);
    const [customers] = await db.query(`SELECT COUNT(*) AS total FROM users WHERE role = 'customer'`);
    const [hotels] = await db.query(`SELECT COUNT(*) AS total FROM hotels`);
    const [rooms] = await db.query(`SELECT COUNT(*) AS total FROM rooms`);
    const [occupancy] = await db.query(`
      SELECT COALESCE(SUM(
        CASE WHEN b.status IN ('Confirmed','CheckedIn')
             THEN GREATEST(DATEDIFF(LEAST(b.check_out_date, CURDATE()),
                                    GREATEST(b.check_in_date, DATE_SUB(CURDATE(), INTERVAL 30 DAY))), 0)
             ELSE 0 END
      ), 0) AS occupied, (SELECT COUNT(*) FROM rooms) * 30 AS available
      FROM bookings b
    `);
    res.json({
      success: true,
      summary: {
        total_revenue: Number(revenue[0].total_revenue),
        total_bookings: bookings[0].total,
        total_customers: customers[0].total,
        total_hotels: hotels[0].total,
        total_rooms: rooms[0].total,
        occupancy_rate: occupancy[0].available > 0
          ? Math.round((occupancy[0].occupied / occupancy[0].available) * 10000) / 100
          : 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;