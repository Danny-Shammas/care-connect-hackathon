🛠 CareConnect: Deployment & Demo Guide
📂 Project Structure
backend/: FastAPI + Vertex AI (Gemini) + Twilio Media Streams.

care-connect-daily-main/: TanStack Start (React 19) PWA.

🚀 Backend Setup
Install Dependencies:

PowerShell
cd backend
pip install -r requirements.txt
pytest  # Confirm 24/24 tests pass
Seed Data (Firestore):
Ensure severity=3 is flagged for the demo to work.

PowerShell
# For live Firestore
python -m app.seed.seed_demo_data
Run Locally:

PowerShell
uvicorn app.main:app --port 8080 --reload
💻 Frontend Setup
Install & Configure:

PowerShell
cd care-connect-daily-main
npm install
cp .env.example .env
# Update VITE_API_BASE_URL to your Cloud Run URL
Launch:

PowerShell
npm run dev
🎭 The Perfect Demo Flow (Script)
Login: Sign in as Guardian → "I want to stay connected".

Pairing: Copy the 6-digit code. Open an incognito window, sign in as Elder, and paste the code.

Dashboard: Confirm "Milica Petrović" appears with 14 days of seeded history.

The Call: Trigger "Call Family" from the Elder side. Real phone rings; AI speaks Serbian (sr-RS).

Emergency (Stretch): Say "Pao sam!" (I fell) or "Bol u grudima!" (Chest pain) to trigger an FCM push notification to the Guardian.

⚠️ Pre-Flight Checklist
[ ] Twilio: Verify Polly.Lana Serbian voice is enabled.

[ ] GCP: Enable sr-RS-Standard-A in Text-to-Speech API.

[ ] Cloud Run: Ensure WebSockets are enabled (Cloud Run Gen2).

[ ] Memory Engine: Confirm severity=3 was flagged during seeding.
