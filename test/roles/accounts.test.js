// Accounts (v2): passwords, sessions, cookies, rate limits, sign-up, the
// pending role, family links, approvals, and demo reset.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, sameBytes } from '../../src/auth/password.js';
import { startApp, demoPassword, sessionFrom } from '../helpers/server.js';

let app;
let store;
before(async () => {
  app = await startApp({ prefix: 'porchlight-accounts-' });
  store = app.store;
});
after(() => app.close());

const SENIOR_FORM = { interests: ['cars', 'history'], availability: ['tue-afternoon'], contactMethod: 'phone', town: 'Carmel' };

test('passwords: PBKDF2-SHA256, 40,000 iterations, 16-byte salt, 32-byte hash, checked with the stored count', async () => {
  const record = await hashPassword('a long sentence for a test');
  assert.equal(record.algo, 'pbkdf2-sha256');
  assert.equal(record.iterations, 40000);
  assert.equal(Buffer.from(record.salt, 'base64').length, 16);
  assert.equal(Buffer.from(record.hash, 'base64').length, 32);
  assert.equal(await verifyPassword('a long sentence for a test', record), true);
  assert.equal(await verifyPassword('a long sentence for a tesT', record), false);
  const fewer = await hashPassword('another sentence here', { iterations: 20000 });
  assert.equal(await verifyPassword('another sentence here', fewer), true, 'uses the stored iteration count');
  assert.equal(await verifyPassword('x', { ...record, algo: 'md5' }), false);
  assert.equal(sameBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2])), true);
  assert.equal(sameBytes(new Uint8Array([1, 2]), new Uint8Array([1, 3])), false);
  assert.equal(sameBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2, 0])), false);
});

test('the seed stores only hashes, never the demo password', () => {
  const password = demoPassword();
  const text = JSON.stringify(store.data);
  assert.ok(!text.includes(password), 'the demo password is in the data');
  for (const u of store.users) assert.equal(u.password.algo, 'pbkdf2-sha256', u.email);
  assert.equal(store.users.filter((u) => u.role === 'admin').length, 1);
  assert.equal(store.seniors.length, 12);
  assert.equal(store.volunteers.length, 10);
  assert.equal(store.users.filter((u) => u.role === 'family').length, 10);
  for (const s of store.seniors) assert.match(s.familyCode, /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6,8}$/, s.id);
  for (const v of store.volunteers) assert.ok(['active', 'pending'].includes(v.status), v.id);
  for (const p of [...store.seniors, ...store.volunteers]) assert.ok(Array.isArray(p.languages) && typeof p.translateHelp === 'boolean', p.id);
  assert.equal(store.volunteers.filter((v) => v.status === 'pending').length, 1);
  assert.equal(store.familyLinks.filter((l) => l.status === 'pending').length, 1);
  const samiraMatch = store.matches.find((m) => m.id === 'm-samira-jordan');
  assert.ok(samiraMatch && samiraMatch.seniorId === 's-samira' && samiraMatch.volunteerId === 'v-jordan');
  assert.equal(store.userByEmail('samira@porchlight.example').uiLanguage, 'ar');
  for (const u of store.users) assert.match(u.email, /@porchlight\.example$/);
});

test('sign in with the README password: cookie flags, the right home page, and sign-out ends the session', async () => {
  store.reset();
  let res = await app.post('/sign-in', { email: '  ADMIN@porchlight.example ', password: demoPassword() });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/admin?msg=signed_in');
  const setCookie = res.headers.getSetCookie().find((c) => c.startsWith('pl_session='));
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.match(setCookie, /Path=\//);
  assert.match(setCookie, /Max-Age=28800/);
  assert.doesNotMatch(setCookie, /Secure/, 'plain http: no Secure flag');
  const cookie = sessionFrom(res);
  const token = cookie.split('=')[1];
  assert.ok(!JSON.stringify(store.sessions).includes(token), 'only the hash of the token is stored');
  assert.equal((await app.get('/admin', { cookie })).status, 200);

  // Behind an https proxy, the cookie is Secure.
  res = await fetch(`${app.base}/sign-in`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-proto': 'https' },
    body: new URLSearchParams({ email: 'hal@porchlight.example', password: demoPassword() }).toString(),
  });
  assert.match(res.headers.getSetCookie().find((c) => c.startsWith('pl_session=')), /; Secure/);
  assert.equal(res.headers.get('location'), '/seniors/s-harold?msg=signed_in');

  // ?next= is followed only to a page this person may open.
  res = await app.post('/sign-in', { email: 'admin@porchlight.example', password: demoPassword(), next: '/admin/approvals' });
  assert.equal(res.headers.get('location'), '/admin/approvals');
  res = await app.post('/sign-in', { email: 'hal@porchlight.example', password: demoPassword(), next: '/admin/approvals' });
  assert.equal(res.headers.get('location'), '/seniors/s-harold?msg=signed_in');
  res = await app.post('/sign-in', { email: 'admin@porchlight.example', password: demoPassword(), next: '//evil.example' });
  assert.equal(res.headers.get('location'), '/admin?msg=signed_in');

  res = await app.post('/sign-out', {}, { cookie });
  assert.equal(res.status, 303);
  assert.match(res.headers.getSetCookie().join(), /pl_session=; Path=\/; Max-Age=0/);
  res = await app.get('/admin', { cookie });
  assert.equal(res.status, 303, 'the old cookie no longer works');
});

