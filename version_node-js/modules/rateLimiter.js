const requestCounts = {};
const LIMITS = { global: 100, login: 5 };
const WINDOW = 60000; // 1 minute
const BLOCK_DURATION = 15 * 60 * 1000; // 15 min

function checkRateLimit(ip, route = 'global') {
  const now = Date.now();
  if (!requestCounts[ip]) {
    requestCounts[ip] = { count: 0, reset: now + WINDOW, blockedUntil: 0 };
  }
  const entry = requestCounts[ip];

  if (now < entry.blockedUntil) return { blocked: true };

  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + WINDOW;
  }

  entry.count++;
  const limit = route === '/login' ? LIMITS.login : LIMITS.global;

  if (entry.count > limit) {
    entry.blockedUntil = now + BLOCK_DURATION;
    return { blocked: true };
  }

  return { blocked: false };
}

module.exports = { checkRateLimit };
