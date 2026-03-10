import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Users,
  Calendar,
  FileText,
  MessageCircle,
  Settings,
  UserCheck,
  CalendarDays,
  Video,
  UsersRound,
  Briefcase,
  ClipboardList,
  Download,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { format, startOfDay, endOfDay, subDays, parseISO, isSameDay } from 'date-fns';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabase';
import type { AppRole } from '../types/database';
import type { LeaveRequest } from '../types/database';
import type { ActionLog } from '../types/database';
import type { PdEvent } from '../types/database';
import type { Applicant } from '../types/database';
import { LEAVE_TYPE_LABELS } from '../types/database';

type DashboardCard = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  roles: AppRole[];
};

const ALL_ROLES: AppRole[] = ['ceo', 'executive', 'hr', 'manager', 'supervisor', 'tl', 'trainer', 'employee'];

const DASHBOARD_CARDS: DashboardCard[] = [
  { to: '/profile', label: 'My Profile', icon: Users, desc: 'View your profile & accomplishments', roles: ALL_ROLES },
  { to: '/feed', label: 'Feed', icon: MessageCircle, desc: 'Posts, My Day, comment & like', roles: ALL_ROLES },
  { to: '/leave', label: 'Leave', icon: Calendar, desc: 'Request emergency, vacation, or sick leave', roles: ALL_ROLES },
  { to: '/settings', label: 'Settings', icon: Settings, desc: 'Edit your info, avatar, bio', roles: ALL_ROLES },
  { to: '/employees', label: 'Total Employees', icon: UsersRound, desc: 'View all employees and their details', roles: ['ceo', 'executive', 'hr'] },
  { to: '/recruitment', label: 'Recruitment', icon: Briefcase, desc: 'Applicants and hiring pipeline', roles: ['ceo', 'executive', 'manager', 'trainer', 'supervisor', 'hr'] },
  { to: '/leave/requests', label: 'Leave Requests', icon: FileText, desc: 'Review and approve leave requests', roles: ['ceo', 'executive', 'hr', 'manager', 'supervisor', 'tl'] },
  { to: '/leave/allocation', label: 'Leave Allocation', icon: CalendarDays, desc: 'Set vacation, sick, emergency days per year', roles: ['ceo', 'hr'] },
  { to: '/meetings', label: 'Meetings', icon: Video, desc: 'Create and view meetings', roles: ['ceo', 'executive', 'hr', 'manager', 'supervisor', 'tl'] },
  { to: '/employee-approval', label: 'Employee Approval', icon: UserCheck, desc: 'Approve or reject new user accounts', roles: ['ceo', 'hr', 'supervisor'] },
  { to: '/action-log', label: 'Action Log', icon: ClipboardList, desc: 'Recruitment, Leave Request & Allocation activity', roles: ['ceo', 'executive'] },
];

const EXECUTIVE_ROLES: AppRole[] = ['ceo', 'executive'];

type DaySummary = {
  date: string;
  label: string;
  leaveSubmitted: number;
  leaveApproved: number;
  leaveRejected: number;
  employeesApproved: number;
  pdEventsCreated: number;
  applicantsAdded: number;
  applicantsHired: number;
  applicantsFailed: number;
};

type DailyData = {
  leaveRequests: (LeaveRequest & { profiles?: { full_name: string } | null })[];
  employeesApproved: { id: string; full_name: string; approved_at: string }[];
  pdEvents: PdEvent[];
  applicants: Applicant[];
  applicantsHired: Applicant[];
  applicantsFailed: Applicant[];
  actionLogs: (ActionLog & { profiles?: { full_name: string } | null })[];
};

