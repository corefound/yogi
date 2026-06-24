import "dotenv/config";
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { db } from './config/db';
import { redis, isRedisAvailable, keyvRedis } from './config/redis';
import { RpcHandlers } from './routes/rpc';
import { ApolloServer } from '@apollo/server';
import { typeDefs, resolvers } from './gql';
import http from 'http';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { expressMiddleware } from '@as-integrations/express5';
import { Models } from './models';
import { KeyvAdapter } from "@apollo/utils.keyvadapter";


const PORT = process.env.PORT || 3456;
const app = express();
const httpServer = http.createServer(app);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ── JWT helpers ─────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function signToken(session: { sid: string; userId: number; role: string }): string {
    return jwt.sign(
        { sid: session.sid, userId: session.userId, role: session.role },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

function verifyToken(token: string): { sid: string; userId: number; role: string } | null {
    try { return jwt.verify(token, JWT_SECRET) as any; } catch { return null; }
}

// ── Session helpers (Redis) ─────────────────────────────────
const SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds

function generateSid(): string {
    return crypto.randomUUID();
}

interface SessionData {
    userId: number;
    userAgent: string;
    ipAddress: string | null;
    createdAt: string;
}

function redisKey(sid: string): string {
    return `session:${sid}`;
}

async function createSession(sid: string, userId: number, token: string, req: express.Request): Promise<void> {
    const data: SessionData = {
        userId,
        userAgent: (req.headers['user-agent'] || '').slice(0, 512),
        ipAddress: req.ip || req.socket.remoteAddress || null,
        createdAt: new Date().toISOString(),
    };

    if (isRedisAvailable()) {
        try {
            await redis!.setex(redisKey(sid), SESSION_TTL, JSON.stringify(data));
            return;
        } catch (err) {
            console.error('Redis setex error, falling back to PG:', err);
        }
    }

    // Fallback: PostgreSQL
    await Models.Sessions.create({
        sid,
        userId,
        token,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        expiresAt: new Date(Date.now() + SESSION_TTL * 1000),
        lastActivityAt: new Date(),
    });
}

async function validateSession(sid: string, userId: number): Promise<boolean> {
    if (isRedisAvailable()) {
        try {
            const raw = await redis!.get(redisKey(sid));
            if (!raw) return false;
            const data: SessionData = JSON.parse(raw);
            return data.userId === userId;
        } catch (err) {
            console.error('Redis get error, falling back to PG:', err);
        }
    }

    // Fallback: PostgreSQL
    const session = await Models.Sessions.findOne({
        where: {
            sid,
            userId,
            revokedAt: null,
            expiresAt: { [Op.gt]: new Date() },
        },
    });
    return session !== null;
}

async function touchSession(sid: string): Promise<void> {
    if (isRedisAvailable()) {
        try {
            await redis!.expire(redisKey(sid), SESSION_TTL);
            return;
        } catch (err) {
            console.error('Redis expire error, falling back to PG:', err);
        }
    }

    // Fallback: PostgreSQL
    await Models.Sessions.update(
        { lastActivityAt: new Date() },
        { where: { sid } }
    );
}

async function revokeSession(sid: string): Promise<void> {
    if (isRedisAvailable()) {
        try {
            await redis!.del(redisKey(sid));
            return;
        } catch (err) {
            console.error('Redis del error, falling back to PG:', err);
        }
    }

    // Fallback: PostgreSQL
    await Models.Sessions.update(
        { revokedAt: new Date() },
        { where: { sid } }
    );
}

// ── GitHub OAuth helpers ────────────────────────────────────
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || `http://localhost:${PORT}/auth/github/callback`;

function getGitHubAuthURL() {
    const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: GITHUB_REDIRECT_URI,
        scope: 'read:user user:email',
    });
    return `https://github.com/login/oauth/authorize?${params}`;
}

async function exchangeGitHubCode(code: string): Promise<string> {
    const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_REDIRECT_URI,
    });
    const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: params,
    });
    const data: any = await res.json();
    if (data.error) throw new Error(data.error_description || data.error);
    return data.access_token;
}

