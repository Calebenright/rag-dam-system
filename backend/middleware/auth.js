import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseSecretKey);

const ALLOWED_DOMAIN = 'dodekadigital.com';
const DODEKA_API_KEY = process.env.DODEKA_API_KEY;

/**
 * Authentication middleware
 * Validates JWT token from Supabase Auth
 */
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }

    // Verify email domain
    const email = user.email || '';
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return res.status(403).json({
        success: false,
        error: 'Access restricted to Dodeka Digital team members',
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
    });
  }
};

/**
 * Optional auth middleware
 * Attaches user if token present, but doesn't require it
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Continue without user on error
    next();
  }
};

/**
 * API Key authentication middleware
 * For external services/tools to access the agent API
 * Accepts: X-API-Key header or api_key query param
 */
export const requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required. Provide X-API-Key header or api_key query param.'
    });
  }

  if (!DODEKA_API_KEY) {
    console.error('DODEKA_API_KEY not configured in environment');
    return res.status(500).json({
      success: false,
      error: 'API key authentication not configured'
    });
  }

  if (apiKey !== DODEKA_API_KEY) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key'
    });
  }

  // Mark as API key authenticated
  req.authType = 'api_key';
  next();
};

/**
 * Flexible auth middleware
 * Accepts either JWT (Supabase) OR API key
 */
export const requireAuthOrApiKey = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  // Try API key first (faster check)
  if (apiKey) {
    if (DODEKA_API_KEY && apiKey === DODEKA_API_KEY) {
      req.authType = 'api_key';
      return next();
    }
    return res.status(403).json({
      success: false,
      error: 'Invalid API key'
    });
  }

  // Try JWT auth
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token'
        });
      }

      const email = user.email || '';
      if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        return res.status(403).json({
          success: false,
          error: 'Access restricted to Dodeka Digital team members'
        });
      }

      req.user = user;
      req.authType = 'jwt';
      return next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Authentication error'
      });
    }
  }

  return res.status(401).json({
    success: false,
    error: 'Authentication required. Provide Bearer token or X-API-Key header.'
  });
};