function useExecutiveDashboard(selectedDate: Date) {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<DaySummary[]>([]);
  const [dailyData, setDailyData] = useState<DailyData>({
    leaveRequests: [],
    employeesApproved: [],
    pdEvents: [],
    applicants: [],
    applicantsHired: [],
    applicantsFailed: [],
    actionLogs: [],
  });

  useEffect(() => {
    let cancelled = false;
    const dayStart = startOfDay(selectedDate).toISOString();
    const dayEnd = endOfDay(selectedDate).toISOString();
    const sevenDaysAgo = startOfDay(subDays(selectedDate, 6)).toISOString();

    (async () => {
      setLoading(true);
      try {
        const [
          leaveCreatedRes,
          leaveRespondedRes,
          profilesRes,
          pdRes,
          applicantsRes,
          applicantsHiredFailedRes,
          logsRes,
          leaveWeekRes,
          profilesWeekRes,
          pdWeekRes,
          applicantsWeekRes,
          applicantsHiredFailedWeekRes,
        ] = await Promise.all([
          supabase.from('leave_requests').select('*, profiles!user_id(full_name)').gte('created_at', dayStart).lte('created_at', dayEnd),
          supabase.from('leave_requests').select('*, profiles!user_id(full_name)').not('responded_at', 'is', null).gte('responded_at', dayStart).lte('responded_at', dayEnd),
          supabase.from('profiles').select('id, full_name, approved_at').not('approved_at', 'is', null).gte('approved_at', dayStart).lte('approved_at', dayEnd),
          supabase.from('pd_events').select('*').gte('created_at', dayStart).lte('created_at', dayEnd),
          supabase.from('applicants').select('*').gte('created_at', dayStart).lte('created_at', dayEnd),
          supabase.from('applicants').select('*').in('status', ['hired', 'failed']).gte('updated_at', dayStart).lte('updated_at', dayEnd),
          supabase.from('action_logs').select('*, profiles!user_id(full_name)').gte('created_at', dayStart).lte('created_at', dayEnd).order('created_at', { ascending: false }),
          supabase.from('leave_requests').select('*').gte('created_at', sevenDaysAgo).lte('created_at', endOfDay(selectedDate).toISOString()),
          supabase.from('profiles').select('id, approved_at').not('approved_at', 'is', null).gte('approved_at', sevenDaysAgo).lte('approved_at', endOfDay(selectedDate).toISOString()),
          supabase.from('pd_events').select('created_at').gte('created_at', sevenDaysAgo),
          supabase.from('applicants').select('created_at, updated_at').gte('created_at', sevenDaysAgo),
          supabase.from('applicants').select('status, updated_at').in('status', ['hired', 'failed']).gte('updated_at', sevenDaysAgo).lte('updated_at', endOfDay(selectedDate).toISOString()),
        ]);

        if (cancelled) return;

        const leaveCreated = (leaveCreatedRes.data ?? []) as (LeaveRequest & { profiles?: { full_name: string } | null })[];
        const leaveResponded = (leaveRespondedRes.data ?? []) as (LeaveRequest & { profiles?: { full_name: string } | null })[];
        const leaveRequestsDeduped = Array.from(new Map([...leaveCreated, ...leaveResponded].map((r) => [r.id, r])).values());

        const employeesApproved = (profilesRes.data ?? []).map((p: { id: string; full_name: string; approved_at: string }) => ({
          id: p.id,
          full_name: p.full_name,
          approved_at: p.approved_at,
        }));

        const pdEvents = (pdRes.data ?? []) as PdEvent[];
        const applicants = (applicantsRes.data ?? []) as Applicant[];
        const hiredFailedList = (applicantsHiredFailedRes.data ?? []) as Applicant[];
        const applicantsHired = hiredFailedList.filter((a) => a.status === 'hired');
        const applicantsFailed = hiredFailedList.filter((a) => a.status === 'failed');
        const actionLogs = (logsRes.data ?? []) as (ActionLog & { profiles?: { full_name: string } | null })[];

        setDailyData({
          leaveRequests: leaveRequestsDeduped,
          employeesApproved,
          pdEvents,
          applicants,
          applicantsHired,
          applicantsFailed,
          actionLogs,
        });

        const days: DaySummary[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = subDays(selectedDate, i);
          const ds = startOfDay(d).toISOString();
          const de = endOfDay(d).toISOString();
          days.push({
            date: format(d, 'yyyy-MM-dd'),
            label: format(d, 'EEE d'),
            leaveSubmitted: 0,
            leaveApproved: 0,
            leaveRejected: 0,
            employeesApproved: 0,
            pdEventsCreated: 0,
            applicantsAdded: 0,
            applicantsHired: 0,
            applicantsFailed: 0,
          });
          const dayLeaves = (leaveWeekRes.data ?? []).filter((r: LeaveRequest & { created_at: string; responded_at?: string | null; status: string }) => {
            const createdSame = isSameDay(parseISO(r.created_at), d);
            const respondedSame = r.responded_at ? isSameDay(parseISO(r.responded_at), d) : false;
            return createdSame || respondedSame;
          }) as LeaveRequest[];
          days[days.length - 1].leaveSubmitted = dayLeaves.filter((l) => isSameDay(parseISO(l.created_at), d)).length;
          days[days.length - 1].leaveApproved = dayLeaves.filter((l) => l.status === 'approved' && l.responded_at && isSameDay(parseISO(l.responded_at), d)).length;
          days[days.length - 1].leaveRejected = dayLeaves.filter((l) => l.status === 'rejected' && l.responded_at && isSameDay(parseISO(l.responded_at), d)).length;
          days[days.length - 1].employeesApproved = (profilesWeekRes.data ?? []).filter((p: { approved_at: string }) => isSameDay(parseISO(p.approved_at), d)).length;
          days[days.length - 1].pdEventsCreated = (pdWeekRes.data ?? []).filter((e: { created_at: string }) => isSameDay(parseISO(e.created_at), d)).length;
          days[days.length - 1].applicantsAdded = (applicantsWeekRes.data ?? []).filter((a: { created_at: string }) => isSameDay(parseISO(a.created_at), d)).length;
          const dayHiredFailed = (applicantsHiredFailedWeekRes.data ?? []) as { status: string; updated_at: string }[];
          days[days.length - 1].applicantsHired = dayHiredFailed.filter((a) => a.status === 'hired' && isSameDay(parseISO(a.updated_at), d)).length;
          days[days.length - 1].applicantsFailed = dayHiredFailed.filter((a) => a.status === 'failed' && isSameDay(parseISO(a.updated_at), d)).length;
        }
        setChartData(days);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  return { loading, chartData, dailyData };
}

function generateDailyReport(date: Date, data: DailyData): string {
  const parts: string[] = [];
  const d = format(date, 'MMMM d, yyyy');

  const submitted = data.leaveRequests.filter((r) => isSameDay(parseISO(r.created_at), date)).length;
  const approved = data.leaveRequests.filter((r) => r.status === 'approved' && r.responded_at && isSameDay(parseISO(r.responded_at), date)).length;
  const rejected = data.leaveRequests.filter((r) => r.status === 'rejected' && r.responded_at && isSameDay(parseISO(r.responded_at), date)).length;

  if (submitted > 0 || approved > 0 || rejected > 0) {
    const leaveParts: string[] = [];
    if (submitted > 0) leaveParts.push(`${submitted} leave request(s) submitted`);
    if (approved > 0) leaveParts.push(`${approved} approved`);
    if (rejected > 0) leaveParts.push(`${rejected} rejected`);
    parts.push(`Leave: ${leaveParts.join('; ')}.`);
  }
  if (data.employeesApproved.length > 0) {
    parts.push(`HR approved ${data.employeesApproved.length} new employee(s): ${data.employeesApproved.map((e) => e.full_name).join(', ')}.`);
  }
  if (data.pdEvents.length > 0) {
    parts.push(`${data.pdEvents.length} new Professional Development event(s) created: ${data.pdEvents.map((e) => e.title).join(', ')}.`);
  }
  if (data.applicants.length > 0) {
    parts.push(`${data.applicants.length} new candidate(s) added to recruitment: ${data.applicants.map((a) => a.name).join(', ')}.`);
  }
  if (data.applicantsHired.length > 0) {
    parts.push(`${data.applicantsHired.length} candidate(s) hired: ${data.applicantsHired.map((a) => a.name).join(', ')}.`);
  }
  if (data.applicantsFailed.length > 0) {
    parts.push(`${data.applicantsFailed.length} candidate(s) marked failed: ${data.applicantsFailed.map((a) => a.name).join(', ')}.`);
  }
  if (data.actionLogs.length > 0 && parts.length === 0) {
    parts.push(`Activity: ${data.actionLogs.length} action(s) logged.`);
  }
  if (parts.length === 0) {
    return `On ${d}, no recorded activity for leaves, employee approvals, PD events, candidates, hired, or failed.`;
  }
  return `Daily summary for ${d}: ${parts.join(' ')}`;
}

function ExecutiveDashboard() {
  const { profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const reportRef = useRef<HTMLDivElement>(null);
  const { loading, chartData, dailyData } = useExecutiveDashboard(selectedDate);

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });
    const img = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const contentW = pageW - margin * 2;
    const contentH = pageH - margin * 2;
    const imgW = canvas.width;
    const imgH = canvas.height;
    const ratio = imgW / imgH;
    let drawW = contentW;
    let drawH = contentW / ratio;
    if (drawH > contentH) {
      drawH = contentH;
      drawW = contentH * ratio;
    }
    pdf.addImage(img, 'JPEG', margin, margin, drawW, drawH);
    pdf.save(`Executive_Dashboard_Report_${format(selectedDate, 'yyyy-MM-dd')}.pdf`);
  };

  const reportText = generateDailyReport(selectedDate, dailyData);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Executive Dashboard</h1>
          <p className="text-gray-500 text-sm sm:text-base mt-0.5">Daily summary and activity across the organization</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
            <CalendarIcon className="w-4 h-4" />
            Browse by date
          </label>
          <input
            type="date"
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={(e) => setSelectedDate(parseISO(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-200 text-gray-900 bg-white w-full sm:w-auto min-w-0"
          />
        </div>
      </div>

      <div ref={reportRef} className="space-y-4 sm:space-y-6 bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        {/* Summary cards for selected day */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Summary for {format(selectedDate, 'EEEE, MMMM d, yyyy')}</h2>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              <div className="rounded-lg border border-gray-200 p-3 sm:p-4 bg-amber-50/50">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Leave (submitted)</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900">
                  {dailyData.leaveRequests.filter((r) => isSameDay(parseISO(r.created_at), selectedDate)).length}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 sm:p-4 bg-emerald-50/50">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Leave approved</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900">
                  {dailyData.leaveRequests.filter((r) => r.status === 'approved' && r.responded_at && isSameDay(parseISO(r.responded_at), selectedDate)).length}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 sm:p-4 bg-blue-50/50">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Employees approved</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900">{dailyData.employeesApproved.length}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 sm:p-4 bg-violet-50/50">
                <p className="text-xs sm:text-sm text-gray-600 truncate">New PD events</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900">{dailyData.pdEvents.length}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 sm:p-4 bg-sky-50/50">
                <p className="text-xs sm:text-sm text-gray-600 truncate">New candidates</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900">{dailyData.applicants.length}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 sm:p-4 bg-emerald-50/50">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Hired</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900">{dailyData.applicantsHired.length}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 sm:p-4 bg-red-50/50">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Failed</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900">{dailyData.applicantsFailed.length}</p>
              </div>
            </div>
          )}
        </section>

        {/* Generated report */}
        <section className="pt-4 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Generated report</h2>
          <p className="text-gray-700 leading-relaxed">{reportText}</p>
        </section>

        {/* Charts - last 7 days */}
        <section className="pt-4 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Last 7 days · Activity overview</h2>
          {!loading && chartData.length > 0 && (
            <div className="space-y-4 sm:space-y-6">
              <div className="h-56 sm:h-64 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#6b7280" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                      formatter={(value: number) => [value, '']}
                      labelFormatter={(label) => `Day: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="leaveSubmitted" name="Leave submitted" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="leaveApproved" name="Leave approved" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="employeesApproved" name="Employees approved" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pdEventsCreated" name="PD events" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="applicantsAdded" name="New candidates" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="applicantsHired" name="Hired" fill="#059669" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="applicantsFailed" name="Failed" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-56 sm:h-64 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#6b7280" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                      labelFormatter={(label) => `Day: ${label}`}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="leaveSubmitted" name="Leave submitted" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="leaveApproved" name="Leave approved" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="employeesApproved" name="Employees approved" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="pdEventsCreated" name="PD events" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="applicantsAdded" name="New candidates" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="applicantsHired" name="Hired" stroke="#059669" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="applicantsFailed" name="Failed" stroke="#dc2626" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </section>

        {/* Activity list for selected day */}
        <section className="pt-4 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Activity on this day</h2>
          {loading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : dailyData.actionLogs.length === 0 &&
            dailyData.leaveRequests.length === 0 &&
            dailyData.employeesApproved.length === 0 &&
            dailyData.pdEvents.length === 0 &&
            dailyData.applicants.length === 0 &&
            dailyData.applicantsHired.length === 0 &&
            dailyData.applicantsFailed.length === 0 ? (
            <p className="text-gray-500 text-sm">No activity recorded for this date.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dailyData.leaveRequests.map((r) => (
                <li key={r.id} className="flex flex-wrap gap-x-2 text-gray-700">
                  <span className="font-medium">Leave:</span>
                  {(r as LeaveRequest & { profiles?: { full_name: string } }).profiles?.full_name ?? 'Unknown'} — {LEAVE_TYPE_LABELS[r.leave_type]} — {r.status}
                  {r.responded_at && ` (${format(parseISO(r.responded_at), 'MMM d, HH:mm')})`}
                </li>
              ))}
              {dailyData.employeesApproved.map((e) => (
                <li key={e.id} className="flex flex-wrap gap-x-2 text-gray-700">
                  <span className="font-medium">Employee approved:</span> {e.full_name}
                </li>
              ))}
              {dailyData.pdEvents.map((e) => (
                <li key={e.id} className="flex flex-wrap gap-x-2 text-gray-700">
                  <span className="font-medium">PD event:</span> {e.title}
                </li>
              ))}
              {dailyData.applicants.map((a) => (
                <li key={a.id} className="flex flex-wrap gap-x-2 text-gray-700">
                  <span className="font-medium">Candidate:</span> {a.name} — {a.position_applied_for}
                </li>
              ))}
              {dailyData.applicantsHired.map((a) => (
                <li key={a.id} className="flex flex-wrap gap-x-2 text-gray-700">
                  <span className="font-medium">Hired:</span> {a.name} — {a.position_applied_for}
                </li>
              ))}
              {dailyData.applicantsFailed.map((a) => (
                <li key={a.id} className="flex flex-wrap gap-x-2 text-gray-700">
                  <span className="font-medium">Failed:</span> {a.name} — {a.position_applied_for}
                </li>
              ))}
              {dailyData.actionLogs.map((log) => (
                <li key={log.id} className="flex flex-wrap gap-x-2 text-gray-700">
                  <span className="font-medium">Log:</span> {log.profiles?.full_name ?? '—'} — {log.details ?? log.action_type}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={downloadPDF}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-toptier-primary hover:bg-toptier-primary-hover text-white font-medium"
        >
          <Download className="w-4 h-4" /> Download report as PDF
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const position = profile?.position;
  const isExecutive = position && EXECUTIVE_ROLES.includes(position);
  const cards = DASHBOARD_CARDS.filter((c) => position && c.roles.includes(position));

  if (isExecutive) {
    return <ExecutiveDashboard />;
  }

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-1 sm:mb-2">
        Welcome, {profile?.full_name ?? 'User'}
      </h1>
      <p className="text-gray-500 text-sm sm:text-base mb-6 sm:mb-8">Your hub · Choose a page to get started</p>
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
        {cards.map(({ to, label, icon: Icon, desc }) => (
          <Link
            key={to}
            to={to}
            className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-xl bg-white border border-gray-200 hover:border-toptier-primary/40 hover:shadow-md transition group"
          >
            <div className="p-2.5 rounded-lg bg-toptier-primary/10 text-toptier-primary group-hover:bg-gradient-to-br group-hover:from-toptier-primary/20 group-hover:via-toptier-pumpkin/20 group-hover:to-toptier-amber/20 transition">
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 group-hover:text-toptier-primary transition">{label}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
