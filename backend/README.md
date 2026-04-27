# CareConnect Backend

CareConnect is an AI guardian that places scheduled phone calls to elderly
users on behalf of their adult children. Each call is a warm, personalized
conversation conducted by an LLM agent that confirms medications, asks
personalized questions, and over time detects mood and memory drift. This
repository is the FastAPI backend deployed on Cloud Run, with all AI/ML
running on Google Cloud (Vertex AI Gemini 2.5 Flash, Speech-to-Text v2
`chirp_2`, Cloud TTS Chirp 3 HD, Cloud Natural Language) and Twilio used
purely as the audio wire.

## Architecture

```
                        ┌──────────────────────┐
                        │  Cloud Scheduler     │
                        │  (every 1 minute)    │
                        └──────────┬───────────┘
                                   │ POST /scheduler/tick
                                   ▼
 ┌────────────┐   POST /calls/    ┌─────────────────────────────────┐
 │ Guardian   ├──── trigger ─────►│  FastAPI on Cloud Run           │
 │ mobile app │                   │  (europe-west3, Frankfurt)      │
 └─────┬──────┘                   │                                 │
       │ CRUD + reports            │  • routes/                     │
       ▼                           │  • pipelines/call_orchestrator │
 ┌────────────┐                    │  • services/{stt,tts,gemini,   │
 │ Firestore  │◄───────────────────┤    embeddings,sentiment,fcm}   │
 │ (eur3)     │                    │  • memory_engine               │
 └────────────┘                    └────┬───────────┬───────────────┘
                                       │ wss        │ HTTPS
                                       ▼            ▼
                                ┌─────────────┐  ┌──────────────────┐
                                │ Twilio      │  │ Vertex AI / STT  │
                                │ Media       │  │ TTS / NL (eu     │
                                │ Streams     │  │ multi-region)    │
                                └─────┬───────┘  └──────────────────┘
                                      │ PSTN / WebRTC
                                      ▼
                                ┌─────────────┐
                                │ Elder phone │
                                └─────────────┘
```

## Local development

