// modules/requestLimiter.js
/**
 * Vérifie Content-Length et applique timeout + limite de taille de body
 * Usage : checkContentLength(req, res, maxBytes) -> returns { ok: true } ou { ok: false, code, message }
 * Usage pour timeout : call enforceTimeout(req, res, ms)
 */

function checkContentLength(req, maxBytes = 1 * 1024 * 1024) { // default 1MB
  const cl = req.headers['content-length'];
  if (cl && Number(cl) > maxBytes) {
    return { ok: false, code: 413, message: 'Payload trop volumineux' };
  }
  return { ok: true };
}

/**
 * Lit le body en respectant une limite de taille
 * Retourne une Promise qui résout le body string ou rejette {code, message}
 */
function readRequestBody(req, maxBytes = 1 * 1024 * 1024, timeoutMs = 30 * 1000) {
  return new Promise((resolve, reject) => {
    let received = 0;
    let chunks = [];

    // Timeout
    const to = setTimeout(() => {
      cleanup();
      reject({ code: 408, message: 'Timeout lecture du corps' });
    }, timeoutMs);

    function cleanup() {
      clearTimeout(to);
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
    }

    function onData(chunk) {
      received += chunk.length;
      if (received > maxBytes) {
        cleanup();
        reject({ code: 413, message: 'Payload trop volumineux' });
        return;
      }
      chunks.push(chunk);
    }

    function onEnd() {
      cleanup();
      resolve(Buffer.concat(chunks).toString('utf8'));
    }

    function onError(err) {
      cleanup();
      reject({ code: 500, message: 'Erreur lecture body' });
    }

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}

module.exports = { checkContentLength, readRequestBody };
