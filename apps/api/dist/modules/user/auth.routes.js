"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const database_1 = require("@englishi/database");
const drizzle_orm_1 = require("drizzle-orm");
const RegisterSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    displayName: zod_1.z.string().min(2).max(100),
    adminSecret: zod_1.z.string().optional(),
});
const LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
async function authRoutes(app) {
    app.post('/register', async (req, reply) => {
        const body = RegisterSchema.safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
        const db = (0, database_1.getDb)();
        const { email, password, displayName, adminSecret } = body.data;
        const existing = await db.select().from(database_1.users).where((0, drizzle_orm_1.eq)(database_1.users.email, email.toLowerCase())).limit(1);
        if (existing.length > 0)
            return reply.code(409).send({ success: false, error: { code: 'EMAIL_EXISTS', message: 'Email already registered' } });
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const ADMIN_SECRET = process.env['ADMIN_SECRET'] ?? 'change-this-admin-secret';
        const role = adminSecret === ADMIN_SECRET ? 'admin' : 'student';
        const [newUser] = await db.insert(database_1.users).values({ email: email.toLowerCase(), passwordHash, displayName, role })
            .returning({ id: database_1.users.id, email: database_1.users.email, displayName: database_1.users.displayName, role: database_1.users.role });
        const token = app.jwt.sign({ userId: newUser.id, email: newUser.email, role: newUser.role });
        return reply.code(201).send({ success: true, data: { user: newUser, token } });
    });
    app.post('/login', async (req, reply) => {
        const body = LoginSchema.safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
        const db = (0, database_1.getDb)();
        const { email, password } = body.data;
        const [user] = await db.select().from(database_1.users).where((0, drizzle_orm_1.eq)(database_1.users.email, email.toLowerCase())).limit(1);
        if (!user || !(await bcryptjs_1.default.compare(password, user.passwordHash))) {
            return reply.code(401).send({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
        }
        await db.update(database_1.users).set({ lastActiveAt: new Date() }).where((0, drizzle_orm_1.eq)(database_1.users.id, user.id));
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
//# sourceMappingURL=auth.routes.js.map