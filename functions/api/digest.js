import { query } from '../lib/db.js';
import { json, error } from '../lib/http.js';
import { todayChicago } from '../lib/dates.js';

export async function onRequestGet({ env }) {
  let leads;
  try {
    leads = await query(env, 'leads', {
      select: '*',
      filters: ['archived_at=is.null'],
      order: 'next_followup.asc',
    });
  } catch (e) {
    return error(e.message, 502);
  }

  const today = todayChicago();
  const active = leads.filter((l) => l.stage !== 'contracted' && l.stage !== 'lost');

  const overdue = active.filter((l) => l.next_followup && l.next_followup < today);
  const dueToday = active.filter((l) => l.next_followup === today);

  return json({ overdue, today: dueToday });
}
