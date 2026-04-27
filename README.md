CareConnect — fixed bundle
Two folders, both ready to install and run.

careconnect-fixed/
├── backend/                  # FastAPI + Vertex Gemini + Twilio media streams
└── care-connect-daily-main/  # TanStack Start (React 19) PWA
The node_modules/, __pycache__/, .pytest_cache/, dist/ and .vite/ directories were stripped before zipping. You'll regenerate them on first install.

Backend
cd backend
pip install -r requirements.txt
pytest                                # 24 tests; should be 24 passing
Required env vars on Cloud Run (set them in your service.yaml or via gcloud run services update):

var	example
GOOGLE_CLOUD_PROJECT	your-gcp-project
FIREBASE_PROJECT_ID	your-gcp-project
GCS_BUCKET_RECORDINGS	careconnect-recordings-prod
TWILIO_ACCOUNT_SID	AC…
TWILIO_AUTH_TOKEN	…
TWILIO_FROM_NUMBER	a real Twilio number — not +10000000000
TWILIO_WEBHOOK_BASE_URL	https://your-cloud-run-url.run.app
SCHEDULER_SHARED_SECRET	random string
Speech defaults are already Serbian (sr-RS for STT/TTS, sr-RS-Standard-A for the voice). Override in env if your project enables Chirp HD voices for sr-RS later.

Seed the demo data:

# Against the Firestore emulator
export FIRESTORE_EMULATOR_HOST=localhost:8080
python -m app.seed.seed_demo_data

# Or against live Firestore (no emulator var)
python -m app.seed.seed_demo_data
Confirm the final log line shows roughly:

seed.done pair=demo_pair_001 pet_drift=0.924 severity=3 flagged_at=…
If severity is anything other than 3, the memory engine isn't flagging — nothing else in the demo will work right.

Run it locally:

uvicorn app.main:app --port 8080 --reload
Frontend
cd care-connect-daily-main
npm install
cp .env.example .env             # then edit VITE_API_BASE_URL
npm run dev                      # http://localhost:8080
npm run build                    # for prod
.env only needs:

VITE_API_BASE_URL=https://your-cloud-run-url.run.app
Demo flow (memorize this)
Sign in as guardian → tap "I want to stay connected with a family member".
Pair: copy the 6-digit code, switch to a second device/incognito, sign in as elder, paste the code.
Dashboard shows Milica Petrović (the seeded elder), today's check-in, 3 quick-nav tiles, recent calls.
Trigger a call from the elder side ("Call Family") — Twilio rings the elder's real phone; AI speaks Serbian.
Open the Memory tab → pet theme already flagged with severity 3, timeline shows the 14 days of seeded answers, last 4 drifting in Serbian.
(Stretch) trigger an emergency: have the "elder" say "Pao sam!" or "Bol u grudima!" — guardian gets an FCM push.
Things to verify on your specific deployment
Polly.Lana Serbian voice is enabled on your Twilio account (otherwise the half-second bridge greeting falls back to a generic voice).
sr-RS-Standard-A is enabled in your Google Cloud TTS project (Standard voices are GA, but the API needs to be enabled in the project).
Web sockets are not stripped by Cloud Run's HTTP/1 upgrade path — they shouldn't be on default Cloud Run gen2, but worth one test call.
Pre-demo checklist
cd backend && pip install -r requirements.txt && pytest — expect 24/24.
Seed against your Firestore. Confirm severity=3 flagged_at=<recent>.
cd care-connect-daily-main && npm install && npm run build — first time this runs is the truth.
Set Cloud Run env vars and deploy.
Set frontend .env VITE_API_BASE_URL.
Place one real Twilio call. If you hear the AI speak Serbian, the orchestrator is wired.
Open the dashboard with the seeded pair: confirm "Milica Petrović", confirm Memory tab shows the flagged pet theme.
Record the backup demo video by hour 12.
Built for GDG Nexus 2026.