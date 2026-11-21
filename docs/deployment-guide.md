# Deployment Guide: from zero to production

All code is complete. This guide collects **every manual step** in the order to do them. Placeholders used throughout:

| Placeholder | Example |
|-------------|---------|
| `<user>` | your GitHub username |
| `<repo>` | `CelebrateMate` |
| App URL | `https://<user>.github.io/CelebrateMate/` |
| Origin | `https://<user>.github.io` (no path) |

Allow about 45–60 minutes. Each step lists what to copy and where it goes.

**Values you will collect**

| Value | Secret? | Goes into |
|-------|---------|-----------|
| App URL | No | OAuth origins (origin part), OneSignal, Script Property `APP_URL` |
| Google OAuth Client ID | No | GitHub Variable `VITE_GOOGLE_CLIENT_ID` + Script Property `GOOGLE_CLIENT_ID` |
| Apps Script `/exec` URL | No | GitHub Variable `VITE_API_BASE_URL` |
| OneSignal App ID | No | GitHub Variable `VITE_ONESIGNAL_APP_ID` + Script Property `ONESIGNAL_APP_ID` |
| OneSignal REST API key | **Yes** | **Only** Script Property `ONESIGNAL_REST_API_KEY` |
| Your Gmail address(es) | Private | **Only** Script Property `ALLOWED_EMAILS` |
| Spreadsheet ID | Private | Not needed (bound script); never commit it |

---

## 1. GitHub repository and Pages (gives you the App URL)

```bash
cd "D:/Coding projects/CelebrateMate"
git init
git add .
git commit -m "CelebrateMate: initial production version"
git branch -M main
git remote add origin https://github.com/<user>/CelebrateMate.git
git push -u origin main
```

1. Create the repo first on github.com: **New repository** → `CelebrateMate`. Make it **public**, because free GitHub Pages needs a public repo. That's safe: the code contains no secrets.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. The first workflow run builds the app, which shows a "Setup required" screen until step 6. Your App URL is `https://<user>.github.io/CelebrateMate/`.

## 2. Google OAuth Client ID (Sign-In)

1. Go to https://console.cloud.google.com → project picker → **New project** (`CelebrateMate`).
2. **APIs & Services → OAuth consent screen** (or *Google Auth Platform → Branding/Audience*):
   - User type **External**. App name `CelebrateMate`, with your email as support and developer contact.
   - Scopes: none extra (Sign-In uses `openid email profile`).
   - **Test users: add your Gmail address(es).** Leaving the app in *Testing* is fine for personal use.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type **Web application**, name `CelebrateMate Web`.
   - **Authorized JavaScript origins:** `https://<user>.github.io`, `http://localhost:5173`, `http://localhost:4173`.
   - Authorized redirect URIs: leave empty.
4. Copy the **Client ID** (`…apps.googleusercontent.com`). You do **not** need the client secret; don't store it anywhere.

## 3. Apps Script backend (Google Sheets API)

1. Open your spreadsheet → **Extensions → Apps Script** → rename the project to `CelebrateMate API`.
2. **Project Settings (⚙)** → tick **Show "appsscript.json" manifest file in editor**.
3. Upload the code with either option:
   - **clasp (recommended):**
     ```bash
     # one-time: enable "Google Apps Script API" at https://script.google.com/home/usersettings
     cd backend
     npx @google/clasp@2.4.2 login
     copy .clasp.json.example .clasp.json        # then paste the Script ID (Project Settings → IDs)
     npx @google/clasp@2.4.2 push --force
     ```
   - **Manual:** replace `appsscript.json` with `backend/src/appsscript.json`. For each of the 19 files in `backend/src/*.gs`, use **+ → Script**, name it without `.gs`, and paste the contents. Delete any default content in `Code.gs` first.
4. **Project Settings → Script properties → Add script property:**

   | Property | Value |
   |----------|-------|
   | `ALLOWED_EMAILS` | your Gmail, e.g. `you@gmail.com` (comma-separate several) |
   | `GOOGLE_CLIENT_ID` | Client ID from step 2 |
   | `APP_URL` | `https://<user>.github.io/CelebrateMate/` |

