# MEASURE — Garment Annotation Tool

Professional garment measurement annotation for clothing resellers.
Upload a flat-lay photo, click two points per measurement, enter your value, export a spec sheet.

---

## Deploy to Vercel (Free) — Step by Step

### What you need
- A free GitHub account (github.com)
- A free Vercel account (vercel.com)
- Your PhotoRoom API key (photoroom.com/api)
- This project folder on your computer

---

### Step 1 — Put the project on GitHub

1. Go to github.com and sign in
2. Click the **+** button (top right) → **New repository**
3. Name it `measure-app`
4. Leave it **Private**
5. Click **Create repository**
6. GitHub will show you a page with instructions. Follow the "…or upload an existing file" option
7. Drag and drop this entire `measure-app` folder onto the GitHub page
8. Click **Commit changes**

---

### Step 2 — Deploy to Vercel

1. Go to vercel.com and sign in (use your GitHub account to sign in — easiest)
2. Click **Add New Project**
3. Click **Import** next to your `measure-app` repository
4. Leave all settings as default
5. Click **Deploy**

Vercel will build and deploy your app. This takes about 60 seconds.
You will get a live URL like `https://measure-app-xyz.vercel.app`

---

### Step 3 — Add your PhotoRoom API key

This is the most important step. Without it, background removal won't work.

1. In Vercel, go to your project → **Settings** → **Environment Variables**
2. Add a new variable:
   - **Name:** `PHOTOROOM_API_KEY`
   - **Value:** your PhotoRoom API key
   - **Environments:** check Production, Preview, and Development
3. Click **Save**
4. Go to **Deployments** → click the three dots on your latest deployment → **Redeploy**

Background removal will now work automatically when users upload photos.

---

### Step 4 — Set a custom domain (optional but recommended)

1. Buy a domain from Namecheap, GoDaddy, or Google Domains (e.g. `measureapp.co`, `getmeasure.io`)
2. In Vercel → **Settings** → **Domains**
3. Add your domain and follow the DNS instructions

---

## Making Updates

Whenever you want to change something:
1. Edit the files in `src/components/MeasureTool.js` (main app) or `src/app/api/remove-bg/route.js` (PhotoRoom proxy)
2. Upload the changed files to GitHub (drag and drop again, or use GitHub Desktop app)
3. Vercel automatically redeploys within 60 seconds

---

## Project Structure

```
measure-app/
├── src/
│   ├── app/
│   │   ├── layout.js          # Page wrapper, fonts, metadata
│   │   ├── page.js            # Home page
│   │   ├── globals.css        # Global styles
│   │   └── api/
│   │       └── remove-bg/
│   │           └── route.js   # PhotoRoom proxy (server-side, no CORS)
│   └── components/
│       └── MeasureTool.js     # The main app — all the logic lives here
├── .env.local.example         # Copy this to .env.local and add your API key
├── .gitignore                 # Prevents secrets being uploaded to GitHub
├── next.config.js             # Next.js configuration
├── package.json               # Project dependencies
└── README.md                  # This file
```

---

## Environment Variables

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `PHOTOROOM_API_KEY` | PhotoRoom background removal | photoroom.com/api |

**Never put your API key directly in the code or commit it to GitHub.**
Always use environment variables in Vercel's dashboard.

---

## Future Features to Add

- User accounts (add Clerk: clerk.com — free tier, 30 min setup)
- Subscription payments (add Stripe: stripe.com — well documented)
- Saved measurement history
- PDF export
- eBay listing text export

---

## Tech Stack

- **Next.js 14** — React framework
- **Vercel** — Hosting and deployment
- **PhotoRoom API** — Background removal
- **HTML Canvas** — All drawing and annotation

---

Built with ♥ for the reseller community.
