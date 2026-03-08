import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { POSITION_LABELS } from '../types/database';
import type { Profile } from '../types/database';
import { Check, X } from 'lucide-react';

const ALLOWED_ROLES = ['ceo', 'hr', 'supervisor'];

export default function EmployeeApprovalPage() {
  const { user, profile } = useAuth();
  const [pending, setPending] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const canAccess = profile && ALLOWED_ROLES.includes(profile.position);

  useEffect(() => {
    if (!canAccess) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });
      setPending((data as Profile[]) ?? []);
    })();
    setLoading(false);
  }, [canAccess]);

  const approve = async (userId: string) => {
    if (!user?.id) return;
    await supabase
      .from('profiles')
      .update({
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    setPending((prev) => prev.filter((p) => p.id !== userId));
  };

  const reject = async (userId: string) => {
    if (!confirm('Reject this employee? They will not be able to log in until approved.')) return;
    await supabase.from('profiles').update({ approval_status: 'rejected', updated_at: new Date().toISOString() }).eq('id', userId);
    setPending((prev) => prev.filter((p) => p.id !== userId));
  };

  if (!canAccess) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Employee Approval</h1>
        <p className="text-gray-600">Only CEO, HR, and Supervisor can access this page.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Employee Approval</h1>
      <p className="text-gray-600 mb-6">Approve or reject new registrations. Approved employees can log in and use the app.</p>
      {loading ? (
        <p className="text-gray-600">Loading...</p>
      ) : pending.length === 0 ? (
        <p className="text-gray-600">No pending approvals.</p>
      ) : (
        <div className="space-y-4">
          {pending.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-lg border border-gray-200 shadow-card p-4 flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <p className="font-medium text-gray-900">{p.full_name}</p>
                <p className="text-sm text-gray-600">{p.email}</p>
                <p className="text-sm text-toptier-muted">{POSITION_LABELS[p.position]}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => approve(p.id)}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 font-medium"
                >
                  <Check className="w-4 h-4" /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => reject(p.id)}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-medium"
                >
                  <X className="w-4 h-4" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