async function fetchGitHubUser(token: string) {
    const userRes = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
    });
    if (!userRes.ok) throw new Error(`GitHub API error: ${userRes.status}`);
    const user: any = await userRes.json();

    let email = user.email;
    if (!email) {
        const emailsRes = await fetch('https://api.github.com/user/emails', {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
        });
        if (emailsRes.ok) {
            const emails: any[] = await emailsRes.json();
            const primary = emails.find(e => e.primary);
            email = primary ? primary.email : (emails[0]?.email || null);
        }
    }
    return { id: user.id, login: user.login, name: user.name, avatarUrl: user.avatar_url, htmlUrl: user.html_url, email };
}

// ── Auth routes ─────────────────────────────────────────────
app.get('/auth/github', (_req, res) => {
    if (!GITHUB_CLIENT_ID) {
        return res.status(400).json({ error: 'GITHUB_CLIENT_ID not configured' });
    }
    res.redirect(getGitHubAuthURL());
});

app.get('/auth/github/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code || typeof code !== 'string') {
            return res.status(400).json({ error: 'Missing code parameter' });
        }

        const accessToken = await exchangeGitHubCode(code);
        const githubUser = await fetchGitHubUser(accessToken);

        const githubUserId = String(githubUser.id);
        const [user] = await Models.Users.findOrCreate({
            where: { githubUserId: githubUserId as any },
            defaults: {
                githubUserId: githubUserId as any,
                githubLogin: githubUser.login,
                displayName: githubUser.name,
                avatarUrl: githubUser.avatarUrl,
                profileUrl: githubUser.htmlUrl,
                email: githubUser.email,
                role: 'user',
                status: 'active',
                lastLoginAt: new Date(),
            },
        });

        await Models.Users.update({
            githubLogin: githubUser.login,
            displayName: githubUser.name,
            avatarUrl: githubUser.avatarUrl,
            profileUrl: githubUser.htmlUrl,
            email: githubUser.email,
            lastLoginAt: new Date(),
        }, { where: { githubUserId: githubUserId as any } });

        const sid = generateSid();
        const token = signToken({ sid, userId: user.id, role: user.role });
        await createSession(sid, user.id, token, req);

        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: SESSION_TTL * 1000,
            domain: 'localhost',
        });
        res.redirect(`${clientUrl}/auth/callback`);
    } catch (error: any) {
        console.error('OAuth callback error:', error);
        res.status(500).json({ error: error.message || 'OAuth failed' });
    }
});

app.get('/auth/me', async (req, res) => {
    const token = req.cookies?.token || (() => {
        const auth = req.headers.authorization;
        return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    })();

    if (!token) {
        return res.json({ user: null });
    }

    const payload = verifyToken(token);
    if (!payload) {
        return res.json({ user: null });
    }

    const valid = await validateSession(payload.sid, payload.userId);
    if (!valid) {
        res.clearCookie('token', { domain: 'localhost', path: '/' });
        return res.json({ user: null });
    }

    const user = await Models.Users.findByPk(payload.userId, {
        attributes: ['id', 'githubLogin', 'displayName', 'avatarUrl', 'profileUrl', 'email', 'role'],
    });

    res.json({ user });
});

app.post('/auth/logout', async (req, res) => {
    const token = req.cookies?.token || (() => {
        const auth = req.headers.authorization;
        return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    })();
    if (token) {
        const payload = verifyToken(token);
        if (payload) {
            await revokeSession(payload.sid);
        }
    }
    res.clearCookie('token', { domain: 'localhost', path: '/' });
    res.json({ success: true });
});

// ── GraphQL & RPC ───────────────────────────────────────────


const server = new ApolloServer({
    typeDefs,
    resolvers,
    csrfPrevention: false,
    cache: new KeyvAdapter(keyvRedis),
    plugins: [
        ApolloServerPluginDrainHttpServer({ httpServer }),
        ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ]
});

db.authenticate().then(async () => {
    await db.sync({ logging: false });
    await server.start();

    app.use('/graphql',
        cors<cors.CorsRequest>({
            origin: "*",
        }),
        express.json(),
        expressMiddleware(server, {
            context: async ({ req }) => ({ req })
        })
    );

    app.post('/rpc', async (req, res) => {
        try {
            const result = await RpcHandlers.dispatch(req.body);
            res.json(result);
        } catch (error) {
            console.error('RPC error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // 404 handler must be registered AFTER graphql to avoid intercepting /graphql
    app.use((req, res) => {
        res.status(404).json({ error: "Not Found" });
    });

    httpServer.listen(PORT, () => {
        console.log(`Yogi Registry Server running on http://localhost:${PORT}`);
    });

}).catch((error) => {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
});
