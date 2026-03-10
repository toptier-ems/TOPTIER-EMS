import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { FeedPostWithAuthor, FeedShortWithAuthor } from '../types/database';
import type { ShortReactionType } from '../types/database';
import { POSITION_LABELS, EMPLOYEE_BADGE_LABELS } from '../types/database';
import type { EmployeeBadge } from '../types/database';
import { useDropzone } from 'react-dropzone';
import ReactPlayer from 'react-player';
import { format, formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Send, Trash2, X, Plus } from 'lucide-react';

const FEED_BUCKET = 'feed-media';
const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_SHORT_BYTES = 50 * 1024 * 1024; // 50MB for shorts
const SHORTS_MAX_AGE_HOURS = 24;
const ACCEPT_IMAGE = { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif'] };
const ACCEPT_VIDEO = { 'video/*': ['.mp4', '.webm'] };

const POSITIONS = ['ceo', 'hr', 'supervisor', 'tl', 'trainer', 'employee'] as const;

function feedLevel(points: number | null | undefined): number {
  if (points == null) return 1;
  return Math.min(100, 1 + Math.floor(points / 100));
}

const SHORT_REACTIONS: { type: ShortReactionType; emoji: string; label: string }[] = [
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'haha', emoji: '😂', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Sad' },
  { type: 'angry', emoji: '😠', label: 'Angry' },
];

async function createMentionNotifications(content: string, postId: string, fromUserId: string) {
  const userIds = new Set<string>();
  const userMatch = /@\[user:([a-f0-9-]+)(?::([^\]]*))?\]/gi;
  let m;
  while ((m = userMatch.exec(content)) !== null) userIds.add(m[1].toLowerCase());
  const positionMatch = /@\[position:([^\]]+)\]/gi;
  while ((m = positionMatch.exec(content)) !== null) {
    const role = m[1].split(':')[0].trim().toLowerCase();
    const { data } = await supabase.from('profiles').select('id').eq('position', role);
    (data ?? []).forEach((r: { id: string }) => userIds.add(r.id));
  }
  if (/@\[everyone\]/i.test(content)) {
    const { data } = await supabase.from('profiles').select('id');
    (data ?? []).forEach((r: { id: string }) => userIds.add(r.id));
  }
  userIds.delete(fromUserId);
  const { data: fromProfile } = await supabase.from('profiles').select('full_name').eq('id', fromUserId).single();
  const fromName = (fromProfile as { full_name?: string } | null)?.full_name ?? 'Someone';
  const notifications = Array.from(userIds).map((uid) => ({
    user_id: uid,
    type: 'mention',
    title: 'You were mentioned in a post',
    body: `${fromName} mentioned you in a post`,
    reference_id: postId,
    from_user_id: fromUserId,
  }));
  if (notifications.length) await supabase.from('notifications').insert(notifications);
}

async function createMentionNotificationsForComment(content: string, postId: string, fromUserId: string) {
  const userIds = new Set<string>();
  const userMatch = /@\[user:([a-f0-9-]+)(?::([^\]]*))?\]/gi;
  let m;
  while ((m = userMatch.exec(content)) !== null) userIds.add(m[1].toLowerCase());
  const positionMatch = /@\[position:([^\]]+)\]/gi;
  while ((m = positionMatch.exec(content)) !== null) {
    const role = m[1].split(':')[0].trim().toLowerCase();
    const { data } = await supabase.from('profiles').select('id').eq('position', role);
    (data ?? []).forEach((r: { id: string }) => userIds.add(r.id));
  }
  if (/@\[everyone\]/i.test(content)) {
    const { data } = await supabase.from('profiles').select('id');
    (data ?? []).forEach((r: { id: string }) => userIds.add(r.id));
  }
  userIds.delete(fromUserId);
  const { data: fromProfile } = await supabase.from('profiles').select('full_name').eq('id', fromUserId).single();
  const fromName = (fromProfile as { full_name?: string } | null)?.full_name ?? 'Someone';
  const notifications = Array.from(userIds).map((uid) => ({
    user_id: uid,
    type: 'mention',
    title: 'You were mentioned in a comment',
    body: `${fromName} mentioned you in a comment`,
    reference_id: postId,
    from_user_id: fromUserId,
  }));
  if (notifications.length) await supabase.from('notifications').insert(notifications);
}

