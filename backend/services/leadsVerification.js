/**
 * Leads Verification Service
 * Verifies emails and phone numbers using external verification backends
 */

import axios from 'axios';

// Backend URLs
const EMAIL_VERIFICATION_URL = 'http://localhost:8080/v1/check_email';
const PHONE_VERIFICATION_URL = 'http://localhost:8081/validate';
const NUMVERIFY_URL = 'http://apilayer.net/api/validate';
const NUMVERIFY_KEY = 'fef84f12f25b3bc15237e59ef8eb4361';

/**
 * Check if email verification backend is available
 */
export async function checkEmailBackend() {
  try {
    // Try both v0 and v1 endpoints, and also check if port responds
    const response = await axios.post(
      'http://localhost:8080/v1/check_email',
      { to_email: 'test@test.com' },
      { timeout: 5000 }
    );
    // If we get a response (even error), the backend is running
    return { available: true };
  } catch (error) {
    // Check if error is connection refused vs other error
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return { available: false, error: 'Email verification backend not running. Start with: docker run -p 8080:8080 reacherhq/backend:latest' };
    }
    // Backend responded but with an error - still available
    return { available: true };
  }
}

/**
 * Check if phone verification backend is available
 */
export async function checkPhoneBackend() {
  try {
    // POST to validate endpoint with a test number
    const response = await axios.post(
      'http://localhost:8081/validate',
      { phone: '+14155551234' },
      { timeout: 5000 }
    );
    return { available: true };
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return { available: false, error: 'Phone verification backend not running. Start with: node phone-server.js' };
    }
    // Backend responded but with an error - still available
    return { available: true };
  }
}

/**
 * Verify a single email address
 * @param {string} email - Email address to verify
 * @returns {object} Verification result with status and details
 */
export async function verifyEmail(email) {
  if (!email || !email.trim()) {
    return { status: '', statusCode: 'empty', details: null };
  }

  email = email.trim();

  try {
    const response = await axios.post(
      EMAIL_VERIFICATION_URL,
      { to_email: email },
      { timeout: 30000 }
    );
    const result = response.data;

    const isReachable = result.is_reachable || 'unknown';
    const isDeliverable = result.smtp?.is_deliverable || false;
    const isCatchAll = result.smtp?.is_catch_all || false;
    const isDisposable = result.misc?.is_disposable || false;

    let status, statusCode;
    if (isReachable === 'safe' && isDeliverable) {
      status = '✅ Safe';
      statusCode = 'safe';
    } else if (isReachable === 'risky' && isCatchAll) {
      status = '⚠️ Catch-all';
      statusCode = 'catch_all';
    } else if (isReachable === 'risky') {
      status = '⚠️ Risky';
      statusCode = 'risky';
    } else if (isReachable === 'invalid') {
      status = '❌ Invalid';
      statusCode = 'invalid';
    } else if (isReachable === 'unknown') {
      status = '❓ Unknown';
      statusCode = 'unknown';
    } else if (isDisposable) {
      status = '🗑️ Disposable';
      statusCode = 'disposable';
    } else {
      status = `❓ ${isReachable}`;
      statusCode = isReachable;
    }

    return {
      status,
      statusCode,
      details: {
        isReachable,
        isDeliverable,
        isCatchAll,
        isDisposable,
        raw: result,
      },
    };
  } catch (error) {
    return {
      status: '❌ Error',
      statusCode: 'error',
      details: { error: error.message },
    };
  }
}

/**
 * Verify a single phone number using local validator
 * @param {string} phone - Phone number to verify
 * @returns {object} Verification result with status and details
 */
export async function verifyPhone(phone) {
  if (!phone || !phone.trim()) {
    return { status: '', statusCode: 'empty', details: null };
  }

  phone = phone.trim();

  try {
    const response = await axios.post(
      PHONE_VERIFICATION_URL,
      { phone },
      { timeout: 30000 }
    );
    const result = response.data;
    const isValid = result.is_valid || false;
    const phoneType = result.type || '';

    let status, statusCode;
    if (isValid) {
      status = `✅ Valid (${phoneType})`;
      statusCode = 'valid';
    } else {
      status = '❌ Invalid format';
      statusCode = 'invalid';
    }

    return {
      status,
      statusCode,
      details: {
        isValid,
        isPossible: result.is_possible,
        phoneType,
        formatted: result.formatted,
        country: result.country,
        raw: result,
      },
    };
  } catch (error) {
    return {
      status: '❌ Error',
      statusCode: 'error',
      details: { error: error.message },
    };
  }
}

/**
 * Verify phone using NumVerify API for carrier/line type info
 * @param {string} phone - Phone number to verify
 * @returns {object} Verification result with status and details
 */
export async function verifyPhoneNumVerify(phone) {
  if (!phone || !phone.trim()) {
    return { status: '', statusCode: 'empty', details: null };
  }

  phone = phone.trim();
  // Remove formatting characters
  const phoneClean = phone.replace(/[\s\-\(\)\+]/g, '');

  try {
    const response = await axios.get(NUMVERIFY_URL, {
      params: {
        access_key: NUMVERIFY_KEY,
        number: phoneClean,
        format: 1,
      },
      timeout: 30000,
    });
    const result = response.data;

    if (result.error) {
      return {
        status: `❌ ${result.error.info || 'API error'}`,
        statusCode: 'error',
        details: { error: result.error },
      };
    }

    const isValid = result.valid || false;
    const lineType = result.line_type || '';
    const carrier = result.carrier || '';

    let status, statusCode;
    if (!isValid) {
      status = '❌ Not in service';
      statusCode = 'not_in_service';
    } else if (lineType === 'mobile') {
      status = carrier ? `✅ Mobile (${carrier})` : '✅ Mobile';
      statusCode = 'mobile';
    } else if (lineType === 'landline') {
      status = carrier ? `📞 Landline (${carrier})` : '📞 Landline';
      statusCode = 'landline';
    } else if (lineType === 'voip') {
      status = carrier ? `⚠️ VOIP (${carrier})` : '⚠️ VOIP';
      statusCode = 'voip';
    } else if (lineType === 'toll_free') {
      status = '📞 Toll-free';
      statusCode = 'toll_free';
    } else if (lineType === 'special_services') {
      status = '📞 Special';
      statusCode = 'special';
    } else {
      status = lineType ? `✅ Valid (${lineType})` : '✅ Valid';
      statusCode = 'valid';
    }

    return {
      status,
      statusCode,
      details: {
        isValid,
        lineType,
        carrier,
        country: result.country_name,
        countryCode: result.country_code,
        location: result.location,
        raw: result,
      },
    };
  } catch (error) {
    return {
      status: '❌ Error',
      statusCode: 'error',
      details: { error: error.message },
    };
  }
}

/**
 * Convert column letter to 0-based index (A=0, B=1, ..., Z=25, AA=26, etc.)
 */
export function colLetterToIndex(letter) {
  let result = 0;
  for (const char of letter.toUpperCase()) {
    result = result * 26 + (char.charCodeAt(0) - 'A'.charCodeAt(0) + 1);
  }
  return result - 1;
}

/**
 * Convert 0-based index to column letter
 */
export function indexToColLetter(index) {
  let result = '';
  index += 1;
  while (index > 0) {
    const remainder = (index - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    index = Math.floor((index - 1) / 26);
  }
  return result;
}

export default {
  checkEmailBackend,
  checkPhoneBackend,
  verifyEmail,
  verifyPhone,
  verifyPhoneNumVerify,
  colLetterToIndex,
  indexToColLetter,
};
