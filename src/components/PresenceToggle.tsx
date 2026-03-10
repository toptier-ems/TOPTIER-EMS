import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { PRESENCE_STATUS_LABELS } from '../types/database';
import type { PresenceStatus } from '../types/database';
import type { ProfilePlannedLeave } from '../types/database';
import type { LeaveRequest } from '../types/database';
import { UserCheck, UserX, Plane, Calendar, CalendarPlus, X } from 'lucide-react';
import { format, isWithinInterval, parseISO } from 'date-fns';

const STATUSES: PresenceStatus[] = ['present', 'absent', 'on_leave', 'rest_day'];
const ICONS: Record<PresenceStatus, React.ComponentType<{ className?: string }>> = {
  present: UserCheck,
  absent: UserX,
  on_leave: Plane,
  rest_day: Calendar,
};

const today = () => format(new Date(), 'yyyy-MM-dd');

function useEffectiveStatus(userId: string | undefined, profile: { presence_status?: string | null } | null) {
  const [restDates, setRestDates] = useState<string[]>([]);
  const [plannedLeave, setPlannedLeave] = useState<ProfilePlannedLeave[]>([]);
  const [approvedLeave, setApprovedLeave] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [restRes, plannedRes, leaveRes] = await Promise.all([
        supabase.from('profile_rest_days').select('rest_date').eq('user_id', userId),
        supabase.from('profile_planned_leave').select('*').eq('user_id', userId),
        supabase.from('leave_requests').select('*').eq('user_id', userId).eq('status', 'approved'),
      ]);
      setRestDates((restRes.data ?? []).map((r: { rest_date: string }) => r.rest_date));
      setPlannedLeave((plannedRes.data ?? []) as ProfilePlannedLeave[]);
      setApprovedLeave((leaveRes.data ?? []) as LeaveRequest[]);
    })();
  }, [userId]);

  const todayDate = new Date();
  const todayStr = today();
  const isRestToday = restDates.includes(todayStr);
  const isOnLeaveToday =
    plannedLeave.some((p) => isWithinInterval(todayDate, { start: parseISO(p.start_date), end: parseISO(p.end_date) })) ||
    approvedLeave.some((l) => isWithinInterval(todayDate, { start: parseISO(l.start_date), end: parseISO(l.end_date) }));

  let effective: PresenceStatus = (profile?.presence_status as PresenceStatus) ?? 'absent';
  if (isRestToday) effective = 'rest_day';
  else if (isOnLeaveToday) effective = 'on_leave';

  return { effective, restDates, setRestDates, plannedLeave, setPlannedLeave };
}

