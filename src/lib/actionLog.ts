import { supabase } from './supabase';

export async function logAction(
  userId: string,
  actionType: string,
  details: string,
  referenceId?: string | null
): Promise<void> {
  await supabase.from('action_logs').insert({
    user_id: userId,
    action_type: actionType,
    details,
    reference_id: referenceId ?? null,
  });
}