5. Editor → choose **`setup`** → **Run**. Authorise it: Advanced → *Go to CelebrateMate API (unsafe)* → Allow. This is your own script. The log should show 7 sheets, 3 categories, 18 templates and 7 settings.
6. Run **`runSmokeTest`** (read-only). It prints the dashboard computed from your sheet.
7. **Deploy → New deployment → ⚙ Web app**, with **Execute as: Me** and **Who has access: Anyone** → **Deploy**. Copy the **Web app URL** (`…/exec`).
   - Why "Anyone": the browser calls the API without Google cookies. Access is enforced by the code (a Google ID token for an allowlisted email on every request). The sheet itself stays private.
8. Check it: open the `/exec` URL in a browser and confirm you see `{"ok":true,"data":{"status":"ok",…}}`.

> **Every later backend change** needs a new version, or the old one keeps running: push the code, then **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. The URL stays the same.

## 4. OneSignal (Web Push)

1. Go to https://onesignal.com → sign up → **New App/Website** → name `CelebrateMate` → platform **Web**.
2. Web configuration → **Custom Code**:
   - **Site Name:** CelebrateMate.
   - **Site URL:** `https://<user>.github.io`. This is the origin only, without `/CelebrateMate`.
   - **Default icon URL:** `https://<user>.github.io/CelebrateMate/icons/icon-192.png`.
   - Leave **auto-prompt / slide prompt off**. The app asks for permission only when you tap *Enable notifications*.
   - If the dashboard asks for service worker settings, use path `/CelebrateMate/sw.js` and scope `/CelebrateMate/`. The code also passes these values to the SDK. You do **not** need to download OneSignal's worker files; `sw.js` already imports them.
3. Save, then open **Settings → Keys & IDs**:
   - Copy the **OneSignal App ID**, which is public.
   - Create or copy a **REST API key**. It is **secret**: it goes only into Script Properties.

## 5. Finish backend configuration and install the reminder trigger

1. Add these Apps Script **Script properties**:

   | Property | Value |
   |----------|-------|
   | `ONESIGNAL_APP_ID` | App ID from step 4 |
   | `ONESIGNAL_REST_API_KEY` | REST API key from step 4 |

2. Run **`checkConfiguration`**. Every item should be true or ok. It never prints secret values.
3. Run **`installTriggers`** and authorise the extra "manage triggers" permission. It creates **one trigger that runs `dispatchReminders` every 15 minutes**. In Asia/Kolkata, that sends:
   - **today's** celebrations from **10:00 IST** (retries until 13:00);
   - **tomorrow's** celebrations from **22:00 IST** (retries until 23:59).

   Times are editable in the app's Settings page; no trigger reinstall is needed. Apps Script timing is approximate, so expect each reminder within about 15 minutes of the set time.
4. Check **Triggers (⏰)** in the left bar. There should be exactly one `dispatchReminders` time-driven trigger.

## 6. GitHub repository variables and deploy

1. Repo → **Settings → Secrets and variables → Actions → Variables tab → New repository variable.** Use Variables, not Secrets: these values are public by design.

   | Variable | Value |
   |----------|-------|
   | `VITE_API_BASE_URL` | the `/exec` URL from step 3 |
   | `VITE_GOOGLE_CLIENT_ID` | Client ID from step 2 |
   | `VITE_ONESIGNAL_APP_ID` | App ID from step 4 |

2. **Actions → "Test & deploy to GitHub Pages" → Run workflow**, or push any commit.
3. The workflow runs:
   - backend tests, frontend tests and the typecheck;
   - the build with `VITE_BASE_PATH=/<repo>/`;
   - a check of the PWA files;
   - a check that no mock data is in the build;
   - a simulation of the service worker under your real scope;
   - the deploy.

## 7. Install on your phone and enable notifications

### Android (Chrome)
1. Open the App URL in **Chrome** → **Sign in with Google**.
2. **Install:** Settings page → *Install CelebrateMate*, or Chrome menu ⋮ → **Install app**.
3. Open the app **from the home-screen icon** → **Settings → Enable notifications on this device** → **Allow**.
4. Tap **Send test**. A notification should arrive, including with the app closed.
5. If nothing arrives:
   - Android Settings → Apps → Chrome (or CelebrateMate) → Notifications: on.
   - Battery → Unrestricted.
   - Chrome → Site settings → Notifications → allow the site.

