# Assessment Management System

## What is This?

A static web app (HTML/CSS/JS) that provides:

1. **Unified login** (`index.html`) — one sign-in page for everyone  
   - **Admin** → gets the full distribution tool: create exams, manage centers/supervisors, configure labs & rounds  
   - **Supervisor** → automatically redirected to the supervisor portal  
2. **Supervisor Portal** (`supervisor.html`) — each center supervisor can:
   - View their center's examinees  
   - Scan QR codes to take attendance  
   - See attendance reports  
   - Print admission cards with QR codes  

**No backend required.** Everything runs in the browser. The database and login are handled by **Supabase** (free tier). Hosting is on **Render.com** (free tier).

---

## Project Structure

```
/
├── index.html              # Admin tool (login + distribution + supervisor management)
├── admin.html              # (Optional) Standalone admin portal
├── supervisor.html         # Supervisor portal (login + dashboard)
├── admission-card.html     # Printable admission cards (auth required)
├── js/
│   ├── config.js           # ← YOUR Supabase URL + key go here
│   ├── admin.js            # Standalone admin portal logic
│   ├── app.js              # Supervisor app logic
│   ├── auth.js             # Login / logout
│   ├── dashboard.js        # Examinee list + reports
│   ├── attendance.js       # QR camera scanning
│   └── admission-card.js   # QR code generation
├── css/
│   └── supervisor.css      # Portal styles
├── supabase/
│   ├── schema.sql          # Creates database tables
│   ├── rls.sql             # Security policies
│   ├── admin-schema.sql    # Admin table + admin RLS policies
│   └── seed.sql            # Sample data
└── README.md
```

---

# Step-by-Step Setup Guide

Follow these steps in order. Total time: ~20 minutes.

---

## Step 1: Create a GitHub Repository

You need your code on GitHub so Render can deploy it.

