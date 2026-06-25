import { FastifyInstance } from 'fastify';
export async function listeningRoutes(app: FastifyInstance) {
  app.addHook('preHandler', (app as any).authenticate);
  app.post('/generate', async (req, reply) => reply.code(202).send({ success: true, data: { status: 'generating', message: 'Listening generation queued' } }));
  app.get('/content/:jobId', async (req, reply) => reply.send({ success: true, data: { status: 'pending' } }));
  app.get('/audio/:audioId', async (req, reply) => reply.send({ success: true, data: { audioUrl: '#' } }));
  app.post('/sessions/:audioId/answers', async (req, reply) => reply.send({ success: true, data: { message: 'Answers submitted' } }));
}

