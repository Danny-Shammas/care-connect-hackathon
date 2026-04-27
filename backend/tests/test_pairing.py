def test_create_and_redeem_pairing_code(client, bearer_for):
    guardian = "guardian_uid_123"
    elder = "elder_uid_456"

    r = client.post(
        "/pairing/code",
        headers=bearer_for(guardian),
        json={"guardianUid": guardian},
    )
    assert r.status_code == 200, r.text
    code = r.json()["code"]
    assert len(code) == 6 and code.isdigit()

    r2 = client.post(
        "/pairing/redeem",
        headers=bearer_for(elder),
        json={"code": code, "elderUid": elder},
    )
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["elderUid"] == elder
    assert body["guardianUid"] == guardian
    assert body["pairId"].startswith("pair_")

    # Idempotent redeem of the same (guardian, elder) returns same pair_id even
    # though the code itself is now used. We exercise the dedupe path with a
    # fresh code.
    r3 = client.post("/pairing/code", headers=bearer_for(guardian), json={"guardianUid": guardian})
    code2 = r3.json()["code"]
    r4 = client.post(
        "/pairing/redeem",
        headers=bearer_for(elder),
        json={"code": code2, "elderUid": elder},
    )
    assert r4.status_code == 200
    assert r4.json()["pairId"] == body["pairId"]


def test_invalid_pairing_code(client, bearer_for):
    r = client.post(
        "/pairing/redeem",
        headers=bearer_for("elder_x"),
        json={"code": "999999", "elderUid": "elder_x"},
    )
    assert r.status_code == 404
