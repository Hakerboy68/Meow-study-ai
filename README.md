# ⚡ NeuralStudy — Production Deploy Guide

## 🔐 Security Architecture

```
User Browser
     │
     │  POST /.netlify/functions/ai
     ▼
Netlify Function (ai.js)        ← Your API key lives HERE only
     │
     │  Authorization: Bearer $GROQ_API_KEY
     ▼
Groq API (llama-3.3-70b)
```

**Your API key is NEVER in the frontend code or browser.**

---

## 🚀 Deploy in 5 Minutes

### Step 1 — Push to GitHub (recommended for startups)
```bash
git init
git add .
git commit -m "Initial NeuralStudy deploy"
git remote add origin https://github.com/YOUR_USERNAME/neuralstudy.git
git push -u origin main
```

### Step 2 — Connect to Netlify
1. Go to [app.netlify.com](https://app.netlify.com)
2. **"Add new site"** → **"Import from Git"**
3. Select your GitHub repo
4. Build settings:
   - **Publish directory:** `.`
   - **Functions directory:** `netlify/functions`
5. Click **Deploy**

### OR — Drag & Drop Deploy
1. Unzip this folder
2. Go to [app.netlify.com](https://app.netlify.com)
3. Drag the `neuralstudy-prod` folder onto the dashboard

---

## 🔑 Step 3 — Add Your Groq API Key (CRITICAL)

1. In Netlify → your site → **"Site configuration"**
2. **"Environment variables"** → **"Add a variable"**
3. Add:
   ```
   Key:   GROQ_API_KEY
   Value: gsk_your_actual_key_here
   ```
4. **"Save"**
5. Go to **Deploys** → **"Trigger deploy"** → **"Deploy site"**

Get your key at: [console.groq.com](https://console.groq.com) (free)

---

## 📁 File Structure

```
neuralstudy-prod/
├── index.html                   ← App UI (no secrets)
├── netlify.toml                 ← Netlify config
├── netlify/
│   └── functions/
│       └── ai.js                ← 🔐 Secure API proxy
├── css/
│   ├── base.css
│   ├── themes.css
│   ├── animations.css
│   ├── components.css
│   ├── layout.css
│   └── pages.css
└── js/
    ├── api.js                   ← Calls proxy (no key)
    ├── state.js
    ├── ui.js
    ├── auth.js
    ├── theme.js
    ├── navigation.js
    ├── doubt.js
    ├── dictation.js
    ├── papers.js
    ├── speech.js
    ├── analytics.js
    └── app.js
```

---

## ✅ What's Free

| Service       | Free Tier                              |
|---------------|----------------------------------------|
| Netlify Host  | Unlimited static, 125k fn calls/month |
| Netlify Fns   | 125,000 invocations/month free         |
| Groq API      | Free tier, very generous rate limits   |
| Custom Domain | Add in Netlify → Domain Management     |

---

## 🔒 Production Security Checklist

- [x] API key stored as Netlify environment variable
- [x] API key never in frontend JS/HTML
- [x] All requests go through backend proxy
- [x] Security headers set (XSS, clickjacking protection)
- [x] CORS handled by proxy function
- [ ] Add rate limiting (upgrade netlify.toml when ready)
- [ ] Add user auth (Netlify Identity or Supabase)
- [ ] Add your custom domain in Netlify settings
