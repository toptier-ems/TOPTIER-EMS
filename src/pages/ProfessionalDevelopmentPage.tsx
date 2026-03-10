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
import { Award, Calendar, Plus, Users, X, MapPin, UserPlus, Pencil, Trash2 } from 'lucide-react';

const PD_BANNERS_BUCKET = 'pd-banners';

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
    location: '',
    minParticipants: '',
    maxParticipants: '',
  });
  const [createBannerFile, setCreateBannerFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    duration: '',
    category: 'training' as PdEventCategory,
    scheduledDate: '',
    scheduledTime: '',
    location: '',
    minParticipants: '',
    maxParticipants: '',
  });
  const [editBannerFile, setEditBannerFile] = useState<File | null>(null);

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

  const uploadBanner = async (eventId: string, file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${eventId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(PD_BANNERS_BUCKET).upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from(PD_BANNERS_BUCKET).getPublicUrl(path);
    return data.publicUrl;
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
      const minP = createForm.minParticipants ? parseInt(createForm.minParticipants, 10) : null;
      const maxP = createForm.maxParticipants ? parseInt(createForm.maxParticipants, 10) : null;
      const { data: ev } = await supabase
        .from('pd_events')
        .insert({
          created_by: user.id,
          title: createForm.title.trim(),
          description: createForm.description.trim() || null,
          duration: createForm.duration.trim() || null,
          category: createForm.category,
          scheduled_at: scheduledAt,
          location: createForm.location.trim() || null,
          min_participants: minP,
          max_participants: maxP,
        })
        .select('id')
        .single();
      if (ev?.id) {
        let bannerUrl: string | null = null;
        if (createBannerFile) {
          bannerUrl = await uploadBanner(ev.id, createBannerFile);
          if (bannerUrl) await supabase.from('pd_events').update({ banner_url: bannerUrl, updated_at: new Date().toISOString() }).eq('id', ev.id);
        }
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
      setCreateForm({ title: '', description: '', duration: '', category: 'training', scheduledDate: '', scheduledTime: '', location: '', minParticipants: '', maxParticipants: '' });
      setCreateBannerFile(null);
      setShowCreate(false);
      await fetchData();
    } finally {
      setSaving(false);
    }
  };

  const openEditEvent = (event: EventRow) => {
    setEditingEventId(event.id);
    setEditForm({
      title: event.title,
      description: event.description ?? '',
      duration: event.duration ?? '',
      category: event.category,
      scheduledDate: event.scheduled_at ? event.scheduled_at.slice(0, 10) : '',
      scheduledTime: event.scheduled_at ? event.scheduled_at.slice(11, 16) : '',
      location: event.location ?? '',
      minParticipants: event.min_participants != null ? String(event.min_participants) : '',
      maxParticipants: event.max_participants != null ? String(event.max_participants) : '',
    });
    setEditBannerFile(null);
  };

  const saveEditEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEventId || !user?.id) return;
    setSaving(true);
    try {
      const scheduledAt =
        editForm.scheduledDate && editForm.scheduledTime
          ? new Date(`${editForm.scheduledDate}T${editForm.scheduledTime}`).toISOString()
          : null;
      const minP = editForm.minParticipants ? parseInt(editForm.minParticipants, 10) : null;
      const maxP = editForm.maxParticipants ? parseInt(editForm.maxParticipants, 10) : null;
      let bannerUrl: string | null | undefined = undefined;
      if (editBannerFile) {
        const url = await uploadBanner(editingEventId, editBannerFile);
        if (url) bannerUrl = url;
      }
      await supabase
        .from('pd_events')
        .update({
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          duration: editForm.duration.trim() || null,
          category: editForm.category,
          scheduled_at: scheduledAt,
          location: editForm.location.trim() || null,
          min_participants: minP,
          max_participants: maxP,
          ...(bannerUrl !== undefined && { banner_url: bannerUrl }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingEventId)
        .eq('created_by', user.id);
      setEditingEventId(null);
      setEditBannerFile(null);
      await fetchData();
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Delete this event? All participant responses will be removed.')) return;
    if (!user?.id) return;
    setSaving(true);
    try {
      await supabase.from('pd_events').delete().eq('id', eventId).eq('created_by', user.id);
      setEditingEventId((id) => (id === eventId ? null : id));
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Location (optional)</label>
              <input
                value={createForm.location}
                onChange={(e) => setCreateForm((f) => ({ ...f, location: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-900"
                placeholder="e.g. Conference Room A, Zoom"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min participants (optional)</label>
                <input
                  type="number"
                  min={0}
                  value={createForm.minParticipants}
                  onChange={(e) => setCreateForm((f) => ({ ...f, minParticipants: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-900"
                  placeholder="e.g. 5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max participants (optional)</label>
                <input
                  type="number"
                  min={0}
                  value={createForm.maxParticipants}
                  onChange={(e) => setCreateForm((f) => ({ ...f, maxParticipants: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-900"
                  placeholder="e.g. 30"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banner / image (optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCreateBannerFile(e.target.files?.[0] ?? null)}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-900 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-toptier-primary/10 file:text-toptier-primary"
              />
              {createBannerFile && <p className="text-xs text-gray-500 mt-1">{createBannerFile.name}</p>}
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

      {editingEventId && (() => {
        const event = events.find((e) => e.id === editingEventId);
        if (!event) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={() => setEditingEventId(null)}>
            <div className="bg-white w-full sm:max-w-lg max-h-[85dvh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl shadow-modal border border-gray-200 p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Edit event</h2>
                <button type="button" onClick={() => setEditingEventId(null)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={saveEditEvent} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    value={editForm.title}
                    onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                    required
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value as PdEventCategory }))}
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
                      value={editForm.scheduledDate}
                      onChange={(e) => setEditForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                    <input
                      type="time"
                      value={editForm.scheduledTime}
                      onChange={(e) => setEditForm((f) => ({ ...f, scheduledTime: e.target.value }))}
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location (optional)</label>
                  <input
                    value={editForm.location}
                    onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-900"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min participants</label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.minParticipants}
                      onChange={(e) => setEditForm((f) => ({ ...f, minParticipants: e.target.value }))}
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max participants</label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.maxParticipants}
                      onChange={(e) => setEditForm((f) => ({ ...f, maxParticipants: e.target.value }))}
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Banner / image</label>
                  {event.banner_url && !editBannerFile && (
                    <div className="mb-2">
                      <img src={event.banner_url} alt="" className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                      <p className="text-xs text-gray-500 mt-0.5">Current banner. Choose a new file to replace.</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditBannerFile(e.target.files?.[0] ?? null)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-900 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-toptier-primary/10 file:text-toptier-primary"
                  />
                  {editBannerFile && <p className="text-xs text-gray-500 mt-1">{editBannerFile.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (optional)</label>
                  <input
                    value={editForm.duration}
                    onChange={(e) => setEditForm((f) => ({ ...f, duration: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-900 resize-none"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={saving || !editForm.title.trim()} className="px-4 py-2 rounded-lg bg-toptier-primary text-white font-medium disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                  <button type="button" onClick={() => setEditingEventId(null)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

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
                {event.banner_url && (
                  <div className="w-full h-40 sm:h-48 bg-gray-100 overflow-hidden">
                    <img src={event.banner_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
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
                          <Calendar className="w-4 h-4 text-toptier-primary flex-shrink-0" />
                          {format(new Date(event.scheduled_at), 'EEEE, MMM d, yyyy')} at {format(new Date(event.scheduled_at), 'h:mm a')}
                        </p>
                      )}
                      {event.location && (
                        <p className="text-sm text-gray-600 mt-1 flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          {event.location}
                        </p>
                      )}
                      {(event.min_participants != null || event.max_participants != null) && (
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                          <UserPlus className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          {event.min_participants != null && event.max_participants != null
                            ? `${event.min_participants}–${event.max_participants} participants`
                            : event.max_participants != null
                              ? `Up to ${event.max_participants} participants`
                              : `Min ${event.min_participants} participants`}
                        </p>
                      )}
                      {event.duration && <p className="text-sm text-gray-500">Duration: {event.duration}</p>}
                      {event.description && <p className="text-sm text-gray-600 mt-2">{event.description}</p>}
                      <p className="text-xs text-gray-400 mt-2">Created {format(new Date(event.created_at), 'MMM d, yyyy')}</p>
                    </div>
                    {isCreator && isMyEvent && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditEvent(event)}
                          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-toptier-primary"
                          title="Edit event"
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEvent(event.id)}
                          disabled={saving}
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                          title="Delete event"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    )}
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
