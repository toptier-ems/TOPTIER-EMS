import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Notification } from '../types/database';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationBell() {
  const { user } = useAuth();
  const [list, setList] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = list.filter((n) => !n.read_at).length;

  const fetchNotifications = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setList((data as Notification[]) ?? []);
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    setList((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    setLoading(true);
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
    setList((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setLoading(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-toptier-primary transition"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-h-96 overflow-auto rounded-xl bg-white border border-gray-200 shadow-xl z-50 py-2">
          <div className="px-3 py-2 flex items-center justify-between border-b border-gray-200">
            <span className="font-medium text-gray-900">Notifications</span>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} disabled={loading} className="text-xs text-toptier-primary hover:underline font-medium">
                Mark all read
              </button>
            )}
          </div>
          {list.length === 0 ? (
            <p className="px-3 py-4 text-gray-500 text-sm">No notifications</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {list.map((n) => (
                <li key={n.id}>
                  <Link
                    to={n.type === 'pd_event' ? (n.reference_id ? `/professional-development?event=${n.reference_id}` : '/professional-development') : (n.reference_id ? `/feed?post=${n.reference_id}` : '/feed')}
                    onClick={() => {
                      if (!n.read_at) markRead(n.id);
                      setOpen(false);
                    }}
                    className={`block px-3 py-2 hover:bg-gray-50 ${!n.read_at ? 'bg-toptier-primary/5' : ''}`}
                  >
                    <p className="text-sm font-medium text-gray-900">{n.title}</p>
                    {n.body && <p className="text-xs text-gray-500 truncate">{n.body}</p>}
                    <p className="text-xs text-gray-500 mt-0.5">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
