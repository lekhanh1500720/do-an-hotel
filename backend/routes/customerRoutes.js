const express = require('express');
const bcrypt = require('bcryptjs');
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

// GET /api/customers - admin: list/search customers
// Query params: search (name/email/phone), is_active
router.get('/', authenticate, authorizeAdmin, async (req, res, next) => {
  const { search, is_active } = req.query;
  const conditions = ["role = 'customer'"];
  const params = [];
  if (search && search.trim()) {
    conditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
    const like = `%${search.trim()}%`;
    params.push(like, like, like);
  }
  if (is_active !== undefined && is_active !== '') {
    conditions.push('is_active = ?');
    params.push(is_active === '1' || is_active === 'true' ? 1 : 0);
  }
  try {
    const [rows] = await db.query(
      `SELECT user_id, name, email, phone, is_active, created_at,
              (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.user_id) AS booking_count
       FROM users u WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
      params
    );
    res.json({ success: true, customers: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/customers/:id - admin: customer detail
router.get('/:id', authenticate, authorizeAdmin, async (req, res, next) => {
  const customerId = parseInt(req.params.id, 10);
  if (isNaN(customerId)) {
    return res.status(400).json({ success: false, message: 'Invalid customer id.' });
  }
  try {
    const [rows] = await db.query(
      'SELECT user_id, name, email, phone, is_active, created_at FROM users WHERE user_id = ? AND role = ?',
      [customerId, 'customer']
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
    const [bookings] = await db.query(
      `SELECT b.*, r.room_number, h.name AS hotel_name FROM bookings b
       JOIN rooms r ON r.room_id = b.room_id
       JOIN hotels h ON h.hotel_id = r.hotel_id
       WHERE b.user_id = ? ORDER BY b.created_at DESC`,
      [customerId]
    );
    res.json({ success: true, customer: rows[0], bookings });
  } catch (err) {
    next(err);
  }
});

// PUT /api/customers/:id - admin: edit customer details (optionally reset password)
router.put(
  '/:id',
  authenticate,
  authorizeAdmin,
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters.'),
    body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 20 }).withMessage('Phone is too long.'),
    body('password').optional({ checkFalsy: true }).isLength({ min: 6, max: 100 }).withMessage('Password must be at least 6 characters.'),
  ],
  async (req, res, next) => {
    const invalid = handleValidation(req, res);
    if (invalid) return;

    const customerId = parseInt(req.params.id, 10);
    if (isNaN(customerId)) {
      return res.status(400).json({ success: false, message: 'Invalid customer id.' });
    }

    const { name, phone, password } = req.body;
    try {
      const [existing] = await db.query(
        'SELECT user_id FROM users WHERE user_id = ? AND role = ?',
        [customerId, 'customer']
      );
      if (!existing[0]) {
        return res.status(404).json({ success: false, message: 'Customer not found.' });
      }

      if (password) {
        const hashed = await bcrypt.hash(password, 10);
        await db.query('UPDATE users SET name = ?, phone = ?, password = ? WHERE user_id = ?', [
          name, phone || null, hashed, customerId,
        ]);
      } else {
        await db.query('UPDATE users SET name = ?, phone = ? WHERE user_id = ?', [
          name, phone || null, customerId,
        ]);
      }
      res.json({ success: true, message: 'Customer updated.' });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/customers/:id/status - admin: activate/deactivate customer
router.patch('/:id/status', authenticate, authorizeAdmin, async (req, res, next) => {
  const customerId = parseInt(req.params.id, 10);
  if (isNaN(customerId)) {
    return res.status(400).json({ success: false, message: 'Invalid customer id.' });
  }
  const { is_active } = req.body;
  if (typeof is_active !== 'boolean' && !['0', '1'].includes(String(is_active))) {
    return res.status(400).json({ success: false, message: 'is_active must be true or false.' });
  }
  const active = is_active === true || is_active === 1 || is_active === '1' ? 1 : 0;
  try {
    const [result] = await db.query(
      'UPDATE users SET is_active = ? WHERE user_id = ? AND role = ?',
      [active, customerId, 'customer']
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
    res.json({ success: true, message: active ? 'Customer activated.' : 'Customer deactivated.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;