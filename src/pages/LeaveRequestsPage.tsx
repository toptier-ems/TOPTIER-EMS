import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LEAVE_TYPE_LABELS, POSITION_LABELS } from '../types/database';
import type { LeaveRequest } from '../types/database';
import { logAction } from '../lib/actionLog';
import { format } from 'date-fns';
import { Check, X } from 'lucide-react';

const ACCEPTOR_ROLES = ['ceo', 'executive', 'hr', 'manager', 'supervisor', 'tl'];

export default function LeaveRequestsPage() {
  const { user, profile } = useAuth();
  type RequestRow = LeaveRequest & {
    profiles: { full_name: string } | null;
    acceptor: { full_name: string } | null;
  };
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const canAccept = profile && ACCEPTOR_ROLES.includes(profile.position);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('leave_requests')
        .select('*, profiles!user_id(full_name), acceptor:profiles!accepted_by(full_name)')
        .order('created_at', { ascending: false });
      setRequests((data as RequestRow[]) ?? []);
    })();
    setLoading(false);
  }, []);

  const respond = async (id: string, status: 'approved' | 'rejected') => {
    if (!user?.id || !canAccept) return;
    const req = requests.find((r) => r.id === id);
    await supabase
      .from('leave_requests')
      .update({
        status,
        accepted_by: user.id,
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status, accepted_by: user.id, responded_at: new Date().toISOString(), acceptor: { full_name: profile?.full_name ?? 'You' } } : r
      )
    );
    if (req) {
      const name = req.profiles?.full_name ?? 'Unknown';
      const type = LEAVE_TYPE_LABELS[req.leave_type];
      await logAction(user.id, 'leave_request_respond', `${status === 'approved' ? 'Approved' : 'Rejected'} leave request for ${name} (${type})`, id);
      if (status === 'approved' && req.user_id) {
        await supabase.from('notifications').insert({
          user_id: req.user_id,
          type: 'leave_approved',
          title: 'Leave approved',
          body: `Your ${type} leave request has been approved.`,
          reference_id: id,
          from_user_id: user.id,
        });
      }
    }
  };

  if (!canAccept) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Leave Requests</h1>
        <p className="text-gray-600">Only CEO, Executive, HR, Manager, Supervisor, and Team Lead can approve leave requests.</p>
        <p className="text-gray-600 mt-2">Your position: {profile ? POSITION_LABELS[profile.position] : '—'}.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Leave Requests</h1>
      {loading ? (
        <p className="text-gray-600">Loading...</p>
      ) : requests.length === 0 ? (
        <p className="text-gray-600">No leave requests yet.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-lg border border-gray-200 shadow-card p-4 flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <p className="font-medium text-gray-900">{r.profiles?.full_name ?? 'Unknown'}</p>
                <p className="text-sm text-toptier-muted">{LEAVE_TYPE_LABELS[r.leave_type]}</p>
                <p className="text-sm text-gray-600">
                  {format(new Date(r.start_date), 'MMM d, yyyy')} – {format(new Date(r.end_date), 'MMM d, yyyy')}
                </p>
                {r.reason && <p className="text-sm text-gray-600 mt-1">{r.reason}</p>}
                {r.status !== 'pending' && r.acceptor?.full_name && (
                  <p className="text-xs text-gray-500 mt-1">
                    {r.status === 'approved' ? 'Approved' : 'Rejected'} by {r.acceptor.full_name}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 rounded text-sm ${
                    r.status === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : r.status === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {r.status}
                </span>
                {r.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={() => respond(r.id, 'approved')}
                      className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
                      title="Approve"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => respond(r.id, 'rejected')}
                      className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                      title="Reject"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
