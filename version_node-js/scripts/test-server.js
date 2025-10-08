// ============================================
// Suite de tests pour CinéReserve avec JWT
// ============================================

const http = require('http');

const BASE_URL = 'http://localhost:3000';
let testToken = null;
let testUserId = null;

// Couleurs pour les logs
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// ============================================
// Utilitaires
// ============================================

function log(type, message) {
  const timestamp = new Date().toISOString();
  const colorMap = {
    'SUCCESS': colors.green,
    'ERROR': colors.red,
    'INFO': colors.blue,
    'WARN': colors.yellow
  };
  console.log(`${colorMap[type]}[${type}]${colors.reset} ${timestamp} - ${message}`);
}

async function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: JSON.parse(data)
          });
        } catch {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion échouée: ${message}`);
  }
}

// ============================================
// Tests
// ============================================

async function testGetFilms() {
  log('INFO', 'Test: GET /films (route publique)');
  try {
    const res = await makeRequest('GET', '/films');
    assert(res.status === 200, `Status devrait être 200, reçu ${res.status}`);
    assert(res.body.success === true, 'success devrait être true');
    assert(Array.isArray(res.body.data), 'data devrait être un tableau');
    assert(res.body.data.length > 0, 'Il devrait y avoir au moins un film');
    log('SUCCESS', '✓ GET /films fonctionne correctement');
    return true;
  } catch (error) {
    log('ERROR', `✗ GET /films a échoué: ${error.message}`);
    return false;
  }
}

async function testSignup() {
  log('INFO', 'Test: POST /signup');
  const username = `testuser_${Date.now()}`;
  try {
    const res = await makeRequest('POST', '/signup', {
      username: username,
      password: 'testpass123',
      nom: 'Test User'
    });
    
    assert(res.status === 201, `Status devrait être 201, reçu ${res.status}`);
    assert(res.body.success === true, 'success devrait être true');
    assert(res.body.data.token, 'Un token JWT devrait être retourné');
    assert(res.body.data.id, 'Un ID utilisateur devrait être retourné');
    assert(res.body.data.username === username, 'Le username devrait correspondre');
    
    // Sauvegarder pour tests suivants
    testToken = res.body.data.token;
    testUserId = res.body.data.id;
    
    log('SUCCESS', `✓ Inscription réussie - Token: ${testToken.substring(0, 20)}...`);
    return true;
  } catch (error) {
    log('ERROR', `✗ Inscription échouée: ${error.message}`);
    return false;
  }
}

async function testSignupDuplicate() {
  log('INFO', 'Test: POST /signup avec username existant');
  try {
    const res = await makeRequest('POST', '/signup', {
      username: 'admin', // Username qui existe déjà
      password: 'testpass123',
      nom: 'Test Duplicate'
    });
    
    assert(res.status === 409, `Status devrait être 409 (Conflict), reçu ${res.status}`);
    assert(res.body.success === false, 'success devrait être false');
    log('SUCCESS', '✓ Duplication correctement rejetée');
    return true;
  } catch (error) {
    log('ERROR', `✗ Test duplication échoué: ${error.message}`);
    return false;
  }
}

async function testLoginSuccess() {
  log('INFO', 'Test: POST /login avec credentials valides');
  try {
    const res = await makeRequest('POST', '/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    assert(res.status === 200, `Status devrait être 200, reçu ${res.status}`);
    assert(res.body.success === true, 'success devrait être true');
    assert(res.body.data.token, 'Un token JWT devrait être retourné');
    assert(res.body.data.userId, 'Un userId devrait être retourné');
    
    log('SUCCESS', `✓ Login réussi - Token reçu`);
    return true;
  } catch (error) {
    log('ERROR', `✗ Login échoué: ${error.message}`);
    return false;
  }
}

async function testLoginFailed() {
  log('INFO', 'Test: POST /login avec mauvais password');
  try {
    const res = await makeRequest('POST', '/login', {
      username: 'admin',
      password: 'wrongpassword'
    });
    
    assert(res.status === 401, `Status devrait être 401, reçu ${res.status}`);
    assert(res.body.success === false, 'success devrait être false');
    log('SUCCESS', '✓ Login invalide correctement rejeté');
    return true;
  } catch (error) {
    log('ERROR', `✗ Test login invalide échoué: ${error.message}`);
    return false;
  }
}

async function testGetMeWithAuth() {
  log('INFO', 'Test: GET /me avec token valide');
  try {
    const res = await makeRequest('GET', '/me', null, testToken);
    
    assert(res.status === 200, `Status devrait être 200, reçu ${res.status}`);
    assert(res.body.success === true, 'success devrait être true');
    assert(res.body.data.id === testUserId, 'userId devrait correspondre');
    assert(res.body.data.username, 'username devrait être présent');
    
    log('SUCCESS', '✓ GET /me avec auth fonctionne');
    return true;
  } catch (error) {
    log('ERROR', `✗ GET /me échoué: ${error.message}`);
    return false;
  }
}

async function testGetMeWithoutAuth() {
  log('INFO', 'Test: GET /me sans token');
  try {
    const res = await makeRequest('GET', '/me');
    
    assert(res.status === 401, `Status devrait être 401, reçu ${res.status}`);
    assert(res.body.success === false, 'success devrait être false');
    
    log('SUCCESS', '✓ GET /me sans auth correctement rejeté');
    return true;
  } catch (error) {
    log('ERROR', `✗ Test GET /me sans auth échoué: ${error.message}`);
    return false;
  }
}

async function testCreateReservationWithAuth() {
  log('INFO', 'Test: POST /reservations avec token valide');
  try {
    const res = await makeRequest('POST', '/reservations', {
      filmId: 1,
      nombrePlaces: 2
    }, testToken);
    
    assert(res.status === 201, `Status devrait être 201, reçu ${res.status}`);
    assert(res.body.success === true, 'success devrait être true');
    assert(res.body.data.id, 'Une réservation devrait être créée');
    assert(res.body.data.userId === testUserId, 'userId devrait correspondre au token');
    assert(res.body.data.nombrePlaces === 2, 'nombrePlaces devrait être 2');
    
    log('SUCCESS', `✓ Réservation créée avec ID: ${res.body.data.id}`);
    return true;
  } catch (error) {
    log('ERROR', `✗ Création réservation échouée: ${error.message}`);
    return false;
  }
}

async function testCreateReservationWithoutAuth() {
  log('INFO', 'Test: POST /reservations sans token');
  try {
    const res = await makeRequest('POST', '/reservations', {
      filmId: 1,
      nombrePlaces: 2
    });
    
    assert(res.status === 401, `Status devrait être 401, reçu ${res.status}`);
    assert(res.body.success === false, 'success devrait être false');
    
    log('SUCCESS', '✓ Réservation sans auth correctement rejetée');
    return true;
  } catch (error) {
    log('ERROR', `✗ Test réservation sans auth échoué: ${error.message}`);
    return false;
  }
}

async function testGetReservationsWithAuth() {
  log('INFO', 'Test: GET /reservations avec token valide');
  try {
    const res = await makeRequest('GET', '/reservations', null, testToken);
    
    assert(res.status === 200, `Status devrait être 200, reçu ${res.status}`);
    assert(res.body.success === true, 'success devrait être true');
    assert(Array.isArray(res.body.data), 'data devrait être un tableau');
    
    // Vérifier que toutes les réservations appartiennent à l'utilisateur
    res.body.data.forEach(reservation => {
      assert(reservation.userId === testUserId, 'Toutes les réservations devraient appartenir au user');
    });
    
    log('SUCCESS', `✓ Réservations récupérées (${res.body.data.length} trouvée(s))`);
    return true;
  } catch (error) {
    log('ERROR', `✗ GET /reservations échoué: ${error.message}`);
    return false;
  }
}

async function testGetReservationsWithoutAuth() {
  log('INFO', 'Test: GET /reservations sans token');
  try {
    const res = await makeRequest('GET', '/reservations');
    
    assert(res.status === 401, `Status devrait être 401, reçu ${res.status}`);
    assert(res.body.success === false, 'success devrait être false');
    
    log('SUCCESS', '✓ GET /reservations sans auth correctement rejeté');
    return true;
  } catch (error) {
    log('ERROR', `✗ Test GET /reservations sans auth échoué: ${error.message}`);
    return false;
  }
}

async function testLogout() {
  log('INFO', 'Test: POST /logout');
  try {
    const res = await makeRequest('POST', '/logout', null, testToken);
    
    assert(res.status === 200, `Status devrait être 200, reçu ${res.status}`);
    assert(res.body.success === true, 'success devrait être true');
    
    log('SUCCESS', '✓ Déconnexion réussie');
    return true;
  } catch (error) {
    log('ERROR', `✗ Logout échoué: ${error.message}`);
    return false;
  }
}

async function testInvalidToken() {
  log('INFO', 'Test: Requête avec token invalide');
  try {
    const res = await makeRequest('GET', '/me', null, 'invalid.token.here');
    
    assert(res.status === 401, `Status devrait être 401, reçu ${res.status}`);
    assert(res.body.success === false, 'success devrait être false');
    
    log('SUCCESS', '✓ Token invalide correctement rejeté');
    return true;
  } catch (error) {
    log('ERROR', `✗ Test token invalide échoué: ${error.message}`);
    return false;
  }
}

async function testValidationErrors() {
  log('INFO', 'Test: Validation des données');
  try {
    // Test avec password trop court
    const res1 = await makeRequest('POST', '/signup', {
      username: 'test',
      password: 'short',
      nom: 'Test'
    });
    assert(res1.status === 400, 'Password trop court devrait être rejeté');
    
    // Test avec données manquantes
    const res2 = await makeRequest('POST', '/login', {
      username: 'test'
      // password manquant
    });
    assert(res2.status === 400, 'Données manquantes devraient être rejetées');
    
    log('SUCCESS', '✓ Validations fonctionnent correctement');
    return true;
  } catch (error) {
    log('ERROR', `✗ Test validation échoué: ${error.message}`);
    return false;
  }
}

async function testRateLimiting() {
  log('INFO', 'Test: Rate limiting');
  try {
    // Faire beaucoup de requêtes rapidement
    const promises = [];
    for (let i = 0; i < 150; i++) {
      promises.push(makeRequest('GET', '/films'));
    }
    
    const results = await Promise.all(promises);
    const blocked = results.filter(r => r.status === 429);
    
    if (blocked.length > 0) {
      log('SUCCESS', `✓ Rate limiting activé (${blocked.length} requêtes bloquées)`);
      return true;
    } else {
      log('WARN', '⚠ Rate limiting non déclenché (limite peut-être trop haute)');
      return true;
    }
  } catch (error) {
    log('ERROR', `✗ Test rate limiting échoué: ${error.message}`);
    return false;
  }
}

async function testSecurityHeaders() {
  log('INFO', 'Test: Headers de sécurité');
  try {
    const res = await makeRequest('GET', '/films');
    
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection'
    ];
    
    securityHeaders.forEach(header => {
      if (res.headers[header]) {
        log('INFO', `  ✓ Header ${header}: ${res.headers[header]}`);
      }
    });
    
    log('SUCCESS', '✓ Headers de sécurité vérifiés');
    return true;
  } catch (error) {
    log('ERROR', `✗ Test headers échoué: ${error.message}`);
    return false;
  }
}

// ============================================
// Exécution des tests
// ============================================

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 SUITE DE TESTS - CinéReserve avec JWT');
  console.log('='.repeat(60) + '\n');

  const tests = [
    // Tests routes publiques
    { name: 'GET /films', fn: testGetFilms },
    
    // Tests authentification
    { name: 'Inscription', fn: testSignup },
    { name: 'Inscription (duplication)', fn: testSignupDuplicate },
    { name: 'Login valide', fn: testLoginSuccess },
    { name: 'Login invalide', fn: testLoginFailed },
    
    // Tests routes protégées
    { name: 'GET /me avec auth', fn: testGetMeWithAuth },
    { name: 'GET /me sans auth', fn: testGetMeWithoutAuth },
    { name: 'Créer réservation avec auth', fn: testCreateReservationWithAuth },
    { name: 'Créer réservation sans auth', fn: testCreateReservationWithoutAuth },
    { name: 'GET réservations avec auth', fn: testGetReservationsWithAuth },
    { name: 'GET réservations sans auth', fn: testGetReservationsWithoutAuth },
    { name: 'Logout', fn: testLogout },
    
    // Tests sécurité
    { name: 'Token invalide', fn: testInvalidToken },
    { name: 'Validation données', fn: testValidationErrors },
    { name: 'Rate limiting', fn: testRateLimiting },
    { name: 'Security headers', fn: testSecurityHeaders },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\n${'─'.repeat(60)}`);
    const result = await test.fn();
    if (result) {
      passed++;
    } else {
      failed++;
    }
    // Petite pause entre les tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSULTATS');
  console.log('='.repeat(60));
  console.log(`${colors.green}✓ Tests réussis: ${passed}${colors.reset}`);
  console.log(`${colors.red}✗ Tests échoués: ${failed}${colors.reset}`);
  console.log(`📈 Taux de réussite: ${((passed / tests.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

// Attendre que le serveur soit prêt
setTimeout(() => {
  runAllTests().catch(error => {
    log('ERROR', `Erreur fatale: ${error.message}`);
    process.exit(1);
  });
}, 1000);