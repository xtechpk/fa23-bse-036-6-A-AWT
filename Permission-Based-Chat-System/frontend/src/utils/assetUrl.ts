import axiosInstance from '../api/axiosInstance';

export const toAbsoluteAssetUrl = (value?: string | null): string | null => {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^(https?:|blob:|data:)/i.test(raw)) {
    return encodeURI(raw);
  }

  const baseApiUrl = String(axiosInstance.defaults.baseURL || `${window.location.origin}/api`);
  const apiOrigin = baseApiUrl.replace(/\/api\/?$/, '');
  const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`;

  return encodeURI(`${apiOrigin}${normalizedPath}`);
};
