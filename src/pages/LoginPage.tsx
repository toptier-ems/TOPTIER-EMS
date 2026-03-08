import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff } from 'lucide-react';

const PANEL_IMAGE_SRC = '/login-panel.png';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-16 xl:px-24 bg-gradient-to-b from-[#FFF8F5] to-[#FFEFE6]">
        <div className="w-full max-w-[400px] mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome to Toptier Employee Management System</h1>
          <p className="text-gray-600 text-sm mb-8">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-toptier-primary hover:underline font-medium">Sign up</Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100">
                {error}
              </div>
            )}
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
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-toptier-primary/30 focus:border-toptier-primary transition pr-12"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-toptier-primary hover:bg-toptier-primary-hover text-white font-semibold text-[15px] disabled:opacity-50 transition shadow-sm"
            >
              {loading ? 'Signing in...' : 'Log in'}
            </button>
          </form>

          <p className="mt-6 text-center">
            <Link to="/login" className="text-sm text-toptier-primary hover:underline">Forgot password?</Link>
          </p>
        </div>
      </div>

      {/* Right: Image fills entire panel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gray-100">
        <img src={PANEL_IMAGE_SRC} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute bottom-8 left-8 right-8 flex justify-end text-sm">
          <Link to="/login" className="text-white/90 hover:text-white drop-shadow-sm underline">Terms &amp; Conditions</Link>
        </div>
      </div>
    </div>
  );
}
