from app.services.emergency import GeminiClassifierGate, scan


def test_scan_matches_obvious_emergencies():
    assert scan("I've fallen and I can't get up").severity == 3
    assert scan("I can't breathe").severity == 3
    assert scan("call an ambulance please").severity == 3
    assert scan("there's chest pain").severity == 3


def test_scan_ignores_innocuous_phrases():
    assert scan("I fell asleep on the couch") is None
    assert scan("the leaves fall in autumn") is None
    assert scan("breathe in, breathe out") is None
    assert scan("") is None


def test_classifier_gate_rate_limits():
    gate = GeminiClassifierGate(min_interval_sec=60)
    assert gate.allow() is True
    assert gate.allow() is False  # second call within window blocked
