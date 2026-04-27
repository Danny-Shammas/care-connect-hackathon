# 👵 CareConnect — Deployment & Demo Guide

**CareConnect** is a proactive healthcare assistant designed for the **GDG Nexus 2026 Hackathon**. It bridges the gap between seniors and caregivers using AI-driven voice interactions.

---

## 📁 Project Structure
* **`backend/`**: FastAPI + Vertex AI (Gemini) + Twilio media streams.
* **`care-connect-daily-main/`**: TanStack Start (React 19) PWA.
* *Note: `node_modules/`, `__pycache__/`, and `dist/` are excluded from the repo.*

---

## 🚀 Backend Setup

### 1. Install Dependencies
```powershell
cd backend
pip install -r requirements.txt
pytest  # Expect 24/24 passing tests
2. Seed Data (Firestore)
IMPORTANT: Ensure the final log shows severity=3. If not, the memory engine will not flag alerts correctly.

PowerShell
# To seed against live Firestore
python -m app.seed.seed_demo_data
3. Run Locally
PowerShell
uvicorn app.main:app --port 8080 --reload
💻 Frontend Setup
1. Install & Configure
PowerShell
cd care-connect-daily-main
npm install
cp .env.example .env
Update VITE_API_BASE_URL in your .env to your Cloud Run or Localhost URL.

2. Launch
PowerShell
npm run dev
🎭 The Perfect Demo Flow
Pairing: Sign in as Guardian → Copy the 6-digit code. Sign in as Elder (Incognito window) → Paste the code.

Dashboard: Confirm Milica Petrović appears with 14 days of seeded history.

The Call: Trigger "Call Family" from the Elder side. Real phone rings; AI speaks Serbian (sr-RS).

Emergency: Have the elder say "Pao sam!" (I fell) or "Bol u grudima!" (Chest pain) to trigger an FCM push notification.

⚠️ Pre-Flight Checklist
[ ] Twilio: Verify Polly.Lana Serbian voice is enabled.

[ ] GCP: Enable sr-RS-Standard-A in Text-to-Speech API.

[ ] Infrastructure: Ensure WebSockets are enabled on Cloud Run (Gen2).

[ ] Demo: Record backup video by hour 12.

Built for GDG Nexus 2026
