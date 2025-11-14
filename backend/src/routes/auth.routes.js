import express from 'express';
import bcrypt from 'bcryptjs';
import { User, AuditLog } from '../models/index.js';
import { generateToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email, password, and name are required',
      });
    }

    // Check if user exists
    const existingUser = User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email already exists',
      });
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = User.create({
      id: uuidv4(),
      email,
      password_hash,
      name,
      role: role || 'viewer',
    });

    // Log the action
    AuditLog.log('user', user.id, 'register', { email, name }, user.id);

    // Generate token
    const token = generateToken(user);

    // Return user without password
    const { password_hash: _, ...userWithoutPassword } = user;

    res.status(201).json({
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required',
      });
    }

    // Find user
    const user = User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Generate token
    const token = generateToken(user);

    // Log the action
    AuditLog.log('user', user.id, 'login', { email }, user.id, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Return user without password
    const { password_hash: _, ...userWithoutPassword } = user;

    res.json({
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user
 */
import { authenticate } from '../middleware/auth.js';

router.get('/me', authenticate, (req, res) => {
  const { password_hash: _, ...userWithoutPassword } = req.user;
  res.json(userWithoutPassword);
});

export default router;
