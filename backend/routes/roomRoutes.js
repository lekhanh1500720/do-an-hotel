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

// Helper to get rooms for a hotel that are NOT overlapping the given dates.
// A room is unavailable if it has a booking (Confirmed or CheckedIn) whose
// [check_in_date, check_out_date) range overlaps [checkIn, checkOut).
function buildAvailabilitySQL(extraWhere) {
  return `
    SELECT r.*, h.name AS hotel_name, h.city
    FROM rooms r
    JOIN hotels h ON h.hotel_id = r.hotel_id
    WHERE r.hotel_id = ?
      AND r.status <> 'Maintenance'
      AND NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.room_id = r.room_id
          AND b.status IN ('Confirmed', 'CheckedIn')
          AND b.check_in_date < ?
          AND b.check_out_date > ?
      )
      ${extraWhere || ''}
    ORDER BY r.price_per_night ASC
  `;
}

// GET /api/rooms/hotel/:hotelId/available?check_in=&check_out=
// Public endpoint used to check live availability.
router.get(
  '/hotel/:hotelId/available',
  [
    query('check_in').isISO8601().withMessage('A valid check_in date is required (YYYY-MM-DD).'),
    query('check_out').isISO8601().withMessage('A valid check_out date is required (YYYY-MM-DD).'),
  ],
  async (req, res, next) => {
    const invalid = handleValidation(req, res);
    if (invalid) return;

    const hotelId = parseInt(req.params.hotelId, 10);
    if (isNaN(hotelId)) {
      return res.status(400).json({ success: false, message: 'Invalid hotel id.' });
    }

    const { check_in, check_out } = req.query;
    if (new Date(check_out) <= new Date(check_in)) {
      return res.status(400).json({ success: false, message: 'Check-out date must be after check-in date.' });
    }

    const checkIn = new Date(check_in + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (checkIn < today) {
      return res.status(400).json({ success: false, message: 'Check-in date cannot be in the past.' });
    }

    try {
      const [rows] = await db.query(buildAvailabilitySQL(''), [hotelId, check_out, check_in]);
      rows.forEach(function (r) { r.price_per_night = Number(r.price_per_night); });
      res.json({ success: true, rooms: rows });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/rooms - admin: list all rooms (with hotel info), optional filters
router.get('/', authenticate, authorizeAdmin, async (req, res, next) => {
  const { hotel_id, status } = req.query;
  const conditions = [];
  const params = [];
  if (hotel_id) {
    conditions.push('r.hotel_id = ?');
    params.push(parseInt(hotel_id, 10));
  }
  if (status) {
    conditions.push('r.status = ?');
    params.push(status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const [rows] = await db.query(
      `SELECT r.*, h.name AS hotel_name, h.city FROM rooms r
       JOIN hotels h ON h.hotel_id = r.hotel_id ${where} ORDER BY r.hotel_id, r.room_number`,
      params
    );
    rows.forEach(function (r) { r.price_per_night = Number(r.price_per_night); });
    res.json({ success: true, rooms: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/rooms/:id - single room
router.get('/:id', async (req, res, next) => {
  const roomId = parseInt(req.params.id, 10);
  if (isNaN(roomId)) {
    return res.status(400).json({ success: false, message: 'Invalid room id.' });
  }
  try {
    const [rows] = await db.query(
      `SELECT r.*, h.name AS hotel_name, h.city, h.address, h.star_rating, h.image_url AS hotel_image_url
       FROM rooms r JOIN hotels h ON h.hotel_id = r.hotel_id WHERE r.room_id = ?`,
      [roomId]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }
    rows[0].price_per_night = Number(rows[0].price_per_night);
    res.json({ success: true, room: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/rooms - admin create room
router.post(
  '/',
  authenticate,
  authorizeAdmin,
  [
    body('hotel_id').isInt().withMessage('hotel_id must be an integer.'),
    body('room_number').trim().isLength({ min: 1, max: 20 }).withMessage('Room number is required.'),
    body('room_type').isIn(['Single', 'Double', 'Deluxe', 'Suite']).withMessage('Invalid room type.'),
    body('price_per_night').isFloat({ min: 1 }).withMessage('Price must be greater than 0.'),
    body('capacity').isInt({ min: 1, max: 10 }).withMessage('Capacity must be 1-10.'),
    body('status').optional().isIn(['Available', 'Booked', 'Maintenance']).withMessage('Invalid room status.'),
    body('image_url').optional({ checkFalsy: true }).isURL().withMessage('image_url must be a valid URL.'),
  ],
  async (req, res, next) => {
    const invalid = handleValidation(req, res);
    if (invalid) return;

    const { hotel_id, room_number, room_type, price_per_night, capacity, status = 'Available', image_url } = req.body;
    try {
      const [hotel] = await db.query('SELECT hotel_id FROM hotels WHERE hotel_id = ?', [hotel_id]);
      if (!hotel[0]) {
        return res.status(404).json({ success: false, message: 'Hotel not found.' });
      }
      const [result] = await db.query(
        `INSERT INTO rooms (hotel_id, room_number, room_type, price_per_night, capacity, status, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [hotel_id, room_number, room_type, price_per_night, capacity, status, image_url || null]
      );
      res.status(201).json({ success: true, message: 'Room created.', room_id: result.insertId });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'A room with this number already exists in the hotel.' });
      }
      next(err);
    }
  }
);

// PUT /api/rooms/:id - admin update room (including status -> Maintenance)
router.put(
  '/:id',
  authenticate,
  authorizeAdmin,
  [
    body('room_number').trim().isLength({ min: 1, max: 20 }).withMessage('Room number is required.'),
    body('room_type').isIn(['Single', 'Double', 'Deluxe', 'Suite']).withMessage('Invalid room type.'),
    body('price_per_night').isFloat({ min: 1 }).withMessage('Price must be greater than 0.'),
    body('capacity').isInt({ min: 1, max: 10 }).withMessage('Capacity must be 1-10.'),
    body('status').isIn(['Available', 'Booked', 'Maintenance']).withMessage('Invalid room status.'),
    body('image_url').optional({ checkFalsy: true }).isURL().withMessage('image_url must be a valid URL.'),
  ],
  async (req, res, next) => {
    const invalid = handleValidation(req, res);
    if (invalid) return;

    const roomId = parseInt(req.params.id, 10);
    if (isNaN(roomId)) {
      return res.status(400).json({ success: false, message: 'Invalid room id.' });
    }
    const { room_number, room_type, price_per_night, capacity, status, image_url } = req.body;
    try {
      const [result] = await db.query(
        `UPDATE rooms SET room_number = ?, room_type = ?, price_per_night = ?, capacity = ?, status = ?, image_url = ?
         WHERE room_id = ?`,
        [room_number, room_type, price_per_night, capacity, status, image_url || null, roomId]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Room not found.' });
      }
      res.json({ success: true, message: 'Room updated.' });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/rooms/:id - admin delete room
router.delete('/:id', authenticate, authorizeAdmin, async (req, res, next) => {
  const roomId = parseInt(req.params.id, 10);
  if (isNaN(roomId)) {
    return res.status(400).json({ success: false, message: 'Invalid room id.' });
  }
  try {
    const [result] = await db.query('DELETE FROM rooms WHERE room_id = ?', [roomId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }
    res.json({ success: true, message: 'Room deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;