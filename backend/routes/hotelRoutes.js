const express = require('express');
const { body, query, validationResult } = require('express-validator');
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

// GET /api/hotels - list hotels with optional filters + average rating
// Query params: city, min_price, max_price, star_rating
router.get(
  '/',
  [
    query('min_price').optional().isFloat({ min: 0 }).withMessage('min_price must be a number.'),
    query('max_price').optional().isFloat({ min: 0 }).withMessage('max_price must be a number.'),
    query('star_rating').optional().isInt({ min: 1, max: 5 }).withMessage('star_rating must be 1-5.'),
  ],
  async (req, res, next) => {
    const invalid = handleValidation(req, res);
    if (invalid) return;

    const { city, min_price, max_price, star_rating } = req.query;
    const conditions = [];
    const params = [];

    if (city && city.trim()) {
      conditions.push('h.city LIKE ?');
      params.push(`%${city.trim()}%`);
    }
    if (min_price) {
      // Average room price used for price-range filtering
      conditions.push('(SELECT AVG(r.price_per_night) FROM rooms r WHERE r.hotel_id = h.hotel_id) >= ?');
      params.push(parseFloat(min_price));
    }
    if (max_price) {
      conditions.push('(SELECT AVG(r.price_per_night) FROM rooms r WHERE r.hotel_id = h.hotel_id) <= ?');
      params.push(parseFloat(max_price));
    }
    if (star_rating) {
      conditions.push('h.star_rating = ?');
      params.push(parseInt(star_rating, 10));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT h.hotel_id, h.name, h.city, h.address, h.description, h.star_rating,
             h.image_url, h.created_at,
             COALESCE(AVG(rv.rating), 0) AS avg_rating,
             COUNT(rv.review_id) AS review_count,
             (SELECT MIN(r.price_per_night) FROM rooms r WHERE r.hotel_id = h.hotel_id AND r.status = 'Available') AS min_price,
             (SELECT COUNT(*) FROM rooms r WHERE r.hotel_id = h.hotel_id) AS total_rooms,
             (SELECT COUNT(*) FROM rooms r WHERE r.hotel_id = h.hotel_id AND r.status = 'Available') AS available_rooms
      FROM hotels h
      LEFT JOIN reviews rv ON rv.hotel_id = h.hotel_id
      ${where}
      GROUP BY h.hotel_id
      ORDER BY h.star_rating DESC, h.name ASC
    `;

    try {
      const [rows] = await db.query(sql, params);
      const hotels = rows.map(function (h) {
        h.avg_rating = Number(h.avg_rating);
        h.min_price = h.min_price === null ? null : Number(h.min_price);
        return h;
      });
      res.json({ success: true, hotels });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/hotels/:id - single hotel with rooms and reviews
router.get('/:id', async (req, res, next) => {
  const hotelId = parseInt(req.params.id, 10);
  if (isNaN(hotelId)) {
    return res.status(400).json({ success: false, message: 'Invalid hotel id.' });
  }
  try {
    const [hotels] = await db.query(
      `SELECT h.*, COALESCE(AVG(rv.rating), 0) AS avg_rating, COUNT(rv.review_id) AS review_count
       FROM hotels h LEFT JOIN reviews rv ON rv.hotel_id = h.hotel_id
       WHERE h.hotel_id = ? GROUP BY h.hotel_id`,
      [hotelId]
    );
    if (!hotels[0]) {
      return res.status(404).json({ success: false, message: 'Hotel not found.' });
    }
    const [rooms] = await db.query('SELECT * FROM rooms WHERE hotel_id = ? ORDER BY room_number', [hotelId]);
    const [reviews] = await db.query(
      `SELECT rv.review_id, rv.rating, rv.comment, rv.created_at, u.name AS user_name
       FROM reviews rv JOIN users u ON u.user_id = rv.user_id
       WHERE rv.hotel_id = ? ORDER BY rv.created_at DESC`,
      [hotelId]
    );
    const hotel = hotels[0];
    hotel.avg_rating = Number(hotel.avg_rating);
    rooms.forEach(function (r) { r.price_per_night = Number(r.price_per_night); });
    res.json({ success: true, hotel, rooms, reviews });
  } catch (err) {
    next(err);
  }
});

// POST /api/hotels - admin create hotel
router.post(
  '/',
  authenticate,
  authorizeAdmin,
  [
    body('name').trim().isLength({ min: 2, max: 150 }).withMessage('Hotel name must be 2-150 characters.'),
    body('city').trim().isLength({ min: 2, max: 100 }).withMessage('City must be 2-100 characters.'),
    body('address').trim().isLength({ min: 5, max: 255 }).withMessage('Address must be 5-255 characters.'),
    body('description').optional().trim().isLength({ max: 2000 }).withMessage('Description is too long.'),
    body('star_rating').isInt({ min: 1, max: 5 }).withMessage('Star rating must be 1-5.'),
    body('image_url').optional({ checkFalsy: true }).isURL().withMessage('image_url must be a valid URL.'),
  ],
  async (req, res, next) => {
    const invalid = handleValidation(req, res);
    if (invalid) return;

    const { name, city, address, description, star_rating, image_url } = req.body;
    try {
      const [result] = await db.query(
        'INSERT INTO hotels (name, city, address, description, star_rating, image_url, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, city, address, description || null, star_rating, image_url || null, req.user.user_id]
      );
      res.status(201).json({ success: true, message: 'Hotel created.', hotel_id: result.insertId });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/hotels/:id - admin update hotel
router.put(
  '/:id',
  authenticate,
  authorizeAdmin,
  [
    body('name').trim().isLength({ min: 2, max: 150 }).withMessage('Hotel name must be 2-150 characters.'),
    body('city').trim().isLength({ min: 2, max: 100 }).withMessage('City must be 2-100 characters.'),
    body('address').trim().isLength({ min: 5, max: 255 }).withMessage('Address must be 5-255 characters.'),
    body('description').optional().trim().isLength({ max: 2000 }).withMessage('Description is too long.'),
    body('star_rating').isInt({ min: 1, max: 5 }).withMessage('Star rating must be 1-5.'),
    body('image_url').optional({ checkFalsy: true }).isURL().withMessage('image_url must be a valid URL.'),
  ],
  async (req, res, next) => {
    const invalid = handleValidation(req, res);
    if (invalid) return;

    const hotelId = parseInt(req.params.id, 10);
    if (isNaN(hotelId)) {
      return res.status(400).json({ success: false, message: 'Invalid hotel id.' });
    }

    const { name, city, address, description, star_rating, image_url } = req.body;
    try {
      const [result] = await db.query(
        `UPDATE hotels SET name = ?, city = ?, address = ?, description = ?, star_rating = ?, image_url = ?
         WHERE hotel_id = ?`,
        [name, city, address, description || null, star_rating, image_url || null, hotelId]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Hotel not found.' });
      }
      res.json({ success: true, message: 'Hotel updated.' });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/hotels/:id - admin delete hotel (cascades rooms)
router.delete('/:id', authenticate, authorizeAdmin, async (req, res, next) => {
  const hotelId = parseInt(req.params.id, 10);
  if (isNaN(hotelId)) {
    return res.status(400).json({ success: false, message: 'Invalid hotel id.' });
  }
  try {
    const [result] = await db.query('DELETE FROM hotels WHERE hotel_id = ?', [hotelId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Hotel not found.' });
    }
    res.json({ success: true, message: 'Hotel deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;