export default function PresenceToggle() {
  const { user, profile, refreshProfile } = useAuth();
  const { effective, restDates, setRestDates, plannedLeave, setPlannedLeave } = useEffectiveStatus(user?.id, profile);
  const [showRestModal, setShowRestModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [restDateToAdd, setRestDateToAdd] = useState('');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');

  const setStatus = async (status: PresenceStatus) => {
    if (!user?.id) return;
    if (status === 'rest_day') {
      setShowRestModal(true);
      return;
    }
    if (status === 'on_leave') {
      setShowLeaveModal(true);
      return;
    }
    await supabase.from('profiles').update({ presence_status: status, updated_at: new Date().toISOString() }).eq('id', user.id);
    await refreshProfile();
  };

  const addRestDay = async () => {
    if (!user?.id || !restDateToAdd) return;
    await supabase.from('profile_rest_days').upsert({ user_id: user.id, rest_date: restDateToAdd }, { onConflict: 'user_id,rest_date' });
    setRestDates((prev) => (prev.includes(restDateToAdd) ? prev : [...prev, restDateToAdd].sort()));
    setRestDateToAdd('');
  };

  const removeRestDay = async (restDate: string) => {
    if (!user?.id) return;
    await supabase.from('profile_rest_days').delete().eq('user_id', user.id).eq('rest_date', restDate);
    setRestDates((prev) => prev.filter((d) => d !== restDate));
  };

  const addPlannedLeave = async () => {
    if (!user?.id || !plannedStart || !plannedEnd || plannedEnd < plannedStart) return;
    await supabase.from('profile_planned_leave').insert({ user_id: user.id, start_date: plannedStart, end_date: plannedEnd });
    const { data } = await supabase.from('profile_planned_leave').select('*').eq('user_id', user.id).order('start_date');
    setPlannedLeave((data ?? []) as ProfilePlannedLeave[]);
    setPlannedStart('');
    setPlannedEnd('');
  };

  const removePlannedLeave = async (id: string) => {
    await supabase.from('profile_planned_leave').delete().eq('id', id);
    setPlannedLeave((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <>
      <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
        {STATUSES.map((status) => {
          const Icon = ICONS[status];
          const isActive = effective === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatus(status)}
              title={PRESENCE_STATUS_LABELS[status]}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition ${
                isActive ? 'bg-white text-toptier-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{PRESENCE_STATUS_LABELS[status]}</span>
            </button>
          );
        })}
      </div>

      {showRestModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={() => setShowRestModal(false)}>
          <div className="bg-white w-full sm:max-w-md max-h-[85dvh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl shadow-modal border border-gray-200 p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Rest days</h3>
              <button type="button" onClick={() => setShowRestModal(false)} className="p-1 rounded text-gray-500 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">On these dates you will be shown as Rest day without toggling.</p>
            <div className="flex gap-2 mb-4">
              <input
                type="date"
                value={restDateToAdd}
                onChange={(e) => setRestDateToAdd(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-gray-900"
              />
              <button type="button" onClick={addRestDay} className="px-3 py-2 rounded-lg bg-toptier-primary text-white text-sm font-medium hover:bg-toptier-primary-hover">
                Add
              </button>
            </div>
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {restDates.sort().map((d) => (
                <li key={d} className="flex items-center justify-between py-1.5 px-2 rounded bg-gray-50">
                  <span className="text-sm text-gray-900">{format(parseISO(d), 'EEE, MMM d, yyyy')}</span>
                  <button type="button" onClick={() => removeRestDay(d)} className="text-red-600 hover:text-red-700 text-sm">
                    Remove
                  </button>
                </li>
              ))}
              {restDates.length === 0 && <li className="text-sm text-gray-500 py-2">No rest days set.</li>}
            </ul>
          </div>
        </div>
      )}

      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={() => setShowLeaveModal(false)}>
          <div className="bg-white w-full sm:max-w-md max-h-[85dvh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl shadow-modal border border-gray-200 p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">On leave (advance)</h3>
              <button type="button" onClick={() => setShowLeaveModal(false)} className="p-1 rounded text-gray-500 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Set date ranges so you appear On leave without opening the app. Approved leave requests also count.</p>
            <div className="flex gap-2 mb-2">
              <input
                type="date"
                value={plannedStart}
                onChange={(e) => setPlannedStart(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-gray-900"
                placeholder="Start"
              />
              <input
                type="date"
                value={plannedEnd}
                onChange={(e) => setPlannedEnd(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-gray-900"
                placeholder="End"
              />
            </div>
            <button type="button" onClick={addPlannedLeave} className="mb-4 px-3 py-2 rounded-lg bg-toptier-primary text-white text-sm font-medium hover:bg-toptier-primary-hover">
              <CalendarPlus className="w-4 h-4 inline mr-1" /> Add range
            </button>
            <ul className="space-y-1 max-h-40 overflow-y-auto">
              {plannedLeave.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-gray-50 text-sm">
                  <span className="text-gray-900">
                    {format(parseISO(p.start_date), 'MMM d')} – {format(parseISO(p.end_date), 'MMM d, yyyy')}
                  </span>
                  <button type="button" onClick={() => removePlannedLeave(p.id)} className="text-red-600 hover:text-red-700">
                    Remove
                  </button>
                </li>
              ))}
              {plannedLeave.length === 0 && <li className="text-gray-500 py-2">No planned leave ranges.</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
