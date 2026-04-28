# Deploy to AWS — Beanstalk + S3 + CloudFront

End-to-end deploy guide. Backend goes on Elastic Beanstalk; both frontends
become static sites in S3 served via CloudFront.

**Final architecture:**
```
Customer browser  ──HTTPS──▶  CloudFront (kiosk distribution)   ──▶  S3 bucket: kiosk-static
Dealer browser    ──HTTPS──▶  CloudFront (dealer distribution)  ──▶  S3 bucket: dealer-static
                                          │
                              CORS-allowed cross-origin AJAX
                                          ▼
                              Elastic Beanstalk environment
                              (Python 3.11 / Amazon Linux 2023)
                                          │
                                          ▼
                              FastAPI app (uvicorn on port 8000)
```

You will need:
- An AWS account with permissions for **EB, EC2, S3, CloudFront, IAM**
- AWS CLI installed: `aws --version`
- EB CLI installed: `pip install awsebcli`
- Region pick — recommend **`ap-south-1`** (Mumbai) for India latency

Total spend at interview-scale traffic: ~₹1,500–2,000/month (~$15–20).
First-year free tier covers most of it.

---

## Part 1 — Deploy the backend to Elastic Beanstalk

### 1.1  AWS CLI setup (one-time)

```bash
aws configure
# AWS Access Key ID:     <paste from IAM>
# AWS Secret Access Key: <paste from IAM>
# Default region name:   ap-south-1
# Default output format: json
```

### 1.2  Initialise Elastic Beanstalk in `backend/`

```bash
cd backend
eb init -p "python-3.11" car-loan-kiosk --region ap-south-1
```

Answer the prompts:
- **Application name:** `car-loan-kiosk` (already set by `-p`)
- **CodeCommit?** No
- **SSH for instance access?** Yes (creates a keypair you can use to SSH in)

This creates a `.elasticbeanstalk/config.yml` (already gitignored).

### 1.3  Create the environment

```bash
eb create car-loan-kiosk-env \
  --instance-type t3.small \
  --region ap-south-1 \
  --elb-type application \
  --platform "Python 3.11" \
  --envvars TTS_PROVIDER=azure
```

This will:
- Spin up a t3.small EC2 (2 vCPU, 2 GB RAM — needed for ChromaDB + onnxruntime)
- Create an Application Load Balancer with HTTPS
- Run `pip install -r requirements.txt`
- Run our `.ebextensions/01_app.config` `container_commands` (which kicks off `prebake_kb.py`)
- Start `uvicorn` per the `Procfile`

Take ~5 minutes. When done, EB prints the environment URL — note it.
Example: `car-loan-kiosk-env.eba-abcdef.ap-south-1.elasticbeanstalk.com`

### 1.4  Set environment variables in the EB console

Go to **AWS Console → Elastic Beanstalk → car-loan-kiosk-env →
Configuration → Updates, monitoring, and logging → Edit → Environment
properties.** Add:

| Key | Value |
|---|---|
| `OPENROUTER_API_KEY` | `sk-or-v1-...` (your fresh key) |
| `OPENROUTER_MODEL` | `x-ai/grok-4.1-fast` |
| `OPENROUTER_REFERER` | `https://github.com/kunala2004/car-loan-kiosk` |
| `OPENROUTER_TITLE` | `Car Loan Kiosk` |
| `AZURE_SPEECH_KEY` | (from Azure portal) |
| `AZURE_SPEECH_REGION` | `centralindia` |
| `AZURE_AVATAR_KEY` | (from Azure portal) |
| `AZURE_AVATAR_REGION` | `southeastasia` |
| `LANGCHAIN_TRACING_V2` | `false` |
| `ALLOWED_ORIGINS` | (set after CloudFront step — see Part 4) |

Click **Apply**. EB will redeploy with the new vars (~2 minutes).

### 1.5  Verify the backend is up

```bash
curl https://YOUR-BEANSTALK-URL.elasticbeanstalk.com/health
# Should return {"status":"ok"}
```

If the first request takes 30+ seconds, the ChromaDB pre-bake hadn't finished
on first deploy — wait a minute and retry.

---

## Part 2 — Deploy the kiosk frontend to S3 + CloudFront

### 2.1  Build the static site

```bash
cd kiosk

# Edit .env.production — replace placeholder with your Beanstalk URL:
#   NEXT_PUBLIC_API_URL=https://car-loan-kiosk-env.eba-abcdef.ap-south-1.elasticbeanstalk.com

npm install         # if you haven't already
npm run build       # produces ./out directory
```

Watch the build log — should complete with "Exporting (X/X)" and no errors.

### 2.2  Create the S3 bucket

```bash
aws s3 mb s3://car-loan-kiosk-static --region ap-south-1
```

(Bucket names must be globally unique — append a random suffix if taken.)

### 2.3  Upload the build

```bash
aws s3 sync out/ s3://car-loan-kiosk-static/ --delete --region ap-south-1
```

### 2.4  Create the CloudFront distribution

