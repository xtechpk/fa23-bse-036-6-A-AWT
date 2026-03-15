const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const logger = require('../utils/logger');

const TWO_FACTOR_WEBHOOK_URL = process.env.TWO_FACTOR_WEBHOOK_URL || '';
const ALLOW_DEBUG_IN_PROD = process.env.TWO_FACTOR_ALLOW_DEBUG_RESPONSE === 'true';

const postToWebhook = async (payload) => {
  const response = await fetch(TWO_FACTOR_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`2FA webhook responded with status ${response.status}`);
  }
};

const deliverTwoFactorCode = async ({ user, code, challenge, purpose, meta = {} }) => {
  if (TWO_FACTOR_WEBHOOK_URL) {
    try {
      await postToWebhook({
        type: 'two_factor_code',
        purpose,
        challengeId: challenge.id,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          registrationNumber: user.registrationNumber,
        },
        code,
        expiresAt: challenge.expiresAt,
        requestMeta: {
          ip: meta.ip || null,
          browser: meta.browser || null,
          os: meta.os || null,
          deviceType: meta.deviceType || null,
          location: meta.location || null,
        },
      });

      return {
        channel: 'webhook',
        delivered: true,
      };
    } catch (error) {
      logger.error('Failed to deliver 2FA code via webhook', {
        challengeId: challenge.id,
        purpose,
        message: error.message,
      });

      throw new ApiError(502, 'Failed to deliver two-factor code');
    }
  }

  if (env.nodeEnv !== 'production' || ALLOW_DEBUG_IN_PROD) {
    if (env.nodeEnv !== 'production') {
      logger.info('2FA code generated in debug mode', {
        challengeId: challenge.id,
        purpose,
        userId: user.id,
        code,
      });
    }

    return {
      channel: 'debug_response',
      delivered: false,
      debugCode: code,
    };
  }

  throw new ApiError(503, 'Two-factor delivery is not configured. Set TWO_FACTOR_WEBHOOK_URL.');
};

module.exports = {
  deliverTwoFactorCode,
};
