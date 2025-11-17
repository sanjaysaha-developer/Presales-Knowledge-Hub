import express from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../services/supabaseClient.js';
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

    // Create via Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: role || 'viewer' },
      },
    });
    if (error) {
      return res.status(400).json({ error: 'Registration failed', message: error.message });
    }

    const sUser = data.user;

    res.status(201).json({
      user: { id: sUser.id, email: sUser.email, name, role: role || 'viewer' },
      token: data.session?.access_token || null,
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

    // Authenticate via Supabase
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return res.status(401).json({ error: 'Invalid credentials', message: error?.message || 'Email or password is incorrect' });
    }

    const sUser = data.user;

    res.json({
      user: {
        id: sUser.id,
        email: sUser.email,
        name: sUser.user_metadata?.name || '',
        role: sUser.user_metadata?.role || sUser.app_metadata?.role || 'viewer',
      },
      token: data.session.access_token,
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
  res.json(req.user);
});

export default router;
