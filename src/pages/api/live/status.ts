import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { getAllSettings } from '../../../lib/db/settings';
import { getAllContent } from '../../../lib/db/content';
import { makeContent } from '../../../lib/content/content';
import { computeLiveStatus, type ScheduleEntry } from '../../../lib/live/status';
import { CHURCH } from '../../../config/church';

export const GET: APIRoute = async () => {
  const json = (b: unknown) =>
    new Response(JSON.stringify(b), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  try {
    const [settings, content] = await Promise.all([getAllSettings(env.DB), getAllContent(env.DB)]);
    const c = makeContent(content);
    let schedule: ScheduleEntry[] = [];
    try {
      const parsed = JSON.parse(c('home.gathering_schedule'));
      if (Array.isArray(parsed)) schedule = parsed;
    } catch {
      schedule = [];
    }
    const status = computeLiveStatus(
      schedule,
      Number(settings.live_duration_min ?? 90) || 90,
      settings.live_state ?? 'auto',
      Number(settings.live_tz_offset_min ?? CHURCH.timezoneOffsetMin) || CHURCH.timezoneOffsetMin,
      new Date(),
    );
    return json(status);
  } catch {
    return json({ isLive: false });
  }
};
