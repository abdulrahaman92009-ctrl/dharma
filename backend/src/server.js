
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const { Pool } = pg;
const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const NODE_ENV = process.env.NODE_ENV || 'development';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and contain at least 32 characters.');
}
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Configure a PostgreSQL database first.');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.PGSSL === 'true'
    ? { rejectUnauthorized: false }
    : undefined
});

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: FRONTEND_URL.split(',').map(s => s.trim()),
  credentials: true
}));
app.use(express.json({ limit: '32kb' }));
app.use(rateLimit({
  windowMs: 15 *  60 * 1000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

const emailSchema = z.string().email().max(255);
const passwordSchema = z.string().min(10).max(100);

function issueJwt(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d', issuer: 'humanity-connect' }
  );
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: 'humanity-connect'
    });
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

async function isBlocked(userA, userB) {
  const result = await pool.query(
    `SELECT 1 FROM blocks
     WHERE (blocker_id=$1 AND blocked_id=$2)
        OR (blocker_id=$2 AND blocked_id=$1)
     LIMIT 1`,
    [userA, userB]
  );
  return result.rowCount > 0;
}

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'humanity-connect-api', database: 'connected' });
  } catch {
    res.status(503).json({ ok: false, database: 'unavailable' });
  }
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const parsed = z.object({
    name: z.string().trim().min(2).max(80),
    email: emailSchema,
    password: passwordSchema
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Enter a valid name, email and password of at least 10 characters.' });
  }

  const { name, email, password } = parsed.data;
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (id, name, email, password_hash)
       VALUES ($1, $2, LOWER($3), $4)
       RETURNING id, name, email, bio, created_at`,
      [randomUUID(), name, email, passwordHash]
    );
    const user = result.rows[0];
    const token = issueJwt(user);
    res.status(201).json({ user, token });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    console.error('Registration error:', error.message);
    res.status(500).json({ error: 'Could not create account.' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const parsed = z.object({
    email: emailSchema,
    password: z.string().min(1).max(100)
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Enter a valid email and password.' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = LOWER($1)',
      [parsed.data.email]
    );
    const userRow = result.rows[0];
    if (!userRow || !(await bcrypt.compare(parsed.data.password, userRow.password_hash))) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    const user = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      bio: userRow.bio
    };
    res.json({ user, token: issueJwt(user) });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Could not sign in.' });
  }
});

app.get('/api/me', authenticate, async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, email, bio, created_at FROM users WHERE id=$1',
    [req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: result.rows[0] });
});

app.patch('/api/me', authenticate, async (req, res) => {
  const parsed = z.object({
    name: z.string().trim().min(2).max(80).optional(),
    bio: z.string().max(500).optional()
  }).safeParse(req.body);

  if (!parsed.success || Object.keys(parsed.data || {}).length === 0) {
    return res.status(400).json({ error: 'Provide a valid name or bio.' });
  }

  const { name, bio } = parsed.data;
  const result = await pool.query(
    `UPDATE users SET
       name=COALESCE($2,name),
       bio=COALESCE($3,bio)
     WHERE id=$1
     RETURNING id,name,email,bio,created_at`,
    [req.user.id, name ?? null, bio ?? null]
  );
  res.json({ user: result.rows[0] });
});

app.get('/api/members', authenticate, async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  const result = await pool.query(
    `SELECT id,name,bio,created_at FROM users
     WHERE id <> $1 AND (name ILIKE $2 OR bio ILIKE $2)
     AND NOT EXISTS (
       SELECT 1 FROM blocks b
       WHERE (b.blocker_id=$1 AND b.blocked_id=users.id)
          OR (b.blocker_id=users.id AND b.blocked_id=$1)
     )
     ORDER BY name LIMIT 50`,
    [req.user.id, `%${q}%`]
  );
  res.json({ members: result.rows });
});

app.get('/api/rooms', authenticate, async (_req, res) => {
  const result = await pool.query(
    `SELECT r.id,r.name,r.description,r.category,
       COUNT(rm.user_id)::int AS member_count
     FROM rooms r LEFT JOIN room_members rm ON rm.room_id=r.id
     WHERE r.is_public=TRUE
     GROUP BY r.id ORDER BY r.created_at DESC`
  );
  res.json({ rooms: result.rows });
});

app.post('/api/rooms', authenticate, async (req, res) => {
  const parsed = z.object({
    name: z.string().trim().min(3).max(100),
    description: z.string().max(500).optional(),
    category: z.enum(['community','volunteer','peer-support']).default('community')
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: 'Invalid room details.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const roomId = randomUUID();
    const room = await client.query(
      `INSERT INTO rooms (id,name,description,category,is_public,created_by)
       VALUES ($1,$2,$3,$4,TRUE,$5) RETURNING *`,
      [roomId, parsed.data.name, parsed.data.description || '', parsed.data.category, req.user.id]
    );
    await client.query(
      'INSERT INTO room_members (room_id,user_id) VALUES ($1,$2)',
      [roomId, req.user.id]
    );
    await client.query('COMMIT');
    res.status(201).json({ room: room.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create room error:', error.message);
    res.status(500).json({ error: 'Could not create room.' });
  } finally {
    client.release();
  }
});

app.post('/api/rooms/:roomId/join', authenticate, async (req, res) => {
  const room = await pool.query(
    'SELECT id FROM rooms WHERE id=$1 AND is_public=TRUE',
    [req.params.roomId]
  );
  if (!room.rowCount) return res.status(404).json({ error: 'Public room not found.' });

  await pool.query(
    `INSERT INTO room_members (room_id,user_id) VALUES ($1,$2)
     ON CONFLICT DO NOTHING`,
    [req.params.roomId, req.user.id]
  );
  res.json({ joined: true });
});

app.get('/api/rooms/:roomId/messages', authenticate, async (req, res) => {
  const membership = await pool.query(
    'SELECT 1 FROM room_members WHERE room_id=$1 AND user_id=$2',
    [req.params.roomId, req.user.id]
  );
  if (!membership.rowCount) return res.status(403).json({ error: 'Join this room to view its messages.' });

  const result = await pool.query(
    `SELECT m.id,m.body,m.created_at,
       u.id AS sender_id,u.name AS sender_name
     FROM messages m JOIN users u ON u.id=m.sender_id
     WHERE m.room_id=$1 ORDER BY m.created_at DESC LIMIT 100`,
    [req.params.roomId]
  );
  res.json({ messages: result.rows.reverse() });
});

app.post('/api/rooms/:roomId/messages', authenticate, async (req, res) => {
  const parsed = z.object({
    body: z.string().trim().min(1).max(4000)
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Message must contain 1–4000 characters.' });

  const membership = await pool.query(
    'SELECT 1 FROM room_members WHERE room_id=$1 AND user_id=$2',
    [req.params.roomId, req.user.id]
  );
  if (!membership.rowCount) return res.status(403).json({ error: 'Join this room before sending messages.' });

  const result = await pool.query(
    `INSERT INTO messages (id,room_id,sender_id,body)
     VALUES ($1,$2,$3,$4)
     RETURNING id,room_id,sender_id,body,created_at`,
    [randomUUID(), req.params.roomId, req.user.id, parsed.data.body]
  );
  res.status(201).json({ message: result.rows[0] });
});

app.post('/api/invitations', authenticate, async (req, res) => {
  const parsed = z.object({
    roomId: z.string().uuid(),
    expiresInHours: z.number().int().min(1).max(168).default(72)
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid invitation details.' });

  const member = await pool.query(
    'SELECT 1 FROM room_members WHERE room_id=$1 AND user_id=$2',
    [parsed.data.roomId, req.user.id]
  );
  if (!member.rowCount) return res.status(403).json({ error: 'You must belong to this room to invite others.' });

  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await pool.query(
    `INSERT INTO invitations (id,token_hash,created_by,room_id,expires_at)
     VALUES ($1,$2,$3,$4,NOW() + ($5 * INTERVAL '1 hour'))`,
    [randomUUID(), tokenHash, req.user.id, parsed.data.roomId, parsed.data.expiresInHours]
  );
  res.status(201).json({
    invitationToken: token,
    note: 'Share this optional invitation token privately. It expires automatically.'
  });
});

app.post('/api/invitations/redeem', authenticate, async (req, res) => {
  const parsed = z.object({ token: z.string().min(32).max(128) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid invitation token.' });

  const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const invite = await client.query(
      `SELECT * FROM invitations
       WHERE token_hash=$1 AND redeemed_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash]
    );
    if (!invite.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invitation is invalid, expired or already used.' });
    }
    const item = invite.rows[0];
    await client.query(
      'INSERT INTO room_members (room_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [item.room_id, req.user.id]
    );
    await client.query(
      'UPDATE invitations SET redeemed_by=$1,redeemed_at=NOW() WHERE id=$2',
      [req.user.id, item.id]
    );
    await client.query('COMMIT');
    res.json({ joined: true, roomId: item.room_id });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Redeem invitation error:', error.message);
    res.status(500).json({ error: 'Could not redeem invitation.' });
  } finally {
    client.release();
  }
});

