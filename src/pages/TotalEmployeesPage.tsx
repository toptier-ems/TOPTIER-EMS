import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { POSITION_LABELS, PRESENCE_STATUS_LABELS, EMPLOYEE_BADGE_LABELS, DEPARTMENT_LABELS } from '../types/database';
import type { AppRole, PresenceStatus, EmployeeBadge, Department } from '../types/database';
import type { Profile } from '../types/database';
import { Search, Trash2, Users, UserCheck, UserX, Plane, Calendar } from 'lucide-react';
import { format, isWithinInterval, parseISO } from 'date-fns';

const ALLOWED_ROLES: AppRole[] = ['ceo', 'executive', 'hr'];
const BADGE_OPTIONS: EmployeeBadge[] = ['best_employee', 'best_teacher', 'rising_star', 'no_absences', 'no_lates', 'most_improved'];
const DEPARTMENT_OPTIONS: Department[] = ['executive', 'admin', 'it', 'esl'];

function getPositionLabel(position: string | undefined): string {
  if (!position) return '—';
  const label = (POSITION_LABELS as Record<string, string>)[position];
  return label ?? position;
}

function getEffectiveStatus(
  p: Profile,
  restDayUserIds: Set<string>,
  onLeaveUserIds: Set<string>
): PresenceStatus {
  if (restDayUserIds.has(p.id)) return 'rest_day';
  if (onLeaveUserIds.has(p.id)) return 'on_leave';
  const s = p.presence_status as PresenceStatus | undefined;
  return s && ['present', 'absent', 'on_leave', 'rest_day'].includes(s) ? s : 'absent';
}

function getPresenceLabel(status: PresenceStatus): string {
  return PRESENCE_STATUS_LABELS[status];
}

