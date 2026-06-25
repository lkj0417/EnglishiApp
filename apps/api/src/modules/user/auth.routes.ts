import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb, users } from '@englishi/database';
import { eq } from 'drizzle-orm';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(100),
  adminSecret: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = RegisterSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });

    const db = getDb();
    const { email, password, displayName, adminSecret } = body.data;

    const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) return reply.code(409).send({ success: false, error: { code: 'EMAIL_EXISTS', message: 'Email already registered' } });

    const passwordHash = await bcrypt.hash(password, 12);
    const ADMIN_SECRET = process.env['ADMIN_SECRET'] ?? 'change-this-admin-secret';
    const role = adminSecret === ADMIN_SECRET ? 'admin' : 'student';

    const [newUser] = await db.insert(users).values({ email: email.toLowerCase(), passwordHash, displayName, role })
      .returning({ id: users.id, email: users.email, displayName: users.displayName, role: users.role });

    const token = app.jwt.sign({ userId: newUser!.id, email: newUser!.email, role: newUser!.role });
    return reply.code(201).send({ success: true, data: { user: newUser, token } });
  });

  app.post('/login', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = LoginSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });

    const db = getDb();
    const { email, password } = body.data;
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return reply.code(401).send({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }

    await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, user.id));
    const token = app.jwt.sign({ userId: user.id, email: user.email, role: user.role });

    return reply.send({
      success: true,
      data: {
        user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, onboardingCompleted: user.onboardingCompleted },
        token,
      },
    });
  });
}