1. Go to [github.com](https://github.com) → sign in (or create an account).
2. Click the **+** button (top-right) → **New repository**.
3. Name it something like `assessment-management-system`.
4. Set it to **Public** (Render free tier requires public repos).
5. Click **Create repository**.
6. **Don't close this page** — you'll need the commands shown.

Now open a terminal in your project folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/lazytitan21/assessment-management-system.git
git push -u origin main
```

> Replace `YOUR_USERNAME` with your actual GitHub username.

---

## Step 2: Set Up Supabase (Free Database + Login)

### 2A — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → click **Start your project** → sign in with GitHub.
2. Click **New Project**.
3. Fill in:
   - **Name:** `assessment-system` (or anything you like)
   - **Database Password:** pick a strong password (save it somewhere!)
   - **Region:** choose the closest to you
4. Click **Create new project** → wait ~1 minute for it to set up.

### 2B — Disable email confirmation

This is required so the admin can create supervisor accounts instantly.

1. In Supabase, go to **Authentication** (left sidebar) → **Sign In / Providers** (under CONFIGURATION).
2. Click on the **Email** provider row to expand it.
3. Find the **"Confirm email"** toggle and **turn it OFF**.
4. Click **Save**.

> Without this, new supervisors would need to click a confirmation email before they can log in.

### 2C — Create the database tables

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open the file `supabase/schema.sql` from your project, **copy its entire contents**, paste into the SQL editor, and click **Run**.
4. You should see "Success. No rows returned." — this means tables were created.
5. Click **New query** again.
6. Open `supabase/rls.sql`, copy its entire contents, paste, and click **Run**.
7. Click **New query** again.
8. Open `supabase/admin-schema.sql`, copy its entire contents, paste, and click **Run**.
9. *(Optional)* Do the same with `supabase/seed.sql` to insert sample data.

### 2D — Get your API keys

1. In Supabase, go to **Settings** (gear icon, left sidebar) → **API**.
2. You'll see two things you need:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public key** — a long string starting with `eyJ...`
3. Open `js/config.js` in your project and replace the placeholders:

```js
window.SUPABASE_URL      = 'https://abcdefgh.supabase.co';   // ← paste YOUR Project URL
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIs...';       // ← paste YOUR anon key
```

4. **Save the file.**

> The `anon` key is safe to put in frontend code — it can only do what your security policies allow. **Never** use the `service_role` key in frontend code.

### 2E — Create your Admin account

This is a one-time setup. The admin can then manage everything from `index.html`.

1. Go to **Authentication** (left sidebar) → **Users** tab.
2. Click **Add user** → **Create new user**.
3. Enter:
   - **Email:** your admin email (e.g. `admin@example.com`)
   - **Password:** a strong password
   - Check **Auto Confirm User**
4. Click **Create user**.
5. **Copy the User UID** shown in the users list (a UUID like `f5e6d7c8-...`).

Now register this user as an admin:

6. Go to **SQL Editor** → **New query** → paste this (replace the values):

```sql
INSERT INTO admins (user_id, full_name, email) VALUES
    ('PASTE-THE-USER-UID-HERE', 'Your Name', 'admin@example.com');
```

7. Click **Run**.

> Only this one admin needs to be created manually. After that, use `index.html` to manage supervisors, centers, and exam distribution — no SQL needed!

### 2F — Add supervisors (from the main tool)

Once deployed (Step 3), or running locally:

1. Open `index.html` in your browser and log in with the admin email/password from Step 2E.
2. Click the **👥 Supervisors** button in the header.
3. In the popup, fill in the supervisor's name, email, password, and center.
4. Click **Add** — the supervisor account is created instantly.
5. The supervisor can now log in at `supervisor.html` with the email/password you assigned.

> You can add or remove supervisors at any time from within `index.html`.

### 2G — Add examinees

**Option A — One by one (SQL Editor):**

```sql
INSERT INTO examinees (center_id, full_name, national_id, exam_session) VALUES
    ('PASTE-CENTER-ID', 'Ali Mohammed', '784-1990-1234567-1', '2026-02-19'),
    ('PASTE-CENTER-ID', 'Fatima Hassan', '784-1992-7654321-2', '2026-02-19');
```

> The `attendance_code` (used for QR) auto-generates. You don't need to set it.

**Option B — CSV import (for many examinees):**

1. Create a CSV file with this format:

```csv
center_id,full_name,national_id,exam_session
a1b2c3d4-...,Ali Mohammed,784-1990-1234567-1,2026-02-19
a1b2c3d4-...,Fatima Hassan,784-1992-7654321-2,2026-02-19
```

2. In Supabase → **Table Editor** → **examinees** → click **Import data via CSV**.
3. Upload your CSV file.

### 2H — Set up Auth redirect URLs

1. In Supabase → **Authentication** → **URL Configuration**.
2. Set **Site URL** to: `https://YOUR-APP-NAME.onrender.com/supervisor.html`
3. Under **Redirect URLs**, add:
   - `http://localhost:5500/supervisor.html`
   - `https://YOUR-APP-NAME.onrender.com/supervisor.html`

> You'll get the Render URL in the next step. Come back to update this after deploying.

---

## Step 3: Deploy to Render.com (Free Hosting)

### 3A — Push your config changes

After editing `js/config.js` (Step 2D), push to GitHub:

```bash
git add .
git commit -m "Add Supabase config"
git push
```

### 3B — Create a Render static site

1. Go to [render.com](https://render.com) → sign up (you can use your GitHub account).
2. Click **New** → **Static Site**.
3. Click **Connect a repository** → authorize GitHub → select your `assessment-management-system` repo.
4. Fill in the settings:

| Setting | What to enter |
|---------|---------------|
| **Name** | `assessment-management-system` (or anything) |
| **Branch** | `main` |
| **Build Command** | *leave completely empty* |
| **Publish Directory** | `.` (just a dot) |

5. Click **Create Static Site**.
6. Wait 1-2 minutes for it to deploy.

### 3C — Get your live URL

After deploy finishes, Render shows your URL at the top, like:

```
https://assessment-management-system.onrender.com
```

### 3D — Update Supabase with the Render URL

Go back to **Supabase → Authentication → URL Configuration** and:

1. Set **Site URL** to `https://YOUR-APP.onrender.com/supervisor.html`
2. Add `https://YOUR-APP.onrender.com/supervisor.html` to **Redirect URLs**

---

## Step 4: Test Everything

### Test the unified login
- Visit `https://YOUR-APP.onrender.com/` → you should see a sign-in screen
- **Sign in as admin** (email/password from Step 2E) → the distribution tool loads
  - Click **👥 Supervisors** in the header to manage supervisors
  - Use the tool to configure centers, labs, rounds, and distribute examinees
- **Sign in as supervisor** (email/password created in Step 2F) → automatically redirected to the supervisor portal

### Test the supervisor portal
- Visit `https://YOUR-APP.onrender.com/supervisor.html`
- Sign in with the email + password you created in Step 2F
- You should see:
  - Your center name in the header
  - Examinee list for your center
  - Reports tab with attendance stats
  - Take Attendance tab with camera scanner
  - Admission Cards tab with printable QR cards

### Test QR scanning
1. Go to **Admission Cards** tab → click **Print All Cards** or view a single card
2. You'll see each examinee card with a QR code
3. Go to **Take Attendance** tab → click **Start Camera**
4. Point your camera at one of the QR codes
5. You should see a green "Attendance Registered" confirmation

---

## How QR Attendance Works

- Each examinee has a unique `attendance_code` (auto-generated UUID)
- The QR code on their admission card contains this code
- When scanned:
  - **Green (success):** attendance registered with timestamp
  - **Yellow (duplicate):** this person was already scanned for this session
  - **Red (invalid):** code doesn't exist or belongs to another center
- Supervisors can only scan examinees from their own center (security enforced)
- Duplicate scans are blocked automatically

---

## Local Development (Optional)

If you want to test locally before deploying:

1. Make sure `js/config.js` has your Supabase credentials.
2. Open a terminal in the project folder and run:

```bash
# Using Python:
python -m http.server 5500

# OR using Node.js:
npx serve .
```

3. Open `http://localhost:5500/supervisor.html` in your browser.

> **Tip:** In VS Code, install the **Live Server** extension, right-click `supervisor.html` → **Open with Live Server**.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **"Supervisor profile not found"** after login | You need to insert a row in the `supervisors` table linking the Auth user UUID to a center (Step 2E) |
| **Camera doesn't open** | Camera requires HTTPS (works on Render) or `localhost`. Regular HTTP won't work |
| **"Invalid code"** when scanning | The QR must contain exactly the `attendance_code` from the database. Make sure you're scanning a card from your center |
| **Blank page after login** | Open browser DevTools (F12) → Console tab. Check for errors. Most likely `config.js` has wrong Supabase URL or key |
| **"duplicate key" error** | This is correct behavior — the examinee was already scanned for this session |
| **Can't see examinees** | Make sure examinees are assigned to the same `center_id` as your supervisor |
| **Render shows old version** | Push to GitHub (`git push`). Render auto-deploys within 1-2 minutes |

---

## Security Notes

- Each supervisor can ONLY see their own center's data — enforced by Row Level Security (RLS) in the database
- The `anon` key in `config.js` is designed to be public — it can only access data that RLS allows
- The `service_role` key (visible in Supabase dashboard) must NEVER be in your code
- Attendance records include who scanned and when, for audit purposes
- Duplicate attendance per session is automatically prevented

---

## License

Created by **Eng. Firas Kiftaro** — Assessment Management System © 2025-2026
