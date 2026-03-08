import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { POSITION_LABELS } from '../types/database';
import { User, Settings, LogOut } from 'lucide-react';

export default function UserMenu() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition focus:ring-2 focus:ring-toptier-primary focus:ring-offset-2 focus:ring-offset-white"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden border-2 border-gray-200 flex-shrink-0">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-toptier-muted text-sm font-medium">
              {profile?.full_name?.trim().split(/\s+/).map((s) => s[0]).join('').slice(0, 2) || '?'}
            </span>
          )}
        </div>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-white border border-gray-200 shadow-xl z-50 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-toptier-muted font-medium">
                  {profile?.full_name?.trim().split(/\s+/).map((s) => s[0]).join('').slice(0, 2) || '?'}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 truncate">{profile?.full_name ?? 'User'}</p>
              <p className="text-sm text-gray-500 truncate">{profile?.email}</p>
              <p className="text-xs text-gray-500">{profile ? POSITION_LABELS[profile.position] : ''}</p>
            </div>
          </div>
          <div className="py-2">
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-toptier-primary/10 hover:text-toptier-primary transition"
            >
              <User className="w-5 h-5" />
              My Profile
            </Link>
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-toptier-primary/10 hover:text-toptier-primary transition"
            >
              <Settings className="w-5 h-5" />
              Settings
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-gray-700 hover:bg-red-50 hover:text-red-500 transition"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