app.post('/api/blocks/:userId', authenticate, async (req, res) => {
  if (req.params.userId === req.user.id) return res.status(400).json({ error: 'You cannot block yourself.' });
  await pool.query(
    `INSERT INTO blocks (blocker_id,blocked_id) VALUES ($1,$2)
     ON CONFLICT DO NOTHING`,
    [req.user.id, req.params.userId]
  );
  res.json({ blocked: true });
});

app.delete('/api/blocks/:userId', authenticate, async (req, res) => {
  await pool.query(
    'DELETE FROM blocks WHERE blocker_id=$1 AND blocked_id=$2',
    [req.user.id, req.params.userId]
  );
  res.json({ blocked: false });
});

app.post('/api/reports', authenticate, async (req, res) => {
  const parsed = z.object({
    reportedUserId: z.string().uuid(),
    reason: z.string().trim().min(5).max(500)
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Provide a valid report reason and user.' });
  if (parsed.data.reportedUserId === req.user.id) return res.status(400).json({ error: 'You cannot report yourself.' });

  await pool.query(
    `INSERT INTO reports (id,reporter_id,reported_user_id,reason)
     VALUES ($1,$2,$3,$4)`,
    [randomUUID(), req.user.id, parsed.data.reportedUserId, parsed.data.reason]
  );
  res.status(201).json({ reported: true });
});

// Nexconn is deliberately isolated until the installed SDK's actual exports,
// API domains and token response are verified. Never expose App Secret to browser.
app.get('/api/chat/provider-status', authenticate, (_req, res) => {
  const configured = Boolean(
    process.env.NEXCONN_APP_KEY &&
    process.env.NEXCONN_APP_SECRET &&
    process.env.NEXCONN_PRIMARY_API_DOMAIN &&
    process.env.NEXCONN_SECONDARY_API_DOMAIN
  );
  res.json({
    provider: 'Nexconn',
    credentialsConfigured: configured,
    tokenIssuanceEnabled: false,
    message: 'Nexconn SDK adapter must be verified before issuing live chat tokens.'
  });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled API error:', err.message);
  res.status(500).json({ error: 'Unexpected server error.' });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.join(__dirname, 'schema.sql');

async function start() {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Humanity Connect API listening on port ${PORT}`);
  });
}

start().catch(error => {
  console.error('Backend startup failed:', error.message);
  process.exit(1);
});
