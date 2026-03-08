# TopTier Digital Solutions – Employee Management System

## Step-by-Step Setup Guide

This guide walks you through setting up the EMS from zero: local dev, Supabase, and deployment.

---

## Prerequisites

- **Node.js** 18+ ([nodejs.org](https://nodejs.org))
- **npm** or **yarn**
- **Git** (optional)
- A **Supabase** account ([supabase.com](https://supabase.com))

---

## Part 1: Create Supabase Project & Get Keys

### 1.1 Create a Supabase project

1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click **New Project**.
3. Choose your **Organization** (or create one).
4. Set:
   - **Project name**: e.g. `toptier-ems`
   - **Database password**: save this somewhere safe (you need it for DB access).
   - **Region**: pick the closest to your users.
5. Click **Create new project** and wait until it’s ready.

### 1.2 Get your API keys and URL

1. In the Supabase dashboard, open your project.
2. Go to **Project Settings** (gear icon) → **API**.
3. Copy and save:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **anon public** key (under “Project API keys”)

You will use these in the app as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### 1.3 Run the database migrations in Supabase

1. In Supabase, go to **SQL Editor**.
2. Open the file **`supabase/migrations/001_initial_schema.sql`** from this project.
3. Copy its full content and paste into a new query in the SQL Editor.
4. Click **Run** (or press Ctrl+Enter).
5. Repeat for **`002_storage_policies.sql`** and **`003_rls_policies.sql`** (run in order: 001 → 002 → 003).
6. For the full feature set (notifications, profile contact/skills/interests, employee approval, meetings, leave allocation), run in order: **004**, **005**, **006**, **007**, **008**, **009**, **010**, **011**, **012**. These add approval flow, skills/interests, notifications, meetings, leave allocations, and set new signups to “pending” until approved by HR/CEO/Manager.

Alternatively, if you install the Supabase CLI, you can run:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

(Replace `YOUR_PROJECT_REF` with the ref from your project URL.)

### 1.4 Configure Storage in Supabase

1. In Supabase, open **Storage** in the left sidebar.
2. **Create three buckets** (if the migration did not create them):
   - **avatars** – Public, 5 MB limit, MIME: `image/jpeg`, `image/png`, `image/webp`, `image/gif`.
   - **accomplishments** – Public, 10 MB limit, MIME: `application/pdf`, `image/*`.
   - **feed-media** – Public, **20 MB** limit, MIME: `image/*`, `video/mp4`, `video/webm`.
3. For each bucket, create the policies from **`supabase/migrations/002_storage_policies.sql`** (copy the policy statements into the SQL Editor and run them, or add equivalent policies in the Dashboard).
4. This allows profile pictures, accomplishment files, and feed images/videos (up to 20 MB) to be uploaded and viewed.

---

## Part 2: Install and Run the App Locally

### 2.1 Install dependencies

Open a terminal in the project folder and run:

```bash
cd c:\Users\Administrator\Desktop\TOPTIER-EMS
npm install
```

### 2.2 Environment variables

1. In the project root, copy the example env file:

   ```bash
   copy .env.example .env
   ```

2. Edit **`.env`** and set:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

   Use the **Project URL** and **anon public** key from Part 1.2.

### 2.3 Run the development server

```bash
npm run dev
```

Open the URL shown (e.g. `http://localhost:5173`) in your browser.

### 2.4 First-time usage

1. Open the app and go to **Register**.
2. Create an account and choose a **position** (role):
   - **Employee**, **Trainer** – can request leave and use profile/feed (no approval rights).
   - **Team Lead (TL)**, **Supervisor**, **HR**, **CEO** – can also approve/reject leave requests.
3. After registration, you can log in and use:
   - Profile (picture, accomplishments, PDF export)
   - Leave requests (Emergency, Vacation, Sick) and approvals (for CEO/HR/Supervisor/TL only)
   - Social feed (posts, images, videos up to 20MB, comments, likes)

---

## Part 3: Project Structure (Overview)

```
TOPTIER-EMS/
├── .env                    # Your Supabase URL and anon key (create from .env.example)
├── .env.example            # Template for .env
├── SETUP_GUIDE.md          # This file
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── lib/
│   │   └── supabase.ts     # Supabase client
│   ├── types/
│   │   └── database.ts    # Shared types
│   ├── contexts/
│   │   └── AuthContext.tsx
│   ├── pages/              # Login, Register, Dashboard, Profile, Feed, Leave
│   ├── components/         # Reusable UI and feature components
│   └── styles/
├── supabase/
│   └── migrations/         # SQL for schema, storage, RLS
└── public/
```

---

## Part 4: Packages Used (from package.json)

- **react**, **react-dom** – UI
- **react-router-dom** – Routing
- **@supabase/supabase-js** – Supabase client (auth, DB, storage)
- **tailwindcss**, **postcss**, **autoprefixer** – Styling
- **lucide-react** – Icons
- **date-fns** – Date formatting
- **jspdf**, **html2canvas** – PDF export for profile
- **react-dropzone** – File uploads
- **react-player** – Video playback in feed

Install all with:

```bash
npm install
```

---

## Part 5: Features Checklist

| Feature | Description |
|--------|-------------|
| **Auth** | Login, Register, position/role: **Employee**, **Trainer**, Team Lead, Supervisor, HR, CEO |
| **Leave** | Emergency, Vacation, Sick leave; Employee requests; TL/Supervisor/HR/CEO approve |
| **Profile** | Picture, accomplishments, LinkedIn-style view, PDF export |
| **Feed** | Posts (text, image, video up to 20MB), comments, likes |

---

## Part 6: Troubleshooting

- **“Invalid API key”**: Double-check `.env` and that you’re using the **anon** key, not the service role.
- **“relation does not exist”**: Run all three migration files in order in the SQL Editor.
- **"Database error saving new user" / 500 on Register**: (1) Ensure **001_initial_schema.sql** has been run so `public.profiles` exists. (2) If you use Trainer, run **004_add_trainer_role.sql**. (3) Open **005_fix_handle_new_user_trigger.sql**, copy its entire contents, paste into Supabase **SQL Editor** → New query → **Run**. Then try registering again (e.g. as CEO).
- **Upload fails**: Check Storage bucket names and RLS policies in Supabase.
- **Videos not playing**: Ensure format is supported (e.g. MP4) and size ≤ 20MB.

---

## Part 7: Going Online (Deploy)

To let everyone use the app online:

1. **Frontend**: Deploy the Vite app to Vercel, Netlify, or similar (connect your Git repo; use the same env vars).
2. **Database**: Your Supabase project is already in the cloud; no extra step.
3. **Env vars**: In your hosting provider’s dashboard, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` so the built app can connect to Supabase.

After deployment, all users will use the same Supabase database and storage online.