export default function TotalEmployeesPage() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restDayUserIds, setRestDayUserIds] = useState<Set<string>>(new Set());
  const [onLeaveUserIds, setOnLeaveUserIds] = useState<Set<string>>(new Set());

  const canAccess = profile && ALLOWED_ROLES.includes(profile.position as AppRole);
  const canAssignBadge = profile && (profile.position === 'ceo' || profile.position === 'hr');
  const canAssignDepartment = canAccess; // CEO, Executive, HR assign department

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayDate = new Date();
    (async () => {
      const [profRes, restRes, plannedRes, leaveRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('approval_status', 'approved').order('full_name'),
        supabase.from('profile_rest_days').select('user_id').eq('rest_date', todayStr),
        supabase.from('profile_planned_leave').select('user_id, start_date, end_date'),
        supabase.from('leave_requests').select('user_id, start_date, end_date').eq('status', 'approved'),
      ]);
      if (cancelled) return;
      const list = ((profRes.data ?? []) as Profile[]).filter((p) => p.deleted_at == null);
      setEmployees(profRes.error ? [] : list);

      const restIds = new Set((restRes.data ?? []).map((r: { user_id: string }) => r.user_id));
      const onLeaveIds = new Set<string>();
      (plannedRes.data ?? []).forEach((p: { user_id: string; start_date: string; end_date: string }) => {
        if (isWithinInterval(todayDate, { start: parseISO(p.start_date), end: parseISO(p.end_date) })) onLeaveIds.add(p.user_id);
      });
      (leaveRes.data ?? []).forEach((l: { user_id: string; start_date: string; end_date: string }) => {
        if (isWithinInterval(todayDate, { start: parseISO(l.start_date), end: parseISO(l.end_date) })) onLeaveIds.add(l.user_id);
      });
      setRestDayUserIds(restIds);
      setOnLeaveUserIds(onLeaveIds);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [canAccess]);

  const filtered = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase().trim();
    return employees.filter(
      (e) =>
        e.full_name?.toLowerCase().includes(q) ||
        (e.email && e.email.toLowerCase().includes(q)) ||
        (e.contact_number && e.contact_number.includes(q)) ||
        (e.address && e.address.toLowerCase().includes(q)) ||
        getPositionLabel(e.position).toLowerCase().includes(q) ||
        (e.department && DEPARTMENT_LABELS[e.department as Department]?.toLowerCase().includes(q))
    );
  }, [employees, search]);

  const deleteEmployee = async (id: string) => {
    if (!confirm('Remove this employee from the list? They will be hidden from Total Employees.')) return;
    setDeletingId(id);
    try {
      await supabase.from('profiles').update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
      setEmployees((prev) => prev.filter((e) => e.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  if (!canAccess) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Total Employees</h1>
        <p className="text-gray-600">Only CEO, Executive, and HR can access this page.</p>
      </div>
    );
  }

  const totalCount = employees.length;
  const byPosition = employees.reduce<Record<string, number>>((acc, e) => {
    const label = getPositionLabel(e.position);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const presentCount = employees.filter((e) => getEffectiveStatus(e, restDayUserIds, onLeaveUserIds) === 'present').length;
  const absentCount = employees.filter((e) => getEffectiveStatus(e, restDayUserIds, onLeaveUserIds) === 'absent').length;
  const onLeaveCount = employees.filter((e) => getEffectiveStatus(e, restDayUserIds, onLeaveUserIds) === 'on_leave').length;
  const restDayCount = employees.filter((e) => getEffectiveStatus(e, restDayUserIds, onLeaveUserIds) === 'rest_day').length;

  return (
    <div className="min-w-0">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Total Employees</h1>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-card p-3 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-lg bg-toptier-primary/10 text-toptier-primary flex-shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Total Employees</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-card p-3 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-lg bg-green-100 text-green-700 flex-shrink-0">
              <UserCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Present</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{presentCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-card p-3 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-lg bg-amber-100 text-amber-700 flex-shrink-0">
              <UserX className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Absent</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{absentCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-card p-3 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-lg bg-sky-100 text-sky-700 flex-shrink-0">
              <Plane className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">On Leave</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{onLeaveCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-card p-3 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-lg bg-violet-100 text-violet-700 flex-shrink-0">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Rest Day</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{restDayCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-500 mb-2">By Position</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(byPosition)
            .sort((a, b) => b[1] - a[1])
            .map(([label, count]) => (
              <span
                key={label}
                className="px-3 py-1 rounded-full bg-toptier-primary/10 text-toptier-primary text-sm font-medium"
              >
                {label}: {count}
              </span>
            ))}
          {Object.keys(byPosition).length === 0 && (
            <span className="text-gray-500 text-sm">No data</span>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-0 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, contact, address, position, department..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {search.trim() ? 'No employees match your search.' : 'No employees yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full text-left min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-900 text-sm">Name</th>
                  <th className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-900 text-sm">Position</th>
                  <th className="py-3 px-4 font-semibold text-gray-900">Department</th>
                  <th className="py-3 px-4 font-semibold text-gray-900">Title</th>
                  <th className="py-3 px-4 font-semibold text-gray-900">Status</th>
                  <th className="py-3 px-4 font-semibold text-gray-900">Contact Number</th>
                  <th className="py-3 px-4 font-semibold text-gray-900">Address</th>
                  <th className="py-3 px-4 font-semibold text-gray-900 w-20">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => {
                  const effectiveStatus = getEffectiveStatus(emp, restDayUserIds, onLeaveUserIds);
                  return (
                  <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-medium text-gray-900">{emp.full_name}</td>
                    <td className="py-3 px-4 text-gray-700">{getPositionLabel(emp.position)}</td>
                    <td className="py-3 px-4">
                      {canAssignDepartment ? (
                        <select
                          value={emp.department ?? ''}
                          onChange={async (e) => {
                            const val = e.target.value as Department | '';
                            await supabase.from('profiles').update({ department: val || null, updated_at: new Date().toISOString() }).eq('id', emp.id);
                            setEmployees((prev) => prev.map((p) => (p.id === emp.id ? { ...p, department: val || undefined } : p)));
                          }}
                          className="text-sm rounded border border-gray-200 text-gray-900 bg-white py-1 px-2"
                        >
                          <option value="">—</option>
                          {DEPARTMENT_OPTIONS.map((d) => (
                            <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-700 text-sm">{emp.department ? DEPARTMENT_LABELS[emp.department as Department] : '—'}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {canAssignBadge ? (
                        <select
                          value={emp.employee_badge ?? ''}
                          onChange={async (e) => {
                            const val = e.target.value as EmployeeBadge | '';
                            await supabase.from('profiles').update({ employee_badge: val || null, updated_at: new Date().toISOString() }).eq('id', emp.id);
                            setEmployees((prev) => prev.map((p) => (p.id === emp.id ? { ...p, employee_badge: val || undefined } : p)));
                          }}
                          className="text-sm rounded border border-gray-200 text-gray-900 bg-white py-1 px-2"
                        >
                          <option value="">—</option>
                          {BADGE_OPTIONS.map((b) => (
                            <option key={b} value={b}>{EMPLOYEE_BADGE_LABELS[b]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-700 text-sm">{emp.employee_badge ? EMPLOYEE_BADGE_LABELS[emp.employee_badge as EmployeeBadge] : '—'}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          effectiveStatus === 'present'
                            ? 'bg-green-100 text-green-800'
                            : effectiveStatus === 'on_leave'
                              ? 'bg-sky-100 text-sky-800'
                              : effectiveStatus === 'rest_day'
                                ? 'bg-violet-100 text-violet-800'
                                : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {getPresenceLabel(effectiveStatus)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{emp.contact_number || '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{emp.address || '—'}</td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => deleteEmployee(emp.id)}
                        disabled={deletingId === emp.id}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                        title="Delete employee"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
