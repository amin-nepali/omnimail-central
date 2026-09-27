process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';
process.env.APP_ACCESS_PASSWORD = 'test-workspace-password';
process.env.APP_SESSION_SECRET = 'test-only-session-secret-with-sufficient-length';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');

test('production requires login and issues a browser-session cookie', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const sessionResponse = await fetch(`${baseUrl}/api/session`);
    assert.deepEqual(await sessionResponse.json(), { authenticated: false, required: true, configured: true });

    const privateResponse = await fetch(`${baseUrl}/api/accounts`);
    assert.equal(privateResponse.status, 401);

    const wrongPassword = await fetch(`${baseUrl}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'incorrect' }),
    });
    assert.equal(wrongPassword.status, 401);

    const loginResponse = await fetch(`${baseUrl}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test-workspace-password' }),
    });
    assert.equal(loginResponse.status, 200);
    const cookie = loginResponse.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.doesNotMatch(cookie, /Max-Age|Expires=/i);

    const authenticatedResponse = await fetch(`${baseUrl}/api/session`, { headers: { Cookie: cookie.split(';')[0] } });
    assert.equal((await authenticatedResponse.json()).authenticated, true);

    const stillUnconfigured = await fetch(`${baseUrl}/api/accounts`, { headers: { Cookie: cookie.split(';')[0] } });
    assert.equal(stillUnconfigured.status, 503);

    const removeResponse = await fetch(`${baseUrl}/api/accounts`, {
      method: 'DELETE',
      headers: { Cookie: cookie.split(';')[0] },
    });
    assert.equal(removeResponse.status, 503);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
