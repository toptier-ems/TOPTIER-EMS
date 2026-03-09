import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Profile, LeaveRequest } from '../types/database';
import { LEAVE_TYPE_LABELS } from '../types/database';
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  format,
  parseISO,
  isSameMonth,
  isSameDay,
  isToday,
  addDays,
  getMonth,
  getYear,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plane, Coffee, Cake } from 'lucide-react';

const CALENDAR_ROLES = ['ceo', 'executive', 'hr', 'manager', 'supervisor', 'tl'] as const;

type CalendarEventType = 'leave' | 'rest' | 'planned' | 'birthday';

interface DayEvent {
  type: CalendarEventType;
  label: string;
  userId: string;
  userName: string;
  extra?: string;
}

export default function TeamCalendarPage() {
  const { profile } = useAuth();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [restDays, setRestDays] = useState<{ user_id: string; rest_date: string }[]>([]);
  const [plannedLeave, setPlannedLeave] = useState<{ user_id: string; start_date: string; end_date: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLeave, setShowLeave] = useState(true);
  const [showRest, setShowRest] = useState(true);
  const [showPlanned, setShowPlanned] = useState(true);
  const [showBirthdays, setShowBirthdays] = useState(true);

  const canAccess = profile && CALENDAR_ROLES.includes(profile.position as (typeof CALENDAR_ROLES)[number]);

  useEffect(() => {
    if (!canAccess) return;
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const startStr = format(monthStart, 'yyyy-MM-dd');
    const endStr = format(monthEnd, 'yyyy-MM-dd');
    let cancelled = false;
    (async () => {
      const [profRes, leaveRes, restRes, plannedRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, birth_date').eq('approval_status', 'approved').is('deleted_at', null).order('full_name'),
        supabase.from('leave_requests').select('id, user_id, leave_type, start_date, end_date').eq('status', 'approved').lte('start_date', endStr).gte('end_date', startStr),
        supabase.from('profile_rest_days').select('user_id, rest_date').gte('rest_date', startStr).lte('rest_date', endStr),
        supabase.from('profile_planned_leave').select('user_id, start_date, end_date').lte('start_date', endStr).gte('end_date', startStr),
      ]);
      if (cancelled) return;
      setProfiles((profRes.data ?? []) as Profile[]);
      setLeaveRequests((leaveRes.data ?? []) as LeaveRequest[]);
      setRestDays((restRes.data ?? []) as { user_id: string; rest_date: string }[]);
      setPlannedLeave((plannedRes.data ?? []) as { user_id: string; start_date: string; end_date: string }[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [canAccess, viewDate]);

  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach((p) => { m[p.id] = p; });
    return m;
  }, [profiles]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, DayEvent[]> = {};
    const add = (dateStr: string, ev: DayEvent) => {
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(ev);
    };

    if (showLeave) {
      leaveRequests.forEach((lr) => {
        const start = parseISO(lr.start_date);
        const end = parseISO(lr.end_date);
        const name = profileMap[lr.user_id]?.full_name ?? 'Unknown';
        const typeLabel = LEAVE_TYPE_LABELS[lr.leave_type as keyof typeof LEAVE_TYPE_LABELS] ?? lr.leave_type;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          add(format(d, 'yyyy-MM-dd'), { type: 'leave', label: name, userId: lr.user_id, userName: name, extra: typeLabel });
        }
      });
    }

    if (showRest) {
      restDays.forEach((r) => {
        const name = profileMap[r.user_id]?.full_name ?? 'Unknown';
        add(r.rest_date, { type: 'rest', label: name, userId: r.user_id, userName: name });
      });
    }

    if (showPlanned) {
      plannedLeave.forEach((pl) => {
        const start = parseISO(pl.start_date);
        const end = parseISO(pl.end_date);
        const name = profileMap[pl.user_id]?.full_name ?? 'Unknown';
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = format(d, 'yyyy-MM-dd');
          const monthStart = startOfMonth(viewDate);
          const monthEnd = endOfMonth(viewDate);
          if (d >= monthStart && d <= monthEnd) {
            add(dateStr, { type: 'planned', label: name, userId: pl.user_id, userName: name, extra: 'Planned leave' });
          }
        }
      });
    }

    if (showBirthdays) {
      const viewMonth = getMonth(viewDate);
      const viewYear = getYear(viewDate);
      profiles.forEach((p) => {
        if (!p.birth_date) return;
        const bd = parseISO(p.birth_date);
        const thisYearBd = new Date(viewYear, getMonth(bd), bd.getDate());
        if (getMonth(thisYearBd) !== viewMonth) return;
        const dateStr = format(thisYearBd, 'yyyy-MM-dd');
        add(dateStr, { type: 'birthday', label: p.full_name, userId: p.id, userName: p.full_name });
      });
    }

    return map;
  }, [profiles, leaveRequests, restDays, plannedLeave, showLeave, showRest, showPlanned, showBirthdays, viewDate, profileMap]);

  const calendarGrid = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 0 });
    const days: Date[] = [];
    let d = new Date(start);
    while (d <= end) {
      days.push(new Date(d));
      d = addDays(d, 1);
    }
    return days;
  }, [viewDate]);

  const goToday = () => setViewDate(new Date());

  if (!canAccess) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Team Calendar</h1>
        <p className="text-gray-600">Only CEO, Manager, Supervisor, HR, TL, and Executive can access this page.</p>
      </div>
    );
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarIcon className="w-7 h-7 text-toptier-primary" />
          Team Calendar
        </h1>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Sidebar - Google Calendar style */}
        <aside className="w-56 flex-shrink-0 flex flex-col gap-4">
          <button
            type="button"
            onClick={goToday}
            className="w-full py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
          >
            Today
          </button>
          <div className="bg-white rounded-xl border border-gray-200 shadow-card p-3">
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={() => setViewDate((d) => subMonths(d, 1))} className="p-1 rounded hover:bg-gray-100">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <span className="text-sm font-medium text-gray-700">{format(viewDate, 'MMM yyyy')}</span>
              <button type="button" onClick={() => setViewDate((d) => addMonths(d, 1))} className="p-1 rounded hover:bg-gray-100">
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-gray-500">
              {weekDays.map((d) => (
                <span key={d}>{d.charAt(0)}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5 mt-1">
              {calendarGrid.slice(0, 42).map((day, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setViewDate(new Date(day))}
                  className={`h-7 rounded text-xs ${
                    !isSameMonth(day, viewDate) ? 'text-gray-300' : isToday(day) ? 'bg-toptier-primary text-white font-medium' : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {format(day, 'd')}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-card p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Show on calendar</p>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input type="checkbox" checked={showLeave} onChange={(e) => setShowLeave(e.target.checked)} className="rounded border-gray-300 text-toptier-primary focus:ring-toptier-primary" />
              <span className="text-sm text-gray-700">Approved leave</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input type="checkbox" checked={showRest} onChange={(e) => setShowRest(e.target.checked)} className="rounded border-gray-300 text-toptier-primary focus:ring-toptier-primary" />
              <span className="text-sm text-gray-700">Rest day</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input type="checkbox" checked={showPlanned} onChange={(e) => setShowPlanned(e.target.checked)} className="rounded border-gray-300 text-toptier-primary focus:ring-toptier-primary" />
              <span className="text-sm text-gray-700">Planned leave</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showBirthdays} onChange={(e) => setShowBirthdays(e.target.checked)} className="rounded border-gray-300 text-toptier-primary focus:ring-toptier-primary" />
              <span className="text-sm text-gray-700">Birthdays</span>
            </label>
          </div>
        </aside>

        {/* Main calendar */}
        <div className="flex-1 min-w-0 flex flex-col bg-white rounded-xl border border-gray-200 shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50/80">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setViewDate((d) => subMonths(d, 1))} className="p-2 rounded-lg hover:bg-gray-200">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <button type="button" onClick={() => setViewDate((d) => addMonths(d, 1))} className="p-2 rounded-lg hover:bg-gray-200">
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
              <button type="button" onClick={goToday} className="ml-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200">
                Today
              </button>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{format(viewDate, 'MMMM yyyy')}</h2>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Leave</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Planned</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" /> Rest</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Birthday</span>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">Loading calendar...</div>
          ) : (
            <div className="flex-1 grid grid-rows-[auto_1fr] min-h-0">
              <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/50">
                {weekDays.map((day) => (
                  <div key={day} className="py-2 px-1 text-center text-xs font-semibold text-gray-600">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 grid-rows-5 flex-1 min-h-0 overflow-auto">
                {calendarGrid.map((day, i) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const events = eventsByDay[dateStr] ?? [];
                  const inMonth = isSameMonth(day, viewDate);
                  return (
                    <div
                      key={i}
                      className={`border-b border-r border-gray-100 min-h-[100px] p-1.5 flex flex-col ${!inMonth ? 'bg-gray-50/50' : ''}`}
                    >
                      <div className={`flex justify-end text-sm ${inMonth ? 'text-gray-700' : 'text-gray-400'}`}>
                        <span className={isToday(day) ? 'flex items-center justify-center w-7 h-7 rounded-full bg-toptier-primary text-white font-medium' : ''}>
                          {format(day, 'd')}
                        </span>
                      </div>
                      <div className="mt-1 space-y-0.5 overflow-auto flex-1 min-h-0">
                        {events.slice(0, 5).map((ev, j) => (
                          <div
                            key={j}
                            className={`text-xs px-1.5 py-0.5 rounded truncate ${
                              ev.type === 'leave'
                                ? 'bg-green-100 text-green-800 border-l-2 border-green-500'
                                : ev.type === 'planned'
                                  ? 'bg-amber-50 text-amber-800 border-l-2 border-amber-500'
                                  : ev.type === 'rest'
                                    ? 'bg-gray-100 text-gray-700 border-l-2 border-gray-400'
                                    : 'bg-blue-50 text-blue-800 border-l-2 border-blue-500'
                            }`}
                            title={ev.extra ? `${ev.label} (${ev.extra})` : ev.label}
                          >
                            {ev.type === 'birthday' && <Cake className="w-3 h-3 inline mr-0.5 align-middle" />}
                            {ev.type === 'leave' && <Plane className="w-3 h-3 inline mr-0.5 align-middle" />}
                            {ev.type === 'planned' && <Plane className="w-3 h-3 inline mr-0.5 align-middle" />}
                            {ev.type === 'rest' && <Coffee className="w-3 h-3 inline mr-0.5 align-middle" />}
                            {ev.label}
                          </div>
                        ))}
                        {events.length > 5 && (
                          <div className="text-xs text-gray-500 pl-1">+{events.length - 5} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
