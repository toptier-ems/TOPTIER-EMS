import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { AppRole } from '../types/database';
import { POSITION_LABELS } from '../types/database';

const PANEL_IMAGE_SRC = '/login-panel.png';
const ROLES: AppRole[] = ['employee', 'trainer', 'tl', 'supervisor', 'manager', 'executive', 'hr'];

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState<AppRole>('employee');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, position },
        },
      });
      if (err) throw err;
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-16 xl:px-24 bg-gradient-to-b from-[#FFF8F5] to-[#FFEFE6]">
        <div className="w-full max-w-[400px] mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Create an account</h1>
          <p className="text-gray-600 text-sm mb-8">
            Sign up and get started. Already have an account?{' '}
            <Link to="/login" className="text-toptier-primary hover:underline font-medium">Sign in</Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-toptier-primary/30 focus:border-toptier-primary transition"
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-toptier-primary/30 focus:border-toptier-primary transition"
                placeholder="Work email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-toptier-primary/30 focus:border-toptier-primary transition"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Position</label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as AppRole)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-toptier-primary/30 focus:border-toptier-primary transition"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{POSITION_LABELS[r]}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">CEO, Executive, HR, Manager, Supervisor, and Team Lead can approve leave.</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-toptier-primary hover:bg-toptier-primary-hover text-white font-semibold text-[15px] disabled:opacity-50 transition shadow-sm"
            >
              {loading ? 'Creating account...' : 'Submit'}
            </button>
          </form>
        </div>
      </div>

      {/* Right: Image fills entire panel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gray-100">
        <img src={PANEL_IMAGE_SRC} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute bottom-8 left-8 right-8 flex justify-end text-sm">
          <Link to="/register" className="text-white/90 hover:text-white drop-shadow-sm underline">Terms &amp; Conditions</Link>
        </div>
      </div>
    </div>
  );
}
