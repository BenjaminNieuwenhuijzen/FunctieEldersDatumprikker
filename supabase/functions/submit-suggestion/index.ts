// POST { name, reason?, url?, submittedBy?, captchaToken? } → { ok }.
// Nieuwe suggesties zijn 'pending' en worden pas na moderatie publiek.
import { db, dbError, guard, json, serve, suggestionSchema, z } from '../_shared/common.ts';

const bodySchema = suggestionSchema.extend({
  submittedBy: z.string().trim().max(40).optional().default(''),
  captchaToken: z.string().max(4096).optional(),
});

serve(async (req, raw) => {
  const body = bodySchema.parse(raw);
  const client = db();
  await guard(req, client, {
    action: 'suggestion',
    perIpPerHour: 10,
    globalPerDay: 200,
    captchaToken: body.captchaToken,
  });
  const { error } = await client.rpc('submit_suggestion_tx', {
    p_event_id: null,
    p_name: body.name,
    p_by: body.submittedBy,
    p_reason: body.reason,
    p_url: body.url,
  });
  if (error) throw dbError(error.message);
  return json(req, 201, { ok: true });
});
