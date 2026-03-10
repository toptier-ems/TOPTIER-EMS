import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LEAVE_TYPE_LABELS } from '../types/database';
import type { LeaveType } from '../types/database';
import type { LeaveAllocation, LeaveRequest } from '../types/database';
import { logAction } from '../lib/actionLog';
import { Calendar, Info, X, Clock, CheckCircle, XCircle, FileText } from 'lucide-react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';

const TYPES: LeaveType[] = ['emergency', 'vacation', 'sick'];
const currentYear = new Date().getFullYear();

function leaveDaysUsed(requests: LeaveRequest[], type: LeaveType): number {
  return requests
    .filter((r) => r.leave_type === type && r.status === 'approved')
    .reduce((sum, r) => sum + differenceInCalendarDays(new Date(r.end_date), new Date(r.start_date)) + 1, 0);
}

export default function LeavePage() {
  const { user } = useAuth();
  const [leaveType, setLeaveType] = useState<LeaveType>('vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [allocation, setAllocation] = useState<LeaveAllocation | null>(null);
  const [approvedRequests, setApprovedRequests] = useState<LeaveRequest[]>([]);
  const [showNoCreditModal, setShowNoCreditModal] = useState(false);
  const [noCreditType, setNoCreditType] = useState<LeaveType | null>(null);
  const [balanceLoaded, setBalanceLoaded] = useState(false);
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const [allocRes, reqRes, allReqRes] = await Promise.all([
        supabase.from('leave_allocations').select('*').eq('user_id', user.id).eq('year', currentYear).maybeSingle(),
        supabase.from('leave_requests').select('*').eq('user_id', user.id).eq('status', 'approved'),
        supabase.from('leave_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);
      setAllocation((allocRes.data as LeaveAllocation) ?? null);
      const list = (reqRes.data ?? []).filter((r: LeaveRequest) => new Date(r.start_date).getFullYear() === currentYear) as LeaveRequest[];
      setApprovedRequests(list);
      setMyRequests((allReqRes.data ?? []) as LeaveRequest[]);
      setBalanceLoaded(true);
    })();
  }, [user?.id]);

  const remainingVacation = allocation ? Math.max(0, allocation.vacation_days - leaveDaysUsed(approvedRequests, 'vacation')) : 0;
  const remainingSick = allocation ? Math.max(0, allocation.sick_days - leaveDaysUsed(approvedRequests, 'sick')) : 0;
  const remainingEmergency = allocation ? Math.max(0, allocation.emergency_days - leaveDaysUsed(approvedRequests, 'emergency')) : 0;

  const canUseVacation = remainingVacation > 0;
  const canUseSick = remainingSick > 0;
  const onlyEmergencyAllowed = !canUseVacation && !canUseSick;
  const effectiveType = leaveType === 'vacation' && !canUseVacation ? 'emergency' : leaveType === 'sick' && !canUseSick ? 'emergency' : leaveType;

  useEffect(() => {
    if (!balanceLoaded || !onlyEmergencyAllowed) return;
    setLeaveType('emergency');
  }, [balanceLoaded, onlyEmergencyAllowed]);

  const handleLeaveTypeChange = (newType: LeaveType) => {
    if (newType === 'vacation' && !canUseVacation) {
      setNoCreditType('vacation');
      setShowNoCreditModal(true);
      setLeaveType('emergency');
      return;
    }
    if (newType === 'sick' && !canUseSick) {
      setNoCreditType('sick');
      setShowNoCreditModal(true);
      setLeaveType('emergency');
      return;
    }
    setLeaveType(newType);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    const typeToUse = leaveType === 'vacation' && !canUseVacation ? 'emergency' : leaveType === 'sick' && !canUseSick ? 'emergency' : leaveType;
    if (typeToUse !== leaveType) {
      setNoCreditType(leaveType);
      setShowNoCreditModal(true);
      setLeaveType('emergency');
      return;
    }
    setMessage('');
    setLoading(true);
    try {
      const { data: inserted, error } = await supabase.from('leave_requests').insert({
        user_id: user.id,
        leave_type: typeToUse,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || null,
      }).select('id').single();
      if (error) throw error;
      const typeLabel = LEAVE_TYPE_LABELS[typeToUse];
      if (inserted?.id) {
        await logAction(user.id, 'leave_request_submit', `Submitted leave request: ${typeLabel} (${startDate} to ${endDate})`, inserted.id);
        const { data: approverProfiles } = await supabase.from('profiles').select('id').in('position', ['ceo', 'executive', 'manager', 'supervisor', 'tl', 'trainer']);
        if (approverProfiles?.length) {
          const notifications = approverProfiles.map((p: { id: string }) => ({
            user_id: p.id,
            type: 'leave_request',
            title: 'New leave request',
            body: `A new ${typeLabel} leave request (${startDate} to ${endDate}) needs review.`,
            reference_id: inserted.id,
            from_user_id: user.id,
          }));
          await supabase.from('notifications').insert(notifications);
        }
      }
      setMessage('Leave request submitted. A TL, Supervisor, HR, or CEO can approve it.');
      setStartDate('');
      setEndDate('');
      setReason('');
      const { data: allReq } = await supabase.from('leave_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setMyRequests((allReq ?? []) as LeaveRequest[]);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Calendar className="w-7 h-7" /> Request Leave
      </h1>

      {(!canUseVacation && !canUseSick) && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex gap-3">
          <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">No vacation or sick leave credit available</p>
            <p className="mt-0.5">Your available vacation and sick leave have been used. You can only file <strong>Emergency leave</strong> until your balance is updated by HR.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 shadow-card p-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Leave type</label>
        <select
          value={effectiveType}
          onChange={(e) => handleLeaveTypeChange(e.target.value as LeaveType)}
          className="w-full px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 mb-4"
        >
          <option value="vacation" disabled={!canUseVacation}>
            {LEAVE_TYPE_LABELS.vacation}{!canUseVacation ? ' (no credit)' : ` (${remainingVacation} left)`}
          </option>
          <option value="sick" disabled={!canUseSick}>
            {LEAVE_TYPE_LABELS.sick}{!canUseSick ? ' (no credit)' : ` (${remainingSick} left)`}
          </option>
          <option value="emergency">{LEAVE_TYPE_LABELS.emergency}</option>
        </select>
        <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
          className="w-full px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 mb-4"
        />
        <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          required
          className="w-full px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 mb-4"
        />
        <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-500 resize-none mb-4"
          placeholder="Brief reason..."
        />
        {message && (
          <p className={`mb-4 text-sm ${message.startsWith('Leave request') ? 'text-green-600' : 'text-red-600'}`}>
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-toptier-primary text-white font-medium hover:bg-toptier-primary-hover disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit request'}
        </button>
      </form>
      <p className="mt-4 text-gray-500 text-sm">
        Approval is done by Team Lead, Supervisor, HR, or CEO.
      </p>

      {/* Request status section */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-toptier-primary" />
          My leave request status
        </h2>
        {myRequests.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-card p-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 text-gray-400 mb-3">
              <Calendar className="w-7 h-7" />
            </div>
            <p className="text-gray-600 font-medium">No leave requests yet</p>
            <p className="text-gray-500 text-sm mt-1">Submit a request above to see its status here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myRequests.map((req) => {
              const isPending = req.status === 'pending';
              const isApproved = req.status === 'approved';
              const isRejected = req.status === 'rejected';
              const statusConfig = isPending
                ? { label: 'Pending', icon: Clock, bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800', iconColor: 'text-amber-600' }
                : isApproved
                  ? { label: 'Approved', icon: CheckCircle, bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-800', iconColor: 'text-green-600' }
                  : { label: 'Rejected', icon: XCircle, bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-800', iconColor: 'text-red-600' };
              const StatusIcon = statusConfig.icon;
              const days = differenceInCalendarDays(parseISO(req.end_date), parseISO(req.start_date)) + 1;
              return (
                <div
                  key={req.id}
                  className={`rounded-xl border shadow-card overflow-hidden transition hover:shadow-md ${statusConfig.bg} ${statusConfig.border}`}
                >
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{LEAVE_TYPE_LABELS[req.leave_type]}</span>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.badge}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm text-gray-600">
                          {format(parseISO(req.start_date), 'MMM d, yyyy')} → {format(parseISO(req.end_date), 'MMM d, yyyy')}
                          <span className="text-gray-500 ml-1">({days} day{days !== 1 ? 's' : ''})</span>
                        </p>
                        {req.reason && (
                          <p className="mt-2 text-sm text-gray-500 line-clamp-2">&quot;{req.reason}&quot;</p>
                        )}
                        {req.responded_at && !isPending && (
                          <p className="mt-2 text-xs text-gray-500">
                            {isApproved ? 'Approved' : 'Rejected'} on {format(parseISO(req.responded_at), 'MMM d, yyyy \'at\' h:mm a')}
                          </p>
                        )}
                      </div>
                      <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${statusConfig.badge} ${statusConfig.iconColor} flex-shrink-0`}>
                        <StatusIcon className="w-6 h-6" />
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200/60 flex items-center justify-between text-xs text-gray-500">
                      <span>Submitted {format(parseISO(req.created_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* No credit info modal */}
      {showNoCreditModal && noCreditType && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={() => setShowNoCreditModal(false)}>
          <div className="bg-white w-full sm:max-w-md max-h-[85dvh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl shadow-modal border border-gray-200 p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-100">
                  <Info className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">No leave credit available</h3>
              </div>
              <button type="button" onClick={() => setShowNoCreditModal(false)} className="p-1 rounded text-gray-500 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Your available <strong>{LEAVE_TYPE_LABELS[noCreditType]}</strong> leave credit has already been used for this year.
              You can only file <strong>Emergency leave</strong> until your balance is updated by CEO or HR.
            </p>
            <p className="text-gray-500 text-xs">Check Settings → Leave balance for your current balance.</p>
            <button
              type="button"
              onClick={() => setShowNoCreditModal(false)}
              className="mt-4 w-full py-2.5 rounded-lg bg-toptier-primary text-white font-medium hover:bg-toptier-primary-hover"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
