import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Search, User, FileText } from 'lucide-react';

interface SearchProfile {
  id: string;
  full_name: string;
  email: string;
  position: string;
  avatar_url: string | null;
}

interface SearchPost {
  id: string;
  content: string | null;
  created_at: string;
  profiles?: { full_name: string } | { full_name: string }[] | null;
}

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(-1);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const totalItems = profiles.length + posts.length;

  useEffect(() => {
    if (!query.trim()) {
      setProfiles([]);
      setPosts([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const q = `%${query.trim()}%`;
      const [profRes, postRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, position, avatar_url')
          .is('deleted_at', null)
          .or(`full_name.ilike.%${query.trim()}%,email.ilike.%${query.trim()}%`)
          .limit(5),
        supabase
          .from('feed_posts')
          .select('id, content, created_at, profiles!user_id(full_name)')
          .not('content', 'is', null)
          .ilike('content', q)
          .limit(5)
          .order('created_at', { ascending: false }),
      ]);
      setProfiles((profRes.data as SearchProfile[]) ?? []);
      setPosts((postRes.data as unknown as SearchPost[]) ?? []);
      setLoading(false);
      setOpen(true);
      setSelected(-1);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goToProfile = (userId: string) => {
    setOpen(false);
    setQuery('');
    navigate(`/profile/${userId}`);
  };

  const goToPost = (postId: string) => {
    setOpen(false);
    setQuery('');
    navigate(`/feed?post=${postId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || totalItems === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => (s < totalItems - 1 ? s + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => (s > 0 ? s - 1 : totalItems - 1));
    } else if (e.key === 'Enter' && selected >= 0) {
      e.preventDefault();
      if (selected < profiles.length) goToProfile(profiles[selected].id);
      else goToPost(posts[selected - profiles.length].id);
    }
  };

  return (
    <div ref={boxRef} className="relative flex-1 min-w-0 max-w-xl mx-1 sm:mx-2 md:mx-4">
      <div className="relative">
        <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 flex-shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search people or posts..."
          className="w-full pl-8 sm:pl-9 pr-3 sm:pr-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-500 text-sm focus:ring-2 focus:ring-toptier-primary/30 focus:border-toptier-primary focus:bg-white min-w-0"
        />
      </div>
      {open && (profiles.length > 0 || posts.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 py-2 rounded-xl bg-white border border-gray-200 shadow-xl z-50 max-h-80 overflow-auto">
          {profiles.length > 0 && (
            <div className="px-2 pb-1">
              <p className="px-2 py-1 text-xs font-medium text-gray-500 uppercase">People</p>
              {profiles.map((pr, i) => (
                <button
                  key={pr.id}
                  type="button"
                  onClick={() => goToProfile(pr.id)}
                  onMouseEnter={() => setSelected(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition ${
                    selected === i ? 'bg-toptier-primary/10 text-toptier-primary' : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                    {pr.avatar_url ? (
                      <img src={pr.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                        {pr.full_name?.charAt(0) ?? '?'}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{pr.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{pr.email}</p>
                  </div>
                  <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
          {posts.length > 0 && (
            <div className="px-2">
              <p className="px-2 py-1 text-xs font-medium text-gray-500 uppercase">Posts</p>
              {posts.map((po, i) => (
                <button
                  key={po.id}
                  type="button"
                  onClick={() => goToPost(po.id)}
                  onMouseEnter={() => setSelected(profiles.length + i)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition ${
                    selected === profiles.length + i ? 'bg-toptier-primary/10 text-toptier-primary' : 'hover:bg-gray-100'
                  }`}
                >
                  <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700 truncate">{po.content || 'Post'}</p>
                    <p className="text-xs text-gray-500">
                      {Array.isArray(po.profiles) ? po.profiles[0]?.full_name : (po.profiles as { full_name?: string } | null)?.full_name ?? 'Unknown'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {open && query.trim() && !loading && profiles.length === 0 && posts.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 py-4 px-4 rounded-xl bg-white border border-gray-200 shadow-xl z-50 text-center text-gray-500 text-sm">
          No people or posts found
        </div>
      )}
    </div>
  );
}
