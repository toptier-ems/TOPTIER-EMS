import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  PD_EVENT_CATEGORY_LABELS,
  PD_RESPONSE_STATUS_LABELS,
  POSITION_LABELS,
} from '../types/database';
import type { PdEvent, PdResponse, PdEventCategory, PdResponseStatus, Profile } from '../types/database';
import { format } from 'date-fns';
import { Award, Calendar, Plus, Users, X } from 'lucide-react';

const CREATOR_ROLES = ['ceo', 'executive', 'manager', 'supervisor', 'hr', 'trainer'] as const;
const CATEGORIES: PdEventCategory[] = ['seminar', 'training', 'accreditation'];

type EventRow = PdEvent & { creator: Profile | null };
type ResponseRow = PdResponse & { user: Profile | null };

function generateCertificateNumber(): string {
  const y = new Date().getFullYear();
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TDS-PD-${y}-${r}`;
}

export default function ProfessionalDevelopmentPage() {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [responsesByEvent, setResponsesByEvent] = useState<Record<string, ResponseRow[]>>({});
  const [allResponses, setAllResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    duration: '',
    category: 'training' as PdEventCategory,
    scheduledDate: '',
    scheduledTime: '',
  });
  const [saving, setSaving] = useState(false);

  const isCreator = profile && CREATOR_ROLES.includes(profile.position as (typeof CREATOR_ROLES)[number]);

  const fetchData = async () => {
    const [eventsRes, responsesRes] = await Promise.all([
      supabase
        .from('pd_events')
        .select('*, creator:profiles!created_by(id, full_name, position)')
        .order('created_at', { ascending: false }),
      supabase
        .from('pd_responses')
        .select('*, user:profiles!user_id(id, full_name, position)')
        .order('created_at', { ascending: false }),
    ]);
    const eventList = (eventsRes.data as EventRow[]) ?? [];
    const responseList = (responsesRes.data as ResponseRow[]) ?? [];
    setEvents(eventList);
    setAllResponses(responseList);
    const byEvent: Record<string, ResponseRow[]> = {};
    responseList.forEach((r) => {
      if (!byEvent[r.event_id]) byEvent[r.event_id] = [];
      byEvent[r.event_id].push(r);
    });
    setResponsesByEvent(byEvent);
  };

  useEffect(() => {
    (async () => {
      await fetchData();
    })();
    setLoading(false);
  }, []);

  const myResponse = (eventId: string): PdResponseStatus | null => {
    const r = allResponses.find((x) => x.event_id === eventId && x.user_id === user?.id);
    return r ? r.status : null;
  };

  const setResponse = async (eventId: string, status: 'interested' | 'not_attending') => {
    if (!user?.id) return;
    const existing = allResponses.find((x) => x.event_id === eventId && x.user_id === user.id);
    if (existing) {
      await supabase
        .from('pd_responses')
        .update({ status, responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase.from('pd_responses').insert({
        event_id: eventId,
        user_id: user.id,
        status,
        responded_at: new Date().toISOString(),
      });
    }
    await fetchData();
  };

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !isCreator) return;
    setSaving(true);
    try {
      const scheduledAt =
        createForm.scheduledDate && createForm.scheduledTime
          ? new Date(`${createForm.scheduledDate}T${createForm.scheduledTime}`).toISOString()
          : null;
      const { data: ev } = await supabase
        .from('pd_events')
        .insert({
          created_by: user.id,
          title: createForm.title.trim(),
          description: createForm.description.trim() || null,
          duration: createForm.duration.trim() || null,
          category: createForm.category,
          scheduled_at: scheduledAt,
        })
        .select('id')
        .single();
      if (ev?.id) {
        const creatorName = profile?.full_name ?? 'Someone';
        const { data: profilesList } = await supabase.from('profiles').select('id').neq('id', user.id);
        const notifications = (profilesList ?? []).map((p: { id: string }) => ({
          user_id: p.id,
          type: 'pd_event',
          title: `${creatorName} will host a ${PD_EVENT_CATEGORY_LABELS[createForm.category].toLowerCase()} for ${createForm.title.trim()}`,
          body: 'Join now!',
          reference_id: ev.id,
          from_user_id: user.id,
        }));
        if (notifications.length) await supabase.from('notifications').insert(notifications);
      }
      setCreateForm({ title: '', description: '', duration: '', category: 'training', scheduledDate: '', scheduledTime: '' });
      setShowCreate(false);
      await fetchData();
    } finally {
      setSaving(false);
    }
  };

  const markCompleted = async (responseId: string, event: EventRow) => {
    if (!user?.id || !isCreator || event.created_by !== user.id) return;
    const resp = allResponses.find((r) => r.id === responseId);
    if (!resp || resp.status === 'completed') return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const achievedDate = now.slice(0, 10);
      const { data: acc } = await supabase
        .from('accomplishments')
        .insert({
          user_id: resp.user_id,
          title: event.title,
          description: event.description || `Completed ${PD_EVENT_CATEGORY_LABELS[event.category]} offered by Toptier Digital Solutions.`,
          achieved_at: achievedDate,
          source_type: 'pd',
          pd_event_id: event.id,
          pd_response_id: responseId,
        })
        .select('id')
        .single();
      if (acc?.id) {
        const certNumber = generateCertificateNumber();
        await supabase.from('pd_certificates').insert({
          accomplishment_id: acc.id,
          certificate_number: certNumber,
          issued_by: user.id,
        });
      }
      await supabase
        .from('pd_responses')
        .update({
          status: 'completed',
          marked_completed_at: now,
          marked_completed_by: user.id,
          updated_at: now,
        })
        .eq('id', responseId);
      await fetchData();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Award className="w-7 h-7" /> Professional Development
        </h1>
        {isCreator && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-toptier-primary hover:bg-toptier-primary-hover text-white font-medium"
          >
            <Plus className="w-5 h-5" /> Create event
          </button>
        )}
      </div>

      {showCreate && isCreator && (
        <div className="mb-6 p-6 rounded-xl bg-white border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">New seminar / training / accreditation</h2>
            <button type="button" onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={createEvent} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-900"
                placeholder="e.g. Web Development Training"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={createForm.category}
                onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value as PdEventCategory }))}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-900"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{PD_EVENT_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={createForm.scheduledDate}
                  onChange={(e) => setCreateForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={createForm.scheduledTime}
                  onChange={(e) => setCreateForm((f) => ({ ...f, scheduledTime: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (optional)</label>
              <input
                value={createForm.duration}
                onChange={(e) => setCreateForm((f) => ({ ...f, duration: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-900"
                placeholder="e.g. 2 days, 4 hours"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-900 resize-none"
                placeholder="Short description of the program"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving || !createForm.title.trim()} className="px-4 py-2 rounded-lg bg-toptier-primary text-white font-medium disabled:opacity-50">
                {saving ? 'Creating...' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <p className="text-gray-600 text-sm mb-6">
        {isCreator
          ? 'Create seminars, training, or accreditation. See who wants to participate and mark them complete to issue a certificate.'
          : 'See upcoming events and indicate whether you will attend. Completed programs appear on your profile with a certificate.'}
      </p>

      {events.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No events yet.</p>
          {isCreator && <p className="text-sm mt-1">Create one above to notify everyone.</p>}
        </div>
      ) : (
        <ul className="space-y-4">
          {events.map((event) => {
            const responses = responsesByEvent[event.id] ?? [];
            const myStatus = myResponse(event.id);
            const isMyEvent = event.created_by === user?.id;

            return (
              <li key={event.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-medium text-toptier-primary uppercase tracking-wide">
                        {PD_EVENT_CATEGORY_LABELS[event.category]}
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900 mt-0.5">{event.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Hosted by {event.creator?.full_name ?? 'Unknown'}
                        {event.creator?.position && ` · ${POSITION_LABELS[event.creator.position]}`}
                      </p>
                      {event.scheduled_at && (
                        <p className="text-sm font-medium text-gray-700 mt-1 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-toptier-primary" />
                          {format(new Date(event.scheduled_at), 'EEEE, MMM d, yyyy')} at {format(new Date(event.scheduled_at), 'h:mm a')}
                        </p>
                      )}
                      {event.duration && <p className="text-sm text-gray-500">Duration: {event.duration}</p>}
                      {event.description && <p className="text-sm text-gray-600 mt-2">{event.description}</p>}
                      <p className="text-xs text-gray-400 mt-2">Created {format(new Date(event.created_at), 'MMM d, yyyy')}</p>
                    </div>
                    {!isCreator && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setResponse(event.id, 'interested')}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${myStatus === 'interested' ? 'bg-toptier-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          Attend
                        </button>
                        <button
                          type="button"
                          onClick={() => setResponse(event.id, 'not_attending')}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${myStatus === 'not_attending' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          Not attending
                        </button>
                      </div>
                    )}
                  </div>

                  {isCreator && isMyEvent && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-2">
                        <Users className="w-4 h-4" /> Participants ({responses.length})
                      </h4>
                      {responses.length === 0 ? (
                        <p className="text-sm text-gray-500">No responses yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {responses.map((r) => (
                            <li key={r.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                              <div>
                                <span className="font-medium text-gray-900">{r.user?.full_name ?? 'Unknown'}</span>
                                <span className="text-sm text-gray-500 ml-2">{PD_RESPONSE_STATUS_LABELS[r.status]}</span>
                              </div>
                              {r.status === 'interested' && (
                                <button
                                  type="button"
                                  onClick={() => markCompleted(r.id, event)}
                                  disabled={saving}
                                  className="text-sm px-3 py-1 rounded-lg bg-toptier-primary text-white hover:bg-toptier-primary-hover disabled:opacity-50"
                                >
                                  Mark complete
                                </button>
                              )}
                              {r.status === 'completed' && (
                                <span className="text-xs text-green-600 font-medium">Certificate issued</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