export default function FeedPage() {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const postIdFromUrl = searchParams.get('post');
  const [posts, setPosts] = useState<FeedPostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [postContent, setPostContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [commentBodies, setCommentBodies] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [mentionOptions, setMentionOptions] = useState<{ type: 'everyone' | 'position' | 'user'; id?: string; label: string }[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [shorts, setShorts] = useState<FeedShortWithAuthor[]>([]);
  const [uploadingShort, setUploadingShort] = useState(false);
  const [viewerShort, setViewerShort] = useState<FeedShortWithAuthor | null>(null);
  const [deletingShortId, setDeletingShortId] = useState<string | null>(null);
  const [shortReactionCounts, setShortReactionCounts] = useState<Record<string, Record<ShortReactionType, number>>>({});
  const [myShortReaction, setMyShortReaction] = useState<Record<string, ShortReactionType | null>>({});
  const shortInputRef = useRef<HTMLInputElement>(null);
  const postRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const fetchShorts = async () => {
    const since = new Date(Date.now() - SHORTS_MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('feed_shorts')
      .select('id, user_id, media_url, created_at, profiles!user_id(id, full_name, avatar_url)')
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as { id: string; user_id: string; media_url: string; created_at: string; profiles: unknown }[];
    setShorts(rows.map((r) => ({ ...r, profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles } as FeedShortWithAuthor)));
    try {
      await supabase.rpc('cleanup_old_feed_shorts');
    } catch (_) { /* ignore */ }
  };

  const deleteMyShort = async (shortId: string) => {
    if (!user?.id || !confirm('Delete this short? This cannot be undone.')) return;
    setDeletingShortId(shortId);
    try {
      const { error } = await supabase.from('feed_shorts').delete().eq('id', shortId).eq('user_id', user.id);
      if (error) throw error;
      setShorts((prev) => prev.filter((s) => s.id !== shortId));
      if (viewerShort?.id === shortId) setViewerShort(null);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to delete short.');
    } finally {
      setDeletingShortId(null);
    }
  };

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('feed_posts')
      .select(
        `
        *,
        profiles!user_id(id, full_name, avatar_url, position, feed_points, employee_badge)
      `
      )
      .order('created_at', { ascending: false });
    if (!data) {
      setPosts([]);
      return;
    }
    const withCounts = await Promise.all(
      (data as FeedPostWithAuthor[]).map(async (p) => {
        const [{ count: likeCount }, { count: commentCount }, { data: likes }] = await Promise.all([
          supabase.from('feed_likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
          supabase.from('feed_comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
          supabase.from('feed_likes').select('user_id').eq('post_id', p.id).eq('user_id', user?.id ?? ''),
        ]);
        return {
          ...p,
          like_count: likeCount ?? 0,
          comment_count: commentCount ?? 0,
          liked_by_me: (likes?.length ?? 0) > 0,
        };
      })
    );
    setPosts(withCounts);
  };

  useEffect(() => {
    (async () => {
      await fetchPosts();
      await fetchShorts();
    })();
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!postIdFromUrl || !posts.length) return;
    const el = postRefs.current[postIdFromUrl] ?? document.getElementById(`post-${postIdFromUrl}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setExpandedComments((prev) => ({ ...prev, [postIdFromUrl]: true }));
      setSearchParams({}, { replace: true });
    }
  }, [postIdFromUrl, posts.length]);

  const lastAtIndex = postContent.lastIndexOf('@');
  const showMentionDropdown = lastAtIndex !== -1 && !/\[[\w:-]+\]$/.test(postContent.slice(lastAtIndex));
  const mentionPrefix = postContent.slice(0, lastAtIndex);
  const queryAfterAt = postContent.slice(lastAtIndex + 1);

  useEffect(() => {
    if (!showMentionDropdown) {
      setMentionOptions([]);
      return;
    }
    const q = queryAfterAt.toLowerCase().trim();
    const opts: { type: 'everyone' | 'position' | 'user'; id?: string; label: string }[] = [];
    if (!q || 'everyone'.startsWith(q)) opts.push({ type: 'everyone', label: 'everyone' });
    POSITIONS.forEach((pos) => {
      const label = POSITION_LABELS[pos];
      if (!q || label.toLowerCase().includes(q) || pos.includes(q)) opts.push({ type: 'position', id: pos, label });
    });
    let cancelled = false;
    (async () => {
      if (q) {
        const { data } = await supabase.from('profiles').select('id, full_name').ilike('full_name', `%${queryAfterAt.trim()}%`).limit(5);
        if (!cancelled && data) data.forEach((r: { id: string; full_name: string }) => opts.push({ type: 'user', id: r.id, label: r.full_name }));
      }
      if (!cancelled) {
        setMentionOptions(opts);
        setMentionIndex(0);
      }
    })();
    return () => { cancelled = true; };
  }, [showMentionDropdown, queryAfterAt]);

  const insertMention = (opt: { type: 'everyone' | 'position' | 'user'; id?: string; label: string }) => {
    let tag: string;
    if (opt.type === 'everyone') tag = '@[everyone]';
    else if (opt.type === 'position') tag = `@[position:${opt.id}:${opt.label}]`;
    else tag = `@[user:${opt.id}:${opt.label}]`;
    setPostContent(mentionPrefix + tag + ' ');
    setMentionOptions([]);
  };

  const uploadMedia = async (file: File): Promise<{ url: string; mediaType: 'image' | 'video' }> => {
    if (!user?.id) throw new Error('Not logged in');
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(FEED_BUCKET).upload(path, file, {
      upsert: false,
      cacheControl: '3600',
    });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(FEED_BUCKET).getPublicUrl(path);
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
    return { url: urlData.publicUrl, mediaType };
  };

  const onDrop = async (accepted: File[]) => {
    if (!user?.id || accepted.length === 0) return;
    const file = accepted[0];
    if (file.size > MAX_VIDEO_BYTES) {
      alert('File must be 20MB or less.');
      return;
    }
    setUploading(true);
    try {
      const { url, mediaType } = await uploadMedia(file);
      const { error } = await supabase.from('feed_posts').insert({
        user_id: user.id,
        content: null,
        media_url: url,
        media_type: mediaType,
      });
      if (error) throw error;
      await fetchPosts();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const createTextPost = async () => {
    if (!user?.id || !postContent.trim()) return;
    setUploading(true);
    try {
      const { data: newPost } = await supabase.from('feed_posts').insert({
        user_id: user.id,
        content: postContent.trim(),
        media_url: null,
        media_type: null,
      }).select('id').single();
      if (newPost) await createMentionNotifications(postContent.trim(), newPost.id, user.id);
      setPostContent('');
      await fetchPosts();
    } finally {
      setUploading(false);
    }
  };

  const deletePost = async (postId: string) => {
    if (!profile || profile.position !== 'ceo') return;
    await supabase.from('feed_posts').delete().eq('id', postId);
    setDeletePostId(null);
    await fetchPosts();
  };

  const { getRootProps: getImageRootProps, getInputProps: getImageInputProps } = useDropzone({
    onDrop,
    accept: ACCEPT_IMAGE,
    maxFiles: 1,
    maxSize: MAX_VIDEO_BYTES,
    disabled: uploading,
  });

  const { getRootProps: getVideoRootProps, getInputProps: getVideoInputProps } = useDropzone({
    onDrop,
    accept: ACCEPT_VIDEO,
    maxFiles: 1,
    maxSize: MAX_VIDEO_BYTES,
    disabled: uploading,
  });

  const fetchShortReactions = async (shortId: string) => {
    const { data } = await supabase
      .from('feed_short_reactions')
      .select('user_id, reaction_type')
      .eq('short_id', shortId);
    const list = (data ?? []) as { user_id: string; reaction_type: ShortReactionType }[];
    const counts: Record<ShortReactionType, number> = { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 };
    let myReaction: ShortReactionType | null = null;
    list.forEach((r) => {
      counts[r.reaction_type]++;
      if (r.user_id === user?.id) myReaction = r.reaction_type;
    });
    setShortReactionCounts((prev) => ({ ...prev, [shortId]: counts }));
    setMyShortReaction((prev) => ({ ...prev, [shortId]: myReaction }));
  };

  const toggleShortReaction = async (shortId: string, type: ShortReactionType) => {
    if (!user?.id) return;
    const current = myShortReaction[shortId];
    const defaults = { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 };
    if (current === type) {
      await supabase.from('feed_short_reactions').delete().eq('short_id', shortId).eq('user_id', user.id);
      setMyShortReaction((prev) => ({ ...prev, [shortId]: null }));
      setShortReactionCounts((prev) => {
        const c = { ...defaults, ...prev[shortId] };
        return { ...prev, [shortId]: { ...c, [type]: Math.max(0, c[type] - 1) } };
      });
    } else {
      await supabase.from('feed_short_reactions').upsert(
        { short_id: shortId, user_id: user.id, reaction_type: type },
        { onConflict: 'short_id,user_id' }
      );
      setMyShortReaction((prev) => ({ ...prev, [shortId]: type }));
      setShortReactionCounts((prev) => {
        const c = { ...defaults, ...prev[shortId] };
        if (current) c[current] = Math.max(0, c[current] - 1);
        return { ...prev, [shortId]: { ...c, [type]: c[type] + 1 } };
      });
    }
  };

  useEffect(() => {
    if (viewerShort) fetchShortReactions(viewerShort.id);
  }, [viewerShort?.id]);

  const addShort = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!user?.id || !file) return;
    if (file.size > MAX_SHORT_BYTES) {
      alert('Short video must be 50MB or less.');
      return;
    }
    if (!file.type.startsWith('video/')) {
      alert('Please choose a video file.');
      return;
    }
    setUploadingShort(true);
    try {
      const ext = file.name.split('.').pop() || 'mp4';
      const path = `${user.id}/shorts/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(FEED_BUCKET).upload(path, file, { upsert: false, cacheControl: '3600' });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from(FEED_BUCKET).getPublicUrl(path);
      const { error: insErr } = await supabase.from('feed_shorts').insert({ user_id: user.id, media_url: urlData.publicUrl });
      if (insErr) throw insErr;
      await fetchShorts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add short');
    } finally {
      setUploadingShort(false);
    }
  };

  const toggleLike = async (postId: string, liked: boolean) => {
    if (!user?.id) return;
    if (liked) {
      await supabase.from('feed_likes').delete().eq('post_id', postId).eq('user_id', user.id);
    } else {
      await supabase.from('feed_likes').insert({ post_id: postId, user_id: user.id });
    }
    await fetchPosts();
  };

  const submitComment = async (postId: string) => {
    const body = commentBodies[postId]?.trim();
    if (!user?.id || !body) return;
    await supabase.from('feed_comments').insert({ post_id: postId, user_id: user.id, body });
    await createMentionNotificationsForComment(body, postId, user.id);
    setCommentBodies((prev) => ({ ...prev, [postId]: '' }));
    setExpandedComments((prev) => ({ ...prev, [postId]: true }));
    await fetchPosts();
  };

  return (
    <div className="max-w-2xl mx-auto px-0 sm:px-0 min-w-0">
      <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4 sm:mb-6">Feed</h1>

      {/* Shorts (My Day style) - 24h only, max 50MB */}
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-3">Share your today's happy moments!</p>
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
          <input
            ref={shortInputRef}
            type="file"
            accept="video/mp4,video/webm,video/*"
            className="hidden"
            onChange={addShort}
          />
          <button
            type="button"
            onClick={() => shortInputRef.current?.click()}
            disabled={uploadingShort}
            className="flex-shrink-0 w-20 flex flex-col items-center gap-1.5"
          >
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-100 hover:border-toptier-primary hover:bg-toptier-primary/10 transition">
              {uploadingShort ? (
                <span className="text-xs text-toptier-muted">...</span>
              ) : (
                <Plus className="w-7 h-7 text-toptier-muted" />
              )}
            </div>
            <span className="text-xs text-toptier-muted truncate max-w-[80px]">My Day</span>
          </button>
          {shorts.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setViewerShort(s)}
              className="flex-shrink-0 w-20 flex flex-col items-center gap-1.5"
            >
              <div className="w-16 h-16 rounded-full border-2 border-toptier-primary overflow-hidden bg-gray-200 ring-2 ring-transparent hover:ring-toptier-primary/50 transition">
                {s.profiles?.avatar_url ? (
                  <img src={s.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-lg text-toptier-muted">
                    {s.profiles?.full_name?.charAt(0) ?? '?'}
                  </span>
                )}
              </div>
              <span className="text-xs text-toptier-muted truncate max-w-[80px]">{s.profiles?.full_name ?? 'Unknown'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Create post */}
      <div className="bg-toptier-surface rounded-card border border-gray-200 shadow-card p-4 mb-6">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-toptier-muted text-sm">
                {profile?.full_name?.charAt(0) ?? '?'}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 relative">
            <textarea
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              onKeyDown={(e) => {
                if (!showMentionDropdown || mentionOptions.length === 0) return;
                if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex((i) => (i + 1) % mentionOptions.length); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex((i) => (i - 1 + mentionOptions.length) % mentionOptions.length); }
                else if (e.key === 'Enter' && showMentionDropdown) { e.preventDefault(); insertMention(mentionOptions[mentionIndex]); }
                else if (e.key === 'Escape') setMentionOptions([]);
              }}
              placeholder="What's on your mind? Use @ to tag: @everyone, @position, or @name"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-500 resize-none mb-2 focus:ring-2 focus:ring-toptier-primary/30 focus:border-toptier-primary"
            />
            {showMentionDropdown && mentionOptions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-0.5 py-1 rounded-lg bg-white border border-gray-200 shadow-xl max-h-48 overflow-auto">
                {mentionOptions.map((opt, i) => (
                  <button
                    key={opt.type + (opt.id ?? '') + opt.label}
                    type="button"
                    onClick={() => insertMention(opt)}
                    onMouseEnter={() => setMentionIndex(i)}
                    className={`w-full text-left px-3 py-2 text-sm ${i === mentionIndex ? 'bg-toptier-primary/15 text-toptier-primary' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    {opt.type === 'everyone' ? '@everyone' : opt.type === 'position' ? `@${opt.label}` : `@${opt.label}`}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={createTextPost}
                disabled={uploading || !postContent.trim()}
                className="px-4 py-1.5 rounded-lg bg-toptier-primary hover:bg-toptier-primary-hover text-white text-sm font-medium disabled:opacity-50 transition"
              >
                Post
              </button>
              <div {...getImageRootProps()} className="cursor-pointer text-sm text-toptier-muted hover:text-toptier-primary transition">
                <input {...getImageInputProps()} />
                <span>Photo</span>
              </div>
              <div {...getVideoRootProps()} className="cursor-pointer text-sm text-toptier-muted hover:text-toptier-primary transition">
                <input {...getVideoInputProps()} />
                <span>Video (max 20MB)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feed list */}
      {loading ? (
        <p className="text-toptier-muted">Loading feed...</p>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <div
              key={p.id}
              id={`post-${p.id}`}
              ref={(el) => { postRefs.current[p.id] = el; }}
              className="bg-toptier-surface rounded-card border border-gray-200 overflow-hidden shadow-card"
            >
              <div className="p-4 flex items-center gap-3">
                <Link to={`/profile/${p.user_id}`} className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden block">
                  {p.profiles?.avatar_url ? (
                    <img src={p.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-toptier-muted text-sm">
                      {p.profiles?.full_name?.charAt(0) ?? '?'}
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/profile/${p.user_id}`} className="font-medium text-gray-900 hover:text-toptier-primary transition">
                    {p.profiles?.full_name ?? 'Unknown'}
                  </Link>
                  <p className="text-xs text-toptier-muted">
                    {p.profiles?.position ? POSITION_LABELS[p.profiles.position as keyof typeof POSITION_LABELS] : ''}
                    {p.profiles?.employee_badge && (
                      <> · {EMPLOYEE_BADGE_LABELS[p.profiles.employee_badge as EmployeeBadge]}</>
                    )}
                    {p.profiles?.feed_points != null && (
                      <> · Level {feedLevel(p.profiles.feed_points)}</>
                    )}
                    {' · '}{format(new Date(p.created_at), 'MMM d, h:mm a')}
                  </p>
                </div>
                {profile?.position === 'ceo' && (
                  <button
                    type="button"
                    onClick={() => setDeletePostId(p.id)}
                    className="p-2 rounded-lg text-toptier-muted hover:text-red-500 hover:bg-red-50 transition"
                    title="Delete post"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {p.content && (
                <p className="px-4 pb-2 text-gray-700 whitespace-pre-wrap">
                  <MentionText content={p.content} />
                </p>
              )}
              {p.media_url && (
                <div className="bg-black/30">
                  {p.media_type === 'video' ? (
                    <div className="aspect-video max-h-[400px]">
                      <ReactPlayer
                        url={p.media_url}
                        width="100%"
                        height="100%"
                        controls
                        style={{ aspectRatio: '16/9' }}
                      />
                    </div>
                  ) : (
                    <img src={p.media_url} alt="" className="w-full max-h-[500px] object-contain" />
                  )}
                </div>
              )}
              <div className="px-4 py-2 flex items-center gap-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => toggleLike(p.id, !!p.liked_by_me)}
                  className={`flex items-center gap-1 text-sm ${p.liked_by_me ? 'text-red-500' : 'text-gray-500 hover:text-toptier-primary'} transition`}
                >
                  <Heart className={`w-4 h-4 ${p.liked_by_me ? 'fill-current' : ''}`} />
                  {p.like_count ?? 0}
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedComments((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-toptier-primary transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  {p.comment_count ?? 0} comments
                </button>
              </div>
              {expandedComments[p.id] && (
                <FeedComments
                  key={`${p.id}-${p.comment_count ?? 0}`}
                  postId={p.id}
                  commentBody={commentBodies[p.id] ?? ''}
                  setCommentBody={(v) => setCommentBodies((prev) => ({ ...prev, [p.id]: v }))}
                  onSubmit={() => submitComment(p.id)}
                  currentUserId={user?.id}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* CEO delete post confirmation modal */}
      {deletePostId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60" onClick={() => setDeletePostId(null)}>
          <div
            className="bg-white border border-gray-200 w-full sm:max-w-md max-h-[85dvh] overflow-y-auto rounded-t-2xl sm:rounded-xl shadow-xl p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Delete post?</h3>
              <button type="button" onClick={() => setDeletePostId(null)} className="p-1 rounded text-toptier-muted hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 text-sm mb-6">
              Are you sure you want to delete this post? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletePostId(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deletePost(deletePostId)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Short video viewer modal - responsive: uses most of viewport on any device */}
      {viewerShort && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-3 sm:p-4 md:p-6"
          onClick={() => setViewerShort(null)}
        >
          <div
            className="flex flex-col max-h-[95dvh] w-[92vw] sm:w-full max-w-[400px] sm:max-w-md md:max-w-lg lg:max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 flex-shrink-0 mb-2">
              <Link
                to={`/profile/${viewerShort.user_id}`}
                className="font-medium text-white hover:underline truncate min-w-0"
                onClick={() => setViewerShort(null)}
              >
                {viewerShort.profiles?.full_name ?? 'Unknown'}
              </Link>
              <div className="flex items-center gap-1 flex-shrink-0">
                {viewerShort.user_id === user?.id && (
                  <button
                    type="button"
                    onClick={() => deleteMyShort(viewerShort.id)}
                    disabled={deletingShortId === viewerShort.id}
                    className="p-2 rounded-full text-red-300 hover:text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition"
                    title="Delete this short"
                    aria-label="Delete this short"
                  >
                    <Trash2 className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewerShort(null)}
                  className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>
            <p className="text-xs text-white/70 flex-shrink-0 mb-2">
              {formatDistanceToNow(new Date(viewerShort.created_at), { addSuffix: true })}
            </p>
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <div className="w-full max-h-[60dvh] sm:max-h-[65dvh] md:max-h-[70dvh] aspect-[9/16] rounded-xl overflow-hidden bg-black shadow-2xl">
                <ReactPlayer
                  url={viewerShort.media_url}
                  width="100%"
                  height="100%"
                  controls
                  playing
                  config={{ file: { attributes: { style: { objectFit: 'contain' } } } }}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3 flex-shrink-0 pb-1">
              {SHORT_REACTIONS.map(({ type, emoji, label }) => {
                const counts = shortReactionCounts[viewerShort.id];
                const count = counts?.[type] ?? 0;
                const isActive = myShortReaction[viewerShort.id] === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleShortReaction(viewerShort.id, type)}
                    title={label}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm transition touch-manipulation ${
                      isActive ? 'bg-toptier-primary/30 text-white ring-1 ring-toptier-primary' : 'bg-white/10 text-white/90 hover:bg-white/20'
                    }`}
                  >
                    <span>{emoji}</span>
                    {count > 0 && <span className="text-xs font-medium">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MentionText({ content }: { content: string }) {
  const parts = content.split(/(@\[user:[^\]]+\]|@\[position:[^\]]+\]|@\[everyone\])/gi);
  return (
    <>
      {parts.map((part, i) => {
        if (part.match(/^@\[user:([a-f0-9-]+)(?::([^\]]*))?\]$/i)) {
          const [, id, name] = part.match(/^@\[user:([a-f0-9-]+)(?::([^\]]*))?\]$/i) ?? [];
          return (
            <Link key={i} to={`/profile/${id}`} className="text-toptier-primary hover:underline font-medium">
              @{name || 'User'}
            </Link>
          );
        }
        if (part.match(/^@\[position:([^\]]+)(?::([^\]]*))?\]$/i)) {
          const [, role, label] = part.match(/^@\[position:([^\]]+)(?::([^\]]*))?\]$/i) ?? [];
          const r = role?.toLowerCase();
          return (
            <span key={i} className="text-toptier-primary font-medium">
              @{label || (r && POSITION_LABELS[r as keyof typeof POSITION_LABELS]) || role}
            </span>
          );
        }
        if (part.match(/^@\[everyone\]$/i)) {
          return (
            <span key={i} className="text-toptier-primary font-medium">
              @everyone
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function FeedComments({
  postId,
  commentBody,
  setCommentBody,
  onSubmit,
  currentUserId,
}: {
  postId: string;
  commentBody: string;
  setCommentBody: (v: string) => void;
  onSubmit: () => void;
  currentUserId?: string;
}) {
  const [comments, setComments] = useState<{ id: string; body: string; user_id: string; created_at: string; profiles: { full_name: string; avatar_url: string | null; position?: string; feed_points?: number } | null }[]>([]);
  const [mentionOptions, setMentionOptions] = useState<{ type: 'everyone' | 'position' | 'user'; id?: string; label: string }[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const lastAtIndex = commentBody.lastIndexOf('@');
  const showMentionDropdown = lastAtIndex !== -1 && !/\[[\w:-]+\]$/.test(commentBody.slice(lastAtIndex));
  const mentionPrefix = commentBody.slice(0, lastAtIndex);
  const queryAfterAt = commentBody.slice(lastAtIndex + 1);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('feed_comments')
        .select('id, body, user_id, created_at, profiles!user_id(full_name, avatar_url, position, feed_points, employee_badge)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      setComments((data as unknown as typeof comments) ?? []);
    })();
  }, [postId]);

  useEffect(() => {
    if (!showMentionDropdown) {
      setMentionOptions([]);
      return;
    }
    const q = queryAfterAt.toLowerCase().trim();
    const opts: { type: 'everyone' | 'position' | 'user'; id?: string; label: string }[] = [];
    if (!q || 'everyone'.startsWith(q)) opts.push({ type: 'everyone', label: 'everyone' });
    POSITIONS.forEach((pos) => {
      const label = POSITION_LABELS[pos];
      if (!q || label.toLowerCase().includes(q) || pos.includes(q)) opts.push({ type: 'position', id: pos, label });
    });
    let cancelled = false;
    (async () => {
      if (q) {
        const { data } = await supabase.from('profiles').select('id, full_name').ilike('full_name', `%${queryAfterAt.trim()}%`).limit(5);
        if (!cancelled && data) data.forEach((r: { id: string; full_name: string }) => opts.push({ type: 'user', id: r.id, label: r.full_name }));
      }
      if (!cancelled) {
        setMentionOptions(opts);
        setMentionIndex(0);
      }
    })();
    return () => { cancelled = true; };
  }, [showMentionDropdown, queryAfterAt]);

  const insertMention = (opt: { type: 'everyone' | 'position' | 'user'; id?: string; label: string }) => {
    let tag: string;
    if (opt.type === 'everyone') tag = '@[everyone]';
    else if (opt.type === 'position') tag = `@[position:${opt.id}:${opt.label}]`;
    else tag = `@[user:${opt.id}:${opt.label}]`;
    setCommentBody(mentionPrefix + tag + ' ');
    setMentionOptions([]);
  };

  useLayoutEffect(() => {
    if (!showMentionDropdown || mentionOptions.length === 0 || !inputRef.current) {
      setDropdownPosition(null);
      return;
    }
    const measure = () => {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        left: rect.left,
        top: rect.top,
        width: Math.max(rect.width, 220),
      });
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [showMentionDropdown, mentionOptions.length]);

  return (
    <div className="px-4 pb-4 border-t border-gray-200 pt-3 space-y-3">
      {comments.map((c) => (
        <div key={c.id} className="flex gap-2">
          <p className="text-sm text-gray-700 flex-1">
            <Link to={`/profile/${c.user_id}`} className="font-medium text-gray-900 hover:text-toptier-primary transition">
              {c.profiles?.full_name ?? 'Unknown'}
            </Link>{' '}
            {(c.profiles?.position != null || c.profiles?.feed_points != null || c.profiles?.employee_badge) && (
              <span className="text-xs text-toptier-muted">
                {c.profiles?.position ? POSITION_LABELS[c.profiles.position as keyof typeof POSITION_LABELS] : ''}
                {c.profiles?.employee_badge && <> · {EMPLOYEE_BADGE_LABELS[c.profiles.employee_badge as EmployeeBadge]}</>}
                {c.profiles?.position && c.profiles?.feed_points != null ? ' · ' : ''}
                {c.profiles?.feed_points != null ? `Level ${feedLevel(c.profiles.feed_points)}` : ''}
                {' · '}
              </span>
            )}
            <MentionText content={c.body} />
          </p>
          <span className="text-xs text-gray-500 flex-shrink-0">{format(new Date(c.created_at), 'MMM d')}</span>
        </div>
      ))}
      {currentUserId && (
        <div             className="flex gap-2 relative">
          <div className="flex-1 min-w-0 relative">
            <input
              ref={inputRef}
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Write a comment... Use @ to tag"
              className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 text-sm placeholder-gray-500 focus:ring-2 focus:ring-toptier-primary/30 focus:border-toptier-primary"
              onKeyDown={(e) => {
                if (showMentionDropdown && mentionOptions.length > 0) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex((i) => (i + 1) % mentionOptions.length); return; }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex((i) => (i - 1 + mentionOptions.length) % mentionOptions.length); return; }
                  if (e.key === 'Enter') { e.preventDefault(); insertMention(mentionOptions[mentionIndex]); return; }
                  if (e.key === 'Escape') { setMentionOptions([]); return; }
                }
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); }
              }}
            />
            {dropdownPosition != null && showMentionDropdown && mentionOptions.length > 0 && createPortal(
              <div
                className="fixed z-[100] py-1 rounded-lg bg-white border border-gray-200 shadow-xl max-h-48 overflow-auto"
                style={{
                  left: dropdownPosition.left,
                  bottom: window.innerHeight - dropdownPosition.top + 8,
                  width: dropdownPosition.width,
                }}
              >
                {mentionOptions.map((opt, i) => (
                  <button
                    key={opt.type + (opt.id ?? '') + opt.label}
                    type="button"
                    onClick={() => insertMention(opt)}
                    onMouseEnter={() => setMentionIndex(i)}
                    className={`w-full text-left px-3 py-2 text-sm ${i === mentionIndex ? 'bg-toptier-primary/15 text-toptier-primary' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    {opt.type === 'everyone' ? '@everyone' : opt.type === 'position' ? `@${opt.label}` : `@${opt.label}`}
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!commentBody.trim()}
              className="p-2 rounded-lg bg-toptier-primary hover:bg-toptier-primary-hover text-white disabled:opacity-50 flex-shrink-0 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
