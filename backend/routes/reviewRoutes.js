const express = require('express');
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

// GET /api/reviews/hotel/:hotelId - public: list reviews for a hotel
router.get('/hotel/:hotelId', async (req, res, next) => {
  const hotelId = parseInt(req.params.hotelId, 10);
  if (isNaN(hotelId)) {
    return res.status(400).json({ success: false, message: 'Invalid hotel id.' });
  }
  try {
    const [rows] = await db.query(
      `SELECT rv.review_id, rv.rating, rv.comment, rv.created_at, u.name AS user_name
       FROM reviews rv JOIN users u ON u.user_id = rv.user_id
       WHERE rv.hotel_id = ? ORDER BY rv.created_at DESC`,
      [hotelId]
    );
    const [agg] = await db.query(
      'SELECT COALESCE(AVG(rating), 0) AS avg_rating, COUNT(*) AS review_count FROM reviews WHERE hotel_id = ?',
      [hotelId]
    );
    res.json({ success: true, reviews: rows, summary: agg[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/reviews/my - reviews left by the current user
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT rv.review_id, rv.rating, rv.comment, rv.created_at, h.hotel_id, h.name AS hotel_name
       FROM reviews rv JOIN hotels h ON h.hotel_id = rv.hotel_id
       WHERE rv.user_id = ? ORDER BY rv.created_at DESC`,
      [req.user.user_id]
    );
    res.json({ success: true, reviews: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/reviews/eligibility/:hotelId - does this user have a CheckedOut booking at this hotel?
router.get('/eligibility/:hotelId', authenticate, async (req, res, next) => {
  const hotelId = parseInt(req.params.hotelId, 10);
  if (isNaN(hotelId)) {
    return res.status(400).json({ success: false, message: 'Invalid hotel id.' });
  }
  try {
    const [rows] = await db.query(
      `SELECT b.booking_id, b.check_in_date, b.check_out_date
       FROM bookings b
       JOIN rooms r ON r.room_id = b.room_id
       WHERE b.user_id = ? AND r.hotel_id = ? AND b.status = 'CheckedOut'
       LIMIT 1`,
      [req.user.user_id, hotelId]
    );
    const [already] = await db.query(
      'SELECT review_id FROM reviews WHERE user_id = ? AND hotel_id = ?',
      [req.user.user_id, hotelId]
    );
    res.json({ success: true, eligible: rows.length > 0, alreadyReviewed: already.length > 0 });
  } catch (err) {
    next(err);
  }
});

// POST /api/reviews - submit a review (only after a CheckedOut booking)
router.post(
  '/',
  authenticate,
  [
    body('hotel_id').isInt().withMessage('hotel_id must be an integer.'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5.'),
    body('comment').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }).withMessage('Comment is too long.'),
  ],
  async (req, res, next) => {
    const invalid = handleValidation(req, res);
    if (invalid) return;

    const { hotel_id, rating, comment } = req.body;
    try {
      const [hotel] = await db.query('SELECT hotel_id FROM hotels WHERE hotel_id = ?', [hotel_id]);
      if (!hotel[0]) {
        return res.status(404).json({ success: false, message: 'Hotel not found.' });
      }

      const [existing] = await db.query(
        'SELECT review_id FROM reviews WHERE user_id = ? AND hotel_id = ?',
        [req.user.user_id, hotel_id]
      );
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: 'You have already reviewed this hotel.' });
      }

      // Only customers who completed a stay can review
      const [completed] = await db.query(
        `SELECT b.booking_id FROM bookings b
         JOIN rooms r ON r.room_id = b.room_id
         WHERE b.user_id = ? AND r.hotel_id = ? AND b.status = 'CheckedOut'
         LIMIT 1`,
        [req.user.user_id, hotel_id]
      );
      if (completed.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'You can only review a hotel after completing a checked-out stay.',
        });
      }

      const [result] = await db.query(
        'INSERT INTO reviews (user_id, hotel_id, rating, comment) VALUES (?, ?, ?, ?)',
        [req.user.user_id, hotel_id, rating, comment || null]
      );
      res.status(201).json({ success: true, message: 'Review submitted. Thank you!', review_id: result.insertId });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'You have already reviewed this hotel.' });
      }
      next(err);
    }
  }
);

module.exports = router;