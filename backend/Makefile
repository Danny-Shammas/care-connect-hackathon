.PHONY: install dev test seed emulator build deploy twilio-tunnel lint format clean

install:
	pip install -r requirements.txt

dev:
	uvicorn app.main:app --reload --host 0.0.0.0 --port $${PORT:-8080}

test:
	pytest

seed:
	python -m app.seed.seed_demo_data

emulator:
	@echo "Starting Firestore emulator on localhost:8080. Set FIRESTORE_EMULATOR_HOST=localhost:8080 in your shell."
	firebase emulators:start --only firestore

build:
	docker build -t careconnect-backend:local .

deploy:
	gcloud run deploy careconnect-api \
		--source . \
		--region=$${CLOUD_RUN_REGION:-europe-west3} \
		--allow-unauthenticated \
		--memory=1Gi \
		--cpu=1 \
		--min-instances=0 \
		--max-instances=4 \
		--timeout=600 \
		--set-env-vars="APP_ENV=production"

twilio-tunnel:
	@echo "Tunneling localhost:8080. Copy the https URL into TWILIO_WEBHOOK_BASE_URL and into the Twilio number's Voice webhook config."
	ngrok http 8080

lint:
	ruff check app tests

format:
	black app tests
	ruff check --fix app tests

clean:
	find . -type d -name "__pycache__" -prune -exec rm -rf {} +
	rm -rf .pytest_cache .ruff_cache .mypy_cache htmlcov .coverage
