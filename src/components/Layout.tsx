import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { AppRole } from '../types/database';
import SearchBar from './SearchBar';
import TimeClock from './TimeClock';
import PresenceToggle from './PresenceToggle';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  MessageCircle,
  UserCheck,
  PieChart,
  CalendarDays,
  UsersRound,
  Briefcase,
  ClipboardList,
  Monitor,
  CalendarRange,
  Award,
  Menu,
  X,
} from 'lucide-react';

const LOGO_SRC = '/logo.png';

const NAV_ALL = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/feed', label: 'Feed', icon: MessageCircle },
  { to: '/profile', label: 'My Profile', icon: Users },
  { to: '/leave', label: 'Leave', icon: Calendar },
  { to: '/professional-development', label: 'Professional Development', icon: Award },
  { to: '/meetings', label: 'My Meetings', icon: CalendarDays },
  { to: '/employees', label: 'Total Employees', icon: UsersRound, roles: ['ceo', 'executive', 'hr'] as AppRole[] },
  { to: '/recruitment', label: 'Recruitment', icon: Briefcase, roles: ['ceo', 'executive', 'manager', 'trainer', 'supervisor', 'hr'] as AppRole[] },
  { to: '/leave/requests', label: 'Leave Requests', icon: FileText, roles: ['ceo', 'executive', 'hr', 'manager', 'supervisor', 'tl', 'trainer'] as AppRole[] },
  { to: '/team-calendar', label: 'Team Calendar', icon: CalendarRange, roles: ['ceo', 'executive', 'hr', 'manager', 'supervisor', 'tl'] as AppRole[] },
  { to: '/employee-approval', label: 'Employee Approval', icon: UserCheck, roles: ['ceo', 'hr', 'supervisor'] as AppRole[] },
  { to: '/leave/allocation', label: 'Leave Allocation', icon: PieChart, roles: ['ceo', 'hr'] as AppRole[] },
  { to: '/action-log', label: 'Action Log', icon: ClipboardList, roles: ['ceo', 'executive'] as AppRole[] },
  { to: '/clients-it-department', label: 'Clients IT Department', icon: Monitor, department: 'it' as const },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const nav = NAV_ALL.filter((item) => {
    if (item.department) return profile?.department === item.department || profile?.department === 'executive' || profile?.position === 'executive';
    if (!item.roles) return true;
    return profile && item.roles.includes(profile.position);
  });

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onEscape = (e: KeyboardEvent) => e.key === 'Escape' && setSidebarOpen(false);
    document.addEventListener('keydown', onEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const navLinks = (
    <>
      {nav.map(({ to, label, icon: Icon }) => {
        const isActive =
          location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to));
        return (
          <Link
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition ${
              isActive
                ? 'bg-toptier-primary/10 text-toptier-primary'
                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile overlay when sidebar open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: drawer on mobile, static on md+ */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 w-64 sm:w-72 md:w-56 flex-shrink-0
          bg-white border-r border-gray-200 flex flex-col
          transform transition-transform duration-200 ease-out
          md:transform-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="flex items-center justify-between md:justify-center px-4 py-4 border-b border-gray-100 flex-shrink-0">
          <Link
            to="/dashboard"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center min-w-0"
            aria-label="Dashboard"
          >
            <img
              src={LOGO_SRC}
              alt=""
              className="h-9 sm:h-10 w-auto max-w-[160px] sm:max-w-[180px] object-contain object-left"
            />
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto overscroll-contain">
          {navLinks}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 w-full">
        <header className="h-14 flex-shrink-0 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 md:px-6 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 flex-shrink-0"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <SearchBar />
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <PresenceToggle />
            <TimeClock />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-5 md:p-6 overflow-auto bg-gray-50 min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