### iPhone / iPad (iOS / iPadOS 16.4 or later)
1. Open the App URL in **Safari** → **Share** → **Add to Home Screen** → Add.
2. Open CelebrateMate **from the Home Screen icon**; web push does not work in a Safari tab. Sign in with Google inside the app. The Home Screen app has its own storage, separate from Safari.
3. **Settings → Enable notifications on this device** → **Allow** → **Send test**.
4. If blocked: iOS **Settings → Notifications → CelebrateMate → Allow Notifications**. Also check Focus modes.
5. If you delete and re-add the Home Screen icon, enable notifications again. A new device row appears, and the old one is deactivated automatically when OneSignal reports it invalid.

### Desktop (Chrome / Edge)
- Use the install icon in the address bar, then the same Settings → Enable notifications flow.

## 8. Go-live verification

Do this once on the deployed URL. It covers the audit items that need real accounts and devices.

- [ ] App URL loads. Sign-in works. A non-allowlisted Google account sees "not allowed".
- [ ] Add, edit, deactivate and reactivate a contact; confirm the row changes in the **Contacts** sheet.
- [ ] Settings → change the 29 Feb rule; the calendar for Feb/Mar of a non-leap year updates.
- [ ] Dashboard → WhatsApp icon on a celebration → pick each of the 3 templates → edit → **Open WhatsApp**. The chat opens with the exact text, including emoji and line breaks. Back in the app, **Mark as sent** → the **History** sheet row shows `MARKED_SENT` with both `openedAt` and `markedSentAt`.
- [ ] Templates → preview, edit, deactivate (the last active one in a group is refused), add a new one.
- [ ] Android and iPhone: installed app opens full screen with the gift icon.
- [ ] Enable notifications → **Send test** → arrives with the app **closed** → the **Devices** and **NotificationLogs** sheets have rows.
- [ ] Airplane mode → open the installed app: the shell opens and shows "You're offline".
- [ ] Add a test contact whose birthday is today. Run `runSameDayReminderNow` in Apps Script → one aggregated push arrives. Run it again → `ALREADY_PROCESSED`, and no second push.
- [ ] The next morning after 10:00 IST, check NotificationLogs for the scheduled run.
- [ ] DevTools → Application → Service Workers: scope `https://<user>.github.io/CelebrateMate/`, one worker (`sw.js`). Cache Storage holds only `celebratemate-shell-*` with app files, no API data.

## 9. Updating later

| Change | How |
|--------|-----|
| Frontend code | Push to `main`; Actions redeploys and the service worker updates on the next app open. |
| Backend code | `cd backend && npm test && npx @google/clasp@2.4.2 push`, then **Manage deployments → New version**. |
| Default template text | Edit `frontend/src/data/defaultTemplates.ts` → `cd backend && npm run sync:templates`. Re-run `setup()` to add new IDs; existing rows are never overwritten. |
| Rotate the OneSignal key | Create a new key in OneSignal → update the Script Property → revoke the old one. |
| Add or remove an allowed user | Edit `ALLOWED_EMAILS` (and the OAuth test users list). |

## 10. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| "Setup required" screen | GitHub Variables missing. Set them (step 6) and re-run the workflow. |
| Google button shows "origin not allowed" / error 400 | Add `https://<user>.github.io` to the OAuth client's Authorized JavaScript origins (step 2). Changes can take a few minutes. |
| "Sign-in was issued for a different app" | `GOOGLE_CLIENT_ID` Script Property ≠ `VITE_GOOGLE_CLIENT_ID`. |
| "This Google account is not allowed" | Add the email to `ALLOWED_EMAILS` (lower-case is fine). |
| "Server is missing the Script Property …" / `NOT_CONFIGURED` | Add the named Script Property; run `checkConfiguration`. |
| Network error / CORS error in the console | `VITE_API_BASE_URL` must be the **/exec** URL (not /dev), and the deployment must have access **Anyone**. Redeploy a new version after code changes. |
| "Sheet … is missing. Run setup()" | Run `setup()` in the Apps Script editor. |
| Enable notifications → "add to Home Screen first" | You're in a Safari tab on iOS; open the Home Screen app. |
| Test says accepted but nothing arrives | Check OS / app notification permissions, battery optimisation and Focus modes. OneSignal → Delivery shows per-notification stats. Delivery is never guaranteed. |
| Reminders not arriving | Triggers page: exactly one `dispatchReminders`. Check Executions for errors. NotificationLogs shows `SKIPPED` (reminders turned off / no devices) or `FAILED` (with the error). |
| Local Windows build has broken paths | In Git Bash use `MSYS_NO_PATHCONV=1 VITE_BASE_PATH=/CelebrateMate/ npm run build`. |