test('a wrong password or unknown email says the same thing', async () => {
  const a = await (await app.post('/sign-in', { email: 'hal@porchlight.example', password: 'not the password' })).text();
  const b = await (await app.post('/sign-in', { email: 'nobody@porchlight.example', password: 'not the password' })).text();
  const message = /That email and password don&#39;t match/;
  assert.match(a, message);
  assert.match(b, message);
  assert.match(a, /class="error-summary"/);
});

test('rate limit: 5 wrong passwords per email and address in 15 minutes, then a friendly 429', async () => {
  const email = 'dorothy@porchlight.example';
  for (let i = 0; i < 5; i++) assert.equal((await app.post('/sign-in', { email, password: `wrong guess ${i}` })).status, 200);
  const res = await app.post('/sign-in', { email, password: demoPassword() });
  assert.equal(res.status, 429, 'even the right password waits');
  const body = await res.text();
  assert.match(body, /<h1>Please wait a little while<\/h1>/);
  assert.equal(sessionFrom(res), null);
  // Another email from the same address is not blocked.
  assert.equal((await app.post('/sign-in', { email: 'rosa@porchlight.example', password: demoPassword() })).status, 303);
});

test('a client cannot pick its own address for the rate limits', async () => {
  const email = 'eugene@porchlight.example';
  for (let i = 0; i < 5; i++) {
    await fetch(`${app.base}/sign-in`, {
      method: 'POST', redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-porchlight-client-ip': `10.0.0.${i}`, 'cf-connecting-ip': `10.1.0.${i}` },
      body: new URLSearchParams({ email, password: 'wrong guess' }).toString(),
    });
  }
  assert.equal((await app.post('/sign-in', { email, password: demoPassword() })).status, 429);
});

