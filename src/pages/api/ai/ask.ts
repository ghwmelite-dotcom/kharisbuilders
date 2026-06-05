import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { feature } from '../../../config/church';
import { verifyTurnstile } from '../../../lib/turnstile';
import { workersAi, vectorize } from '../../../lib/ai/clients';
import { getPublishedSermonsByIds } from '../../../lib/db/sermons';
import { answerQuestion } from '../../../lib/ai/ask';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  if (!feature('ai')) return json({ error: 'Not found' }, 404);

  let data: { question?: unknown; 'cf-turnstile-response'?: unknown };
  try {
    data = (await request.json()) as typeof data;
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const question = typeof data.question === 'string' ? data.question.trim() : '';
  if (!question || question.length > 500) {
    return json({ error: 'Please enter a question (up to 500 characters).' }, 400);
  }

  const token = typeof data['cf-turnstile-response'] === 'string' ? data['cf-turnstile-response'] : '';
  const ip = request.headers.get('CF-Connecting-IP') ?? undefined;
  const human = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, token, ip);
  if (!human) return json({ error: 'Could not verify you are human. Please try again.' }, 403);

  try {
    const result = await answerQuestion(
      {
        ai: workersAi(env.AI),
        store: vectorize(env.SERMONS),
        fetchSermons: (ids) => getPublishedSermonsByIds(env.DB, ids),
      },
      question,
    );
    return json(result);
  } catch {
    return json({ answer: 'Sorry — I had trouble answering just now. Please try again in a moment.', citations: [] });
  }
};