Prerequisites: Python 3.11, [Firebase CLI](https://firebase.google.com/docs/cli), and (optionally) [`ngrok`](https://ngrok.com) for live Twilio testing.

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env — for local dev with NO external services you can leave the
# placeholders in place; the test/seed flows do not require real keys.

# 2. Install deps
make install

# 3. (Terminal A) Start the Firestore emulator
make emulator
# → exposes Firestore at localhost:8080

# 4. (Terminal B) Tell the app to use the emulator and seed demo data
export FIRESTORE_EMULATOR_HOST=localhost:8080
make seed

# 5. Run the API server
export FIRESTORE_EMULATOR_HOST=localhost:8080
make dev      # uvicorn with reload, listens on :8080
# → curl http://localhost:8080/healthz

# 6. (Optional) Tunnel for live Twilio webhooks
make twilio-tunnel
# Copy the https URL from ngrok into TWILIO_WEBHOOK_BASE_URL in .env, AND
# into your Twilio number's "A CALL COMES IN" webhook (POST .../twilio/voice).
```

> Note: when both `make emulator` and `make dev` would bind to port 8080, run
> the emulator on its default port and pass `PORT=8081 make dev` for the API.

## API keys checklist

Every variable below lives in `.env.example` as a placeholder. Fill them in
`.env` for local dev or via `gcloud run deploy --set-env-vars=...` for prod.

| Env var | Where to obtain |
|---|---|
| `GOOGLE_CLOUD_PROJECT` | The GCP project ID (Console → Home). |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to a service-account JSON. Console → IAM → Service Accounts → create with roles `roles/datastore.user`, `roles/aiplatform.user`, `roles/speech.client`, `roles/cloudtts.user`, `roles/storage.objectAdmin`, `roles/firebasecloudmessaging.admin`. |
| `VERTEX_AI_LOCATION` | Use `eu` (multi-region). See "EU deployment notes" below. |
| `TTS_ENDPOINT_REGION` / `STT_ENDPOINT_REGION` | Use `eu`. Chirp 3 HD voices and `chirp_2` STT need the `eu` multi-region endpoint, not a single region like `europe-west3`. |
| `CLOUD_RUN_REGION` | `europe-west3` (Frankfurt) — closest to Belgrade. |
| `FIRESTORE_LOCATION` | `eur3` — created once when you provision Firestore in the console. |
| `GEMINI_MODEL` | `gemini-2.5-flash`. |
| `EMBEDDING_MODEL` | `text-embedding-004`. |
| `FIREBASE_PROJECT_ID` | Firebase Console → Project settings. |
| `GCS_BUCKET_RECORDINGS` | A bucket you create with location `EU`: `gsutil mb -l EU gs://careconnect-recordings-<your-suffix>`. |
| `STT_MODEL` / `STT_LANGUAGE` | Defaults `chirp_2` / `en-US` per spec. |
| `TTS_VOICE` / `TTS_LANGUAGE` | Defaults `en-US-Chirp3-HD-Aoede` / `en-US`. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Twilio Console → Account dashboard. |
| `TWILIO_FROM_NUMBER` | A provisioned **European** Twilio number (Twilio Console → Phone Numbers → Buy a Number → DE/UK/etc.). |
| `TWILIO_WEBHOOK_BASE_URL` | Your Cloud Run URL (or `ngrok` URL during local dev). |
| `JWT_REQUIRED` | `true` in production. `false` for local dev to skip Firebase ID token verification. The app will refuse to boot if you set `false` while `APP_ENV=production`. |
| `SCHEDULER_SHARED_SECRET` | Any random string. Set the same value in the `X-Scheduler-Secret` header from your Cloud Scheduler job. |
| `APP_ENV` | `development` for local, `production` for Cloud Run. |
| `LOG_LEVEL` | `INFO` is the default; `DEBUG` for verbose call-pipeline tracing. |
| `PORT` | `8080`. Cloud Run injects this; default is fine. |
| `FIRESTORE_EMULATOR_HOST` | `localhost:8080` only in local dev. Leave unset in production. |

## Triggering a demo call by hand

```bash
# With JWT_REQUIRED=false you can use the dev-mode bearer format:
curl -X POST http://localhost:8080/calls/trigger \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer uid:demo_guardian_uid" \
  -d '{"pairId": "demo_pair_001"}'
```

If Twilio creds are configured AND your `TWILIO_WEBHOOK_BASE_URL` is reachable
(via ngrok or Cloud Run), Twilio will place a real call to the elder's phone
number. With creds blank, `start_call` chooses a channel, writes a `calls`
doc, and returns immediately — useful for inspecting the flow.

To exercise the scheduler endpoint:

```bash
curl -X POST http://localhost:8080/scheduler/tick \
  -H "X-Scheduler-Secret: $SCHEDULER_SHARED_SECRET"
```

## EU deployment notes

We are deploying from Belgrade and call elderly users primarily in Europe.
Latency on the audio path matters more than any other tweak.

- **Vertex AI / STT / TTS endpoint = `eu`.** Chirp 3 HD voices and the
  `chirp_2` STT model are only available via the multi-region `eu` endpoint
  (not single regions like `europe-west3`). The `eu` endpoint routes to the
  nearest healthy European region — typically Frankfurt — giving us low
  latency without the Chirp model availability problem.
- **Cloud Run region = `europe-west3` (Frankfurt).** Closest to both the
  Vertex `eu` regional endpoint and the demo location. Set with
  `--region=europe-west3`.
- **Firestore = `eur3` multi-region.** Create your Firestore database with
  this location once at project setup; you cannot change it later.
- **GCS = location `EU` (multi-region).** `gsutil mb -l EU gs://...`.
- **Twilio: provision a European number AND set the Voice Edge Location to
  `frankfurt`.** Twilio Console → Voice → Settings → General → "Edge
  Location" → `frankfurt`. This single setting eliminates ~150ms of
  trans-Atlantic round-trip per audio frame and matters more than any other
  latency tweak.

## Cloud Scheduler

Provision one job that hits `/scheduler/tick` every minute:

```bash
gcloud scheduler jobs create http careconnect-tick \
  --schedule="* * * * *" \
  --uri="https://<your-cloud-run-url>/scheduler/tick" \
  --http-method=POST \
  --headers="X-Scheduler-Secret=<value of SCHEDULER_SHARED_SECRET>" \
  --location=europe-west3 \
  --time-zone=UTC
```

The endpoint internally walks all `/schedules` documents and matches their
`callTime` (HH:MM, in the **elder's** timezone) against the current minute,
within a 1-minute window. Multiple Scheduler invocations within the same
minute are safe — `start_call` writes a single `calls` doc and `pre-creates`
its ID so duplicate triggers would just produce two short attempts rather
than a corrupted state.

## Tests

```bash
pytest                    # passes with ZERO real API keys
```

The test suite mocks every external service (Twilio, Vertex AI, STT, TTS, NL,
FCM) and uses an in-memory Firestore fake. The memory-engine tests exercise
the full algorithm with deterministic hash-based "embeddings" so the drift
flag fires reproducibly.

If you want to test against the real Firestore emulator instead of the
in-memory fake, set `FIRESTORE_EMULATOR_HOST=localhost:8080` before running
`pytest`.

## Deploying to Cloud Run

```bash
make deploy
# or
gcloud run deploy careconnect-api \
  --source . \
  --region=europe-west3 \
  --allow-unauthenticated \
  --set-env-vars="APP_ENV=production,VERTEX_AI_LOCATION=eu,STT_ENDPOINT_REGION=eu,TTS_ENDPOINT_REGION=eu,..."
```

Then point your Twilio number's "A CALL COMES IN" webhook at
`https://<cloud-run-url>/twilio/voice`.

## Known limitations / shortcuts

These are the places where the implementation diverges from the original
spec, plus one or two known stubs:

- **STT 60-second stream limit (spec)** — Speech-to-Text v2 streaming with
  `chirp_2` allows much longer sessions than 60 seconds in current API
  releases. The orchestrator still treats stream disconnects as recoverable
  events (it spawns a fresh `StreamingSTT` if the underlying thread exits),
  so the rotation logic is also useful as a generic resilience feature.
- **Regional STT/TTS endpoints (`eu-speech.googleapis.com` /
  `eu-texttospeech.googleapis.com`)** — The code uses the prompt's exact
  pattern (`{REGION}-speech.googleapis.com`). If a Chirp 3 HD voice returns
  `NOT_FOUND` from the `eu` endpoint at deploy time (Google sometimes
  reshuffles voice availability across endpoints), swap `STT_ENDPOINT_REGION`
  / `TTS_ENDPOINT_REGION` to a single region or to `global`. No code change
  needed.
- **`audioop`** — Used for μ-law ↔ PCM16 codec and 8 ↔ 16 kHz resampling.
  Available in Python 3.11 (deprecated in 3.13). Pinning 3.11 in the
  Dockerfile keeps us safe; if we ever bump to 3.13 we'll need a pure-Python
  μ-law replacement (e.g., `g711`).
- **TTS streaming** — Cloud TTS Chirp 3 HD streaming (`BidiSynthesizeSpeech`)
  is not yet GA in all regions, so we synthesize per-sentence with
  `synthesize_speech` and chunk the output to Twilio in 20ms frames. This
  gives "near-streaming" perceptual latency. When the bidi surface goes GA,
  swap in `synthesize_streaming` for true token-time streaming.
- **Signed-URL recording** — The `recordingUrl` field is wired through, but
  we don't currently capture call audio to GCS during the call. The Twilio
  Media Streams payloads pass through us, so adding this is a few lines in
  the orchestrator: write the inbound μ-law buffer to a GCS upload session
  and stash the path on the call doc.
- **Med-confirmation matching in `post_call.finalize`** — We match a user
  turn to a question theme by simple keyword overlap. A future improvement
  is to ask the orchestrator to track which question was being asked at
  each user turn (the data is in the transcript order today) and pass that
  structured map into `finalize`.
- **Embeddings in tests + seed** — Both use deterministic hash vectors
  instead of calling Vertex. This makes seed runs free and tests
  reproducible. Production code path uses `services.embeddings.embed`
  through `memory_engine.default_deps()`.
- **FCM with no token** — If the guardian's user doc has no `fcmToken`,
  notifications are silently skipped (and logged). The mobile app is
  expected to register the token via `POST /presence`.
- **Firestore security rules** — Not in this repo (this is the backend).
  All write paths verify `auth.uid in pair.members`, and the recommended
  Firestore rules enforce the same on the client side.

## File tree

```
backend/
├── README.md                                 (you are here)
├── pyproject.toml
├── requirements.txt
├── Dockerfile
├── Makefile
├── .env.example
├── .gitignore
├── .dockerignore
├── app/
│   ├── __init__.py
│   ├── main.py                              # FastAPI app
│   ├── config.py                            # pydantic-settings
│   ├── deps.py                              # FastAPI dependencies
│   ├── logging_config.py                    # structured JSON logs
│   ├── schemas/                             # pydantic models per Firestore doc type
│   │   ├── users.py · pairs.py · schedules.py
│   │   ├── questions.py · medications.py
│   │   ├── calls.py · memory.py
│   ├── routes/                              # FastAPI routers
│   │   ├── health · pairing · schedule
│   │   ├── questions · medications · calls
│   │   ├── twilio_webhooks · reports
│   │   ├── memory · presence · scheduler
│   ├── services/                            # external clients + domain logic
│   │   ├── firestore_client.py              # SOLE owner of collection paths
│   │   ├── gcs_client.py · fcm.py
│   │   ├── twilio_service.py
│   │   ├── stt.py · tts.py · gemini_agent.py
│   │   ├── embeddings.py · sentiment.py
│   │   ├── personalization.py
│   │   ├── network_decision.py
│   │   ├── emergency.py
│   │   └── memory_engine.py                 # drift-detection algorithm
│   ├── pipelines/
│   │   ├── call_orchestrator.py             # Twilio WS audio loop
│   │   └── post_call.py                     # transcript → summary → memory → save
│   ├── prompts/
│   │   ├── system_prompt.txt
│   │   ├── summary_prompt.txt
│   │   └── memory_consistency_prompt.txt
│   ├── utils/
│   │   ├── auth.py · ids.py
│   │   ├── time.py · audio.py
│   └── seed/
│       └── seed_demo_data.py                # 14-day cat-drift demo
└── tests/
    ├── conftest.py                          # in-memory Firestore + service mocks
    ├── test_health.py
    ├── test_pairing.py
    ├── test_memory_engine.py                # drift fires / cooldown / no-flag
    ├── test_personalization.py
    ├── test_network_decision.py
    └── test_emergency.py
```
