const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/db');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Helper: handle validation errors consistently
function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  return null;
}

// POST /api/auth/register - create a new customer account
router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters.'),
    body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
    body('password').isLength({ min: 6, max: 100 }).withMessage('Password must be at least 6 characters.'),
    body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 20 }).withMessage('Phone is too long.'),
    body('role').optional().isIn(['customer', 'admin']).withMessage('Invalid role.'),
  ],
  async (req, res, next) => {
    const invalid = handleValidation(req, res);
    if (invalid) return;

    const { name, email, password, phone, role = 'customer' } = req.body;

    try {
      // Self-registration as admin is not allowed for security
      const finalRole = role === 'admin' ? 'customer' : role;

      const [existing] = await db.query('SELECT user_id FROM users WHERE email = ?', [email]);
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const [result] = await db.query(
        'INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)',
        [name, email, hashedPassword, phone || null, finalRole]
      );

      const token = jwt.sign(
        { user_id: result.insertId, name, email, role: finalRole },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.status(201).json({
        success: true,
        message: 'Account created successfully.',
        token,
        user: { user_id: result.insertId, name, email, phone: phone || '', role: finalRole },
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      }
      next(err);
    }
  }
);

// POST /api/auth/login - authenticate a user and issue JWT
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  async (req, res, next) => {
    const invalid = handleValidation(req, res);
    if (invalid) return;

    const { email, password } = req.body;

    try {
      const [rows] = await db.query(
        'SELECT user_id, name, email, password, phone, role, is_active FROM users WHERE email = ?',
        [email]
      );
      const user = rows[0];
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }
      if (user.is_active !== 1) {
        return res.status(403).json({ success: false, message: 'This account has been deactivated. Contact the administrator.' });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      const token = jwt.sign(
        { user_id: user.user_id, name: user.name, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.json({
        success: true,
        message: 'Login successful.',
        token,
        user: { user_id: user.user_id, name: user.name, email: user.email, phone: user.phone, role: user.role },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/me - return the currently authenticated user
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT user_id, name, email, phone, role, is_active, created_at FROM users WHERE user_id = ?',
      [req.user.user_id]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;