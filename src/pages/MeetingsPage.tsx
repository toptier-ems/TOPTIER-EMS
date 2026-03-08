import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Meeting } from '../types/database';
import { format, parseISO } from 'date-fns';
import { Plus, Trash2, X } from 'lucide-react';

export default function MeetingsPage() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: '',
    start_at: '',
    end_at: '',
    description: '',
  });

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user.id)
        .order('start_at', { ascending: true });
      setMeetings((data as Meeting[]) ?? []);
    })();
    setLoading(false);
  }, [user?.id]);

  const createMeeting = async () => {
    if (!user?.id || !form.title.trim() || !form.start_at || !form.end_at) return;
    const start = new Date(form.start_at);
    const end = new Date(form.end_at);
    if (end <= start) {
      alert('End must be after start.');
      return;
    }
    await supabase.from('meetings').insert({
      user_id: user.id,
      title: form.title.trim(),
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      description: form.description.trim() || null,
    });
    const { data } = await supabase.from('meetings').select('*').eq('user_id', user.id).order('start_at', { ascending: true });
    setMeetings((data as Meeting[]) ?? []);
    setForm({ title: '', start_at: '', end_at: '', description: '' });
    setShowForm(false);
  };

  const deleteMeeting = async (id: string) => {
    if (!confirm('Delete this meeting?')) return;
    await supabase.from('meetings').delete().eq('id', id);
    setMeetings((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Meeting Schedule</h1>
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-toptier-primary text-white hover:bg-toptier-primary-hover"
        >
          <Plus className="w-4 h-4" /> Create meeting
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-5 rounded-lg bg-white border border-gray-200 shadow-card">
          <div className="flex justify-between mb-4">
            <h3 className="font-medium text-gray-900">New meeting</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-900">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-3">
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Title *"
              className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
                <input
                  type="datetime-local"
                  value={form.start_at}
                  onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End</label>
                <input
                  type="datetime-local"
                  value={form.end_at}
                  onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900"
                />
              </div>
            </div>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 resize-none"
            />
            <button onClick={createMeeting} disabled={!form.title.trim() || !form.start_at || !form.end_at} className="px-4 py-2 rounded-lg bg-toptier-primary text-white hover:bg-toptier-primary-hover disabled:opacity-50">
              Save
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-600">Loading...</p>
      ) : meetings.length === 0 ? (
        <p className="text-gray-600">No meetings scheduled.</p>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <div key={m.id} className="bg-white rounded-lg border border-gray-200 shadow-card p-4 flex justify-between items-start">
              <div>
                <p className="font-medium text-gray-900">{m.title}</p>
                <p className="text-sm text-gray-600">
                  {format(parseISO(m.start_at), 'MMM d, yyyy h:mm a')} – {format(parseISO(m.end_at), 'h:mm a')}
                </p>
                {m.description && <p className="text-sm text-gray-500 mt-1">{m.description}</p>}
              </div>
              <button type="button" onClick={() => deleteMeeting(m.id)} className="p-2 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
