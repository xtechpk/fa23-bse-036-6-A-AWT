const normalizeIp = (rawIp = '') => {
  const value = String(rawIp || '').trim();
  if (!value) return null;

  if (value.includes(',')) {
    return normalizeIp(value.split(',')[0]);
  }

  if (value.startsWith('::ffff:')) {
    return value.replace('::ffff:', '');
  }

  if (value === '::1') {
    return '127.0.0.1';
  }

  return value;
};

const parseBrowser = (ua) => {
  if (!ua) return 'Unknown';

  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return 'Opera';
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return 'Chrome';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari';

  return 'Unknown';
};

const parseOs = (ua) => {
  if (!ua) return 'Unknown';

  if (/Windows NT/i.test(ua)) return 'Windows';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';

  return 'Unknown';
};

const parseDeviceType = (ua) => {
  if (!ua) return 'Unknown';

  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'mobile';

  return 'desktop';
};

const parseUserAgent = (userAgent = '') => {
  const ua = String(userAgent || '');

  return {
    userAgent: ua || null,
    browser: parseBrowser(ua),
    os: parseOs(ua),
    deviceType: parseDeviceType(ua),
  };
};

const sanitizeLocation = (location = {}) => {
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    return null;
  }

  const normalized = {
    country: typeof location.country === 'string' ? location.country.trim() : null,
    region: typeof location.region === 'string' ? location.region.trim() : null,
    city: typeof location.city === 'string' ? location.city.trim() : null,
    zipCode: typeof location.zipCode === 'string' ? location.zipCode.trim() : null,
    latitude: Number.isFinite(Number(location.latitude)) ? Number(location.latitude) : null,
    longitude: Number.isFinite(Number(location.longitude)) ? Number(location.longitude) : null,
    accuracyRadius: Number.isFinite(Number(location.accuracyRadius))
      ? Number(location.accuracyRadius)
      : null,
    altitude: Number.isFinite(Number(location.altitude)) ? Number(location.altitude) : null,
    locationTimestamp: location.locationTimestamp ? new Date(location.locationTimestamp) : null,
  };

  if (normalized.locationTimestamp && Number.isNaN(normalized.locationTimestamp.getTime())) {
    normalized.locationTimestamp = null;
  }

  const hasAny = Object.values(normalized).some((value) => value !== null && value !== '');
  return hasAny ? normalized : null;
};

const buildRequestMeta = (req, locationOverride = null) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = normalizeIp(forwardedFor || req.ip || req.socket?.remoteAddress || null);
  const agent = parseUserAgent(req.headers['user-agent']);
  const location = sanitizeLocation(locationOverride || req.body?.location || null);

  return {
    ip,
    ...agent,
    location,
  };
};

module.exports = {
  normalizeIp,
  parseUserAgent,
  sanitizeLocation,
  buildRequestMeta,
};
