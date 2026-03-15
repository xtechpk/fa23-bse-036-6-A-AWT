const format = (level, message, extra) => {
  const timestamp = new Date().toISOString();
  const payload = extra ? ` ${JSON.stringify(extra)}` : '';
  return `[${timestamp}] [${level}] ${message}${payload}`;
};

const logger = {
  info: (message, extra) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(format('INFO', message, extra));
    }
  },
  warn: (message, extra) => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(format('WARN', message, extra));
    }
  },
  error: (message, extra) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error(format('ERROR', message, extra));
    }
  },
};

module.exports = logger;
