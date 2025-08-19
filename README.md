
# Training & Certification Tracker

Free, single-user dashboard to track trainings and expirations. Data is stored locally in your browser (export/import CSV for backups).

## Run locally
```bash
npm install
npm run dev
```

## Deploy free to GitHub Pages
1) Create a GitHub repo (e.g., `training-tracker`).  
2) Commit & push:
```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/<you>/training-tracker.git
git push -u origin main
```
3) Enable Pages: Settings → Pages → Source: **GitHub Actions**.  
4) This repo already has `.github/workflows/pages.yml`. Push to `main` to deploy.
