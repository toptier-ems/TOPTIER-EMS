# Push TOPTIER-EMS to GitHub

Follow these steps to put your project on GitHub and open it on another computer.

---

## 1. Install Git (if needed)

- **Windows:** Download and install from [https://git-scm.com/download/win](https://git-scm.com/download/win). During setup, keep the default “Git from the command line” option.
- **Mac:** Install Xcode Command Line Tools: run `xcode-select --install` in Terminal, or install Git from [https://git-scm.com](https://git-scm.com).
- After installing, close and reopen your terminal, then run `git --version` to confirm.

---

## 2. Create a GitHub account and repo

1. Go to [https://github.com](https://github.com) and sign in (or create an account).
2. Click the **+** (top right) → **New repository**.
3. Set:
   - **Repository name:** e.g. `TOPTIER-EMS`
   - **Description:** (optional) e.g. “Top Tier Employee Management System”
   - **Public** or **Private** (your choice)
   - **Do not** check “Add a README” or “Add .gitignore” (your project already has a .gitignore).
4. Click **Create repository**.
5. Leave the “Quick setup” page open; you’ll need the repo URL (e.g. `https://github.com/YourUsername/TOPTIER-EMS.git`).

---

## 3. Initialize Git and push (on this computer)

Open **PowerShell** or **Command Prompt**, go to your project folder, then run:

```powershell
cd C:\Users\Administrator\Desktop\TOPTIER-EMS
```

```powershell
git init
```

```powershell
git add .
```

If Git says **“Author identity unknown”**, set your name and email once (use the email linked to your GitHub account):

```powershell
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```

Then commit:

```powershell
git commit -m "Initial commit: Top Tier EMS"
```

Add your GitHub repo as `origin` (replace the URL with your own from step 2):

```powershell
git remote add origin https://github.com/YOUR_USERNAME/TOPTIER-EMS.git
```

Push to GitHub:

```powershell
git branch -M main
git push -u origin main
```

If GitHub asks you to sign in, use your GitHub username and a **Personal Access Token** as the password (GitHub no longer accepts account passwords for Git). To create a token: GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token**, enable `repo`, then copy the token and paste it when Git asks for a password.

---

## 4. Use the project on another computer

1. Install **Git** and **Node.js** (LTS) on that computer.
2. Clone the repo (replace the URL with yours):

   ```bash
   git clone https://github.com/YOUR_USERNAME/TOPTIER-EMS.git
   cd TOPTIER-EMS
   ```

3. Install dependencies and add your env file:

   ```bash
   npm install
   ```

   Copy `.env.example` to `.env` and fill in your Supabase URL and anon key:

   - **Windows (PowerShell):** `copy .env.example .env`
   - **Mac/Linux:** `cp .env.example .env`

   Then edit `.env` with your real values (from Supabase Dashboard → Project Settings → API).

4. Run the app:

   ```bash
   npm run dev
   ```

---

## 5. Keep developing and syncing

- **On this computer** after you make changes:

  ```powershell
  git add .
  git commit -m "Short description of what you did"
  git push
  ```

- **On the other computer** before you start working:

  ```bash
  git pull
  ```

Then run `npm run dev` (and `npm install` if you added new packages).

---

## Notes

- **`.env` is not in the repo** (it’s in `.gitignore`) so your Supabase keys stay local. On each new machine you must create `.env` from `.env.example` and add your keys.
- **`node_modules`** is not in the repo; run `npm install` after every clone or pull when dependencies change.
- If you use a **private** repo, the other computer may need to sign in to GitHub (e.g. with the same token) to `git clone` and `git pull`.