test('demo buttons: senior, senior-ar, volunteer, volunteer-translate, family; never an admin', async () => {
  store.reset();
  const page = await (await app.get('/sign-in')).text();
  const buttons = [...page.matchAll(/name="as" value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(buttons, ['senior', 'senior-ar', 'volunteer', 'volunteer-translate', 'family']);
  assert.match(page, /This is a demo/);
  for (const [as, home] of [['senior', '/seniors/s-harold'], ['senior-ar', '/seniors/s-samira'], ['volunteer', '/volunteers/v-ethan/week'], ['volunteer-translate', '/volunteers/v-jordan/week'], ['family', '/dashboard']]) {
    const res = await app.post('/sign-in/demo', { as });
    assert.equal(res.status, 303, as);
    assert.equal(res.headers.get('location'), `${home}?msg=signed_in`, as);
    assert.ok(sessionFrom(res), as);
  }
  for (const as of ['admin', 'coordinator', 'admin@porchlight.example', '']) {
    const res = await app.post('/sign-in/demo', { as });
    assert.equal(res.status, 200, as);
    assert.equal(sessionFrom(res), null, as);
  }
});

test('sign-up never makes an admin, and the same email in other letters is taken', async () => {
  store.reset();
  let res = await app.post('/sign-up/volunteer', {
    name: 'Riley Sun', email: 'Riley@Example.org', password: 'a fine long passphrase', role: 'admin',
    interests: 'reading', availability: 'mon-morning', contactMethods: 'phone', town: 'Carmel',
  });
  assert.equal(res.status, 303);
  const riley = store.userByEmail('riley@example.org');
  assert.equal(riley.role, 'volunteer', 'the role comes from the page, never the form');
  assert.equal(riley.email, 'riley@example.org');
  assert.equal(store.users.filter((u) => u.role === 'admin').length, 1);
  assert.equal(store.volunteer(riley.volunteerId).status, 'pending');

  res = await app.post('/sign-up/senior', { ...SENIOR_FORM, name: 'Riley Again', email: ' RILEY@example.ORG ', password: 'another fine passphrase' });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /There is already an account with this email/);

  // Password rules.
  for (const [password, message] of [['short', /at least 10/], ['password123', /too easy to guess/], ['dana@example.org', /different from your email/]]) {
    res = await app.post('/sign-up/family', { name: 'Dana', email: 'dana@example.org', password, familyCode: 'HKW8PZ', relationship: 'Niece' });
    assert.match(await res.text(), message, password);
  }
  res = await app.post('/sign-up/family', { name: 'Dana', email: 'not an email', password: 'a fine long passphrase', familyCode: 'HKW8PZ', relationship: 'Niece' });
  assert.match(await res.text(), /Enter an email like/);
  res = await app.post('/sign-up/family', { name: 'Dana', email: `${'a'.repeat(250)}@x.org`, password: 'a fine long passphrase', familyCode: 'HKW8PZ', relationship: 'Niece' });
  assert.match(await res.text(), /at most 254/);
});

test('a pending volunteer sees no senior and cannot be matched; approval changes that', async () => {
  store.reset();
  const noah = 'noah@porchlight.example';
  let res = await app.get('/', { as: noah });
  assert.equal(res.headers.get('location'), '/home');
  const home = await (await app.get('/home', { as: noah })).text();
  assert.match(home, /<h1>Waiting for approval<\/h1>/);
  for (const p of ['/volunteers/v-noah/week', '/volunteers/v-noah', '/contacts', '/seniors/s-eugene', '/dashboard']) {
    assert.equal((await app.get(p, { as: noah })).status, 403, p);
  }
  assert.equal((await app.get('/account', { as: noah })).status, 200);
  const matchPage = await (await app.get('/admin/match?seniorId=s-eugene', { as: 'admin' })).text();
  assert.doesNotMatch(matchPage, /Noah Fischer/, 'a pending volunteer is not ranked');
  res = await app.post('/admin/matches', { seniorId: 's-eugene', volunteerId: 'v-noah' }, { as: 'admin' });
  assert.equal(res.status, 409);

  const approvals = await (await app.get('/admin/approvals', { as: 'admin' })).text();
  assert.match(approvals, /Noah Fischer/);
  assert.match(approvals, /Ellen Hayes/);
  res = await app.post('/admin/approvals/volunteers/v-noah', { decision: 'approve' }, { as: 'admin' });
  assert.equal(res.headers.get('location'), '/admin/approvals?msg=approved');
  assert.match(await (await app.get('/admin/approvals?msg=approved', { as: 'admin' })).text(), /Approved\./);
  assert.equal(store.volunteer('v-noah').status, 'active');
  assert.equal((await app.get('/volunteers/v-noah/week', { as: noah })).status, 200);
});

test('a family link does nothing until a coordinator approves it', async () => {
  store.reset();
  // A new family member with Hal's family code.
  let res = await app.post('/sign-up/family', { name: 'Tess Whitaker', email: 'tess@example.org', password: 'a fine long passphrase', familyCode: 'hkw-8pz', relationship: 'Granddaughter' });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/home?msg=signed_up');
  const cookie = sessionFrom(res);
  for (const p of ['/dashboard', '/seniors/s-harold', '/seniors/s-harold/summary']) assert.equal((await app.get(p, { cookie })).status, 403, p);
  assert.match(await (await app.get('/home', { cookie })).text(), /check your link soon/);
  // A wrong code is refused.
  res = await app.post('/sign-up/family', { name: 'Tess', email: 'tess2@example.org', password: 'a fine long passphrase', familyCode: 'ZZZZZZ', relationship: 'Niece' });
  assert.match(await res.text(), /couldn&#39;t find that family code/);

  const link = store.familyLinks.find((l) => l.userId === store.userByEmail('tess@example.org').id);
  assert.equal(link.status, 'pending');
  res = await app.post(`/admin/approvals/family/${link.id}`, { decision: 'approve' }, { as: 'admin' });
  assert.equal(res.status, 303);
  assert.equal((await app.get('/dashboard', { cookie })).status, 200);
  assert.equal((await app.get('/seniors/s-harold', { cookie })).status, 200);
  assert.equal((await app.get('/seniors/s-rosa', { cookie })).status, 403);

  // The seed's pending link (Ellen and Walter) can be declined.
  res = await app.post('/admin/approvals/family/fl-ellen', { decision: 'decline' }, { as: 'admin' });
  assert.equal(res.headers.get('location'), '/admin/approvals?msg=declined');
  assert.match(await (await app.get('/home', { as: 'ellen@porchlight.example' })).text(), /Not approved/);
});

test('a family member signs up a senior they help: two accounts, consent required, a pending link', async () => {
  store.reset();
  const form = {
    ...SENIOR_FORM, helper: '1', name: 'June Carter', preferredName: 'June', email: 'june@example.org', password: 'june has a passphrase',
    helperName: 'Ann Carter', helperEmail: 'ann@example.org', helperPassword: 'ann has a passphrase', relationship: 'Daughter',
  };
  let res = await app.post('/sign-up/senior', form);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Check the box to show the senior said yes/);
  res = await app.post('/sign-up/senior', { ...form, consent: 'yes' });
  assert.equal(res.status, 303);
  const june = store.userByEmail('june@example.org');
  const ann = store.userByEmail('ann@example.org');
  assert.equal(june.role, 'senior');
  assert.equal(ann.role, 'family');
  assert.equal(store.familyLinksForUser(ann.id)[0].status, 'pending');
  assert.match(store.senior(june.seniorId).familyCode, /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
});

test('the senior sign-up page shows the town list, the demo notice, and labels on every field', async () => {
  const page = await (await app.get('/sign-up/senior')).text();
  assert.match(page, /This is a demo/);
  assert.match(page, /<select id="field-town" name="town"/);
  for (const m of page.matchAll(/<input id="(field-[^"]+)"/g)) assert.match(page, new RegExp(`<label for="${m[1]}"`), m[1]);
  assert.match(await (await app.get('/sign-up/senior?helper=1')).text(), /name="consent"/);
});

test('/account: name and interface language; a senior sees their family code', async () => {
  store.reset();
  let res = await app.post('/account', { name: 'Hal Whitaker', uiLanguage: 'en' }, { as: 'senior' });
  assert.equal(res.status, 303);
  assert.equal(store.userByEmail('hal@porchlight.example').name, 'Hal Whitaker');
  res = await app.post('/account', { name: '   ', uiLanguage: 'xx' }, { as: 'senior' });
  const body = await res.text();
  assert.match(body, /Enter a name\./);
  assert.match(body, /Choose a language from the list\./);
  assert.match(await (await app.get('/account', { as: 'senior' })).text(), /HKW8PZ/);
  assert.doesNotMatch(await (await app.get('/account', { as: 'volunteer' })).text(), /family code/i);
  store.reset();
});

test('a stale or unknown session cookie counts as signed out and is cleared', async () => {
  store.reset();
  const cookie = await app.cookieFor('volunteer');
  assert.equal((await app.get('/volunteers/v-ethan/week', { cookie })).status, 200);
  store.reset(); // wipes every session
  for (const c of [cookie, 'pl_session=not-a-real-token', `pl_session=${'A'.repeat(43)}`]) {
    const res = await app.get('/volunteers/v-ethan/week', { cookie: c });
    assert.equal(res.status, 303, c);
    assert.match(res.headers.get('location'), /^\/sign-in\?next=/);
    assert.match(res.headers.getSetCookie().join(), /pl_session=; Path=\/; Max-Age=0/, `${c} is cleared`);
  }
  // The old demo cookie means nothing now.
  const res = await app.get('/admin', { cookie: 'viewer=coordinator' });
  assert.equal(res.status, 303);
});

test('demo reset wipes sign-ups and sessions, and keeps the admin who pressed it signed in', async () => {
  store.reset();
  await app.post('/sign-up/volunteer', { name: 'Temp Vol', email: 'temp@example.org', password: 'a fine long passphrase', interests: 'reading', availability: 'mon-morning', contactMethods: 'phone', town: 'Carmel' });
  assert.ok(store.userByEmail('temp@example.org'));
  const ethan = await app.cookieFor('volunteer');
  const admin = await app.cookieFor('admin');
  const res = await app.post('/admin/demo/reset', {}, { cookie: admin });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/admin/dashboard?msg=reset');
  assert.equal(store.userByEmail('temp@example.org'), null);
  const fresh = sessionFrom(res);
  assert.ok(fresh, 'a new session for the seed admin');
  assert.equal((await app.get('/admin/dashboard', { cookie: fresh })).status, 200);
  assert.equal((await app.get('/admin/dashboard', { cookie: admin })).status, 303, 'the old admin session is gone');
  assert.equal((await app.get('/volunteers/v-ethan/week', { cookie: ethan })).status, 303, 'everyone else is signed out');
});

test('sign-up rate limit: at most 5 new accounts per address per hour', async () => {
  const fresh = await startApp({ prefix: 'porchlight-signup-limit-' });
  try {
    for (let i = 0; i < 5; i++) {
      const res = await fresh.post('/sign-up/volunteer', { name: `Vol ${i}`, email: `vol${i}@example.org`, password: 'a fine long passphrase', interests: 'reading', availability: 'mon-morning', contactMethods: 'phone', town: 'Carmel' });
      assert.equal(res.status, 303, `sign-up ${i}`);
    }
    const res = await fresh.post('/sign-up/senior', { ...SENIOR_FORM, name: 'One Too Many', email: 'six@example.org', password: 'a fine long passphrase' });
    assert.equal(res.status, 429);
    assert.match(await res.text(), /Too many new accounts/);
    assert.equal(fresh.store.userByEmail('six@example.org'), null);
  } finally {
    fresh.close();
  }
});
