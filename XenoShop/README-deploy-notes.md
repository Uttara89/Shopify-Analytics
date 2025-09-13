This file documents safe steps to regenerate the frontend build, fix common Windows `npm ci` issues (EPERM on native addons), and stop committing built artifacts.

1) Set the backend URL (build-time)
- Ensure `VITE_BACKEND_BASE_URL` points to your deployed backend.
- For local builds, edit `XenoShop/.env` (already present) and set:

  VITE_BACKEND_BASE_URL=https://shopify-analytics-9.onrender.com

  Note: Vite injects `VITE_` prefixed env vars at build time only.

2) Fix EPERM / locked-file errors on Windows before `npm ci`
- Close editors or terminals that might be holding node processes.
- Open an elevated PowerShell (Run as Administrator) and try:

```powershell
# Stop node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Remove the locked native file (example path in case of @tailwindcss/oxide)
Remove-Item -LiteralPath "$PWD\node_modules\@tailwindcss\oxide-win32-x64-msvc\tailwindcss-oxide.win32-x64-msvc.node" -Force -ErrorAction SilentlyContinue

# If delete fails, rename node_modules as a fallback
Rename-Item -Path "$PWD\node_modules" -NewName "node_modules.old" -ErrorAction SilentlyContinue

# Then clear cache and install
npm cache verify; npm ci
```

- If you still see `EPERM` after the above, reboot or use Sysinternals Process Explorer to find the handle keeping the file open.

3) Rebuild the frontend (after `npm ci` succeeds)

```powershell
cd XenoShop
npm ci
npm run build
```

- After the build completes, verify the build does not contain `localhost:3000`:

```powershell
Select-String -Path .\dist\**\* -Pattern 'localhost:3000' -SimpleMatch -NotMatch
```

4) Remove committed built artifacts from git (recommended)
- If `deployed-js.txt` or other build files are committed, remove them from the repository and add to `.gitignore` (already added).

```powershell
# Create backup first
Copy-Item .\deployed-js.txt .\deployed-js.txt.bak -Force

# Remove from git history (simple approach: stop tracking and commit)
git rm --cached XenoShop/deployed-js.txt
git commit -m "chore: remove committed build artifact deployed-js.txt"
```

- If you need to remove the file from history (optional, rewriting history): use `git filter-repo` or `git filter-branch` carefully.

5) Render deployment settings (Static Site)
- Root: the `XenoShop` folder.
- Build Command: `npm ci; npm run build`
- Publish Directory: `dist`
- Environment variables: add `VITE_BACKEND_BASE_URL=https://shopify-analytics-9.onrender.com` in Render's dashboard (so builds on Render embed the correct backend URL).
- SPA fallback: Render serves a 404 for client-side routes; ensure `public/200.html` exists (already added) or enable single-page app fallback in Render.

6) Quick checklist
- [ ] `VITE_BACKEND_BASE_URL` set locally and on Render
- [ ] `npm ci` completes successfully (no EPERM)
- [ ] `npm run build` produces `dist/` without `localhost:3000`
- [ ] `deployed-js.txt` removed from git and added to `.gitignore`
- [ ] Deploy to Render using the settings above

If you want, I can attempt the `git rm --cached` removal for `deployed-js.txt` and commit the `.gitignore` change for you, or run the local rebuild steps if you want me to run the commands now.