In **AWS Console → CloudFront → Create distribution**:

| Setting | Value |
|---|---|
| Origin domain | `car-loan-kiosk-static.s3.ap-south-1.amazonaws.com` |
| Origin access | **Origin access control (OAC)** — let CloudFront create one |
| Default root object | `index.html` |
| Viewer protocol policy | Redirect HTTP to HTTPS |
| Cache policy | CachingOptimized |
| Web Application Firewall (WAF) | Not enabled (for the demo) |

After creation, click **Edit** on the distribution:
- **Behaviors → Default → Edit:** under **Cache key and origin requests** keep `CachingOptimized`. Under **Function associations**, leave none.
- **Error pages → Create custom error response:**
  - HTTP error code: **403**
  - Response page path: `/index.html`
  - HTTP response code: **200**
- Repeat the error response for **404** → `/index.html` → **200**.
  This is the SPA fallback so any unknown path serves the React app, which then routes client-side.

### 2.5  Copy the bucket policy CloudFront gives you

When you set up OAC, CloudFront generates a bucket policy snippet —
**paste it into S3 → car-loan-kiosk-static → Permissions → Bucket policy**.

### 2.6  Wait for CloudFront to deploy (~5 minutes)

When it shows "Deployed", note the distribution domain like
`d1a2b3c4d5e6f7.cloudfront.net`. Open it in a browser — kiosk should load.

---

## Part 3 — Same steps for the dealer portal

```bash
cd dealer-portal

# Edit .env.production — same Beanstalk URL as kiosk
npm install && npm run build

aws s3 mb s3://car-loan-dealer-static --region ap-south-1
aws s3 sync out/ s3://car-loan-dealer-static/ --delete --region ap-south-1
```

Repeat the CloudFront steps from 2.4–2.6 with the dealer bucket. You'll
get a second distribution domain like `d8f9g0h1.cloudfront.net`.

---

## Part 4 — Lock down CORS now that you have the CloudFront URLs

Back in the Beanstalk console (Configuration → Environment properties), set:

```
ALLOWED_ORIGINS = https://d1a2b3c4d5e6f7.cloudfront.net,https://d8f9g0h1.cloudfront.net
```

Apply → 2-minute redeploy. The backend will now only accept requests from
your two CloudFront domains. The regex in `main.py` also matches any
`*.cloudfront.net` URL so this is a sane default.

---

## Part 5 — Updating after code changes

### Backend update
```bash
cd backend
eb deploy
```

Takes ~2 minutes. EB rebuilds, runs the pre-bake script, and rolls out
without downtime.

### Frontend update (kiosk)
```bash
cd kiosk
npm run build
aws s3 sync out/ s3://car-loan-kiosk-static/ --delete

# Bust CloudFront cache so new bundle goes live immediately
aws cloudfront create-invalidation \
  --distribution-id <KIOSK_DISTRIBUTION_ID> \
  --paths "/*"
```

(Same for dealer, swap bucket and distribution id.)

---

## Troubleshooting

### Backend returns 502 / connection refused
Hit `/health` → check CloudWatch logs in EB console (Logs → Request logs).
Common causes:
- ChromaDB OOM on `t3.micro` — upgrade to `t3.small`
- Missing env var (e.g., `OPENROUTER_API_KEY`) — falls back to template, not 502
- Pip install failed — check the `eb-engine.log`

### Frontend loads but API calls 404 / CORS error
- Check the browser console — what URL is it hitting?
- Verify `NEXT_PUBLIC_API_URL` in `.env.production` matches the Beanstalk URL
- Verify `ALLOWED_ORIGINS` on EB includes the CloudFront URL (or remove the var temporarily to allow `*`)

### Dynamic dealer route (`/applications/SOME_ID/`) shows blank
- CloudFront error pages must redirect 403 and 404 → `/index.html` with HTTP 200
- Check S3 bucket policy lets CloudFront read all objects

### CSS or JS missing after deploy
- The `s3 sync --delete` flag must be present (otherwise old files mask new ones)
- CloudFront cache may be stale — invalidate `/*`

---

## Cost-control tips

- **Stop the EB environment when not demoing**: `eb terminate car-loan-kiosk-env`
  (you can recreate later from the same `.elasticbeanstalk/config.yml`)
- S3 + CloudFront cost almost nothing at low traffic
- Free tier: t3.micro is free for 750 hrs/month for first year (but ChromaDB is tight on 1 GB RAM — pre-bake works, sustained traffic might OOM)

---

## What to share with the interviewer

1. **Backend health URL** — `https://YOUR-EB-URL.elasticbeanstalk.com/health`
2. **Customer kiosk** — `https://d1a2b3c4d5e6f7.cloudfront.net/`
3. **Dealer portal** — `https://d8f9g0h1.cloudfront.net/`
4. **API docs** — `https://YOUR-EB-URL.elasticbeanstalk.com/docs`

Demo PAN prefixes `A` / `C` / `E` cover the three flow branches in
`DEMO_CASES.md`. OTP everywhere is `123456`.
