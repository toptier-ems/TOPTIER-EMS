import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { ActionLog } from '../types/database';
import type { AppRole } from '../types/database';
import { format } from 'date-fns';

type ActionLogRow = ActionLog & {
  profiles: { full_name: string } | null;
};

const ALLOWED_ROLES: AppRole[] = ['ceo', 'executive'];

export default function ActionLogPage() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<ActionLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const canAccess = profile && ALLOWED_ROLES.includes(profile.position);

  useEffect(() => {
    if (!canAccess) return;
    (async () => {
      const { data } = await supabase
        .from('action_logs')
        .select('*, profiles!user_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(500);
      setLogs((data as ActionLogRow[]) ?? []);
    })();
    setLoading(false);
  }, [canAccess]);

  if (!canAccess) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Action Log</h1>
        <p className="text-gray-600">Only CEO and Executive can access this page.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Action Log</h1>
      <p className="text-gray-600 text-sm sm:text-base mb-4 sm:mb-6">Activities for Recruitment, Leave Requests, and Leave Allocation.</p>

      <div className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No actions logged yet.</div>
        ) : (
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full text-left min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-3 px-4 font-semibold text-gray-900">Date</th>
                  <th className="py-3 px-4 font-semibold text-gray-900">User</th>
                  <th className="py-3 px-4 font-semibold text-gray-900">Activity</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3 px-4 text-gray-600 text-sm whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">{log.profiles?.full_name ?? '—'}</td>
                    <td className="py-3 px-4 text-gray-700">{log.details ?? log.action_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
