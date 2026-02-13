import os
import json
import requests
from typing import Any, Dict

from dotenv import load_dotenv
from google.api_core.exceptions import NotFound
from google.cloud import firestore
import google.generativeai as genai

from prompts import SYSTEM_PROMPT
from rules import score_text

load_dotenv()

EVIDENCE_COLLECTION = "evidence"
CASES_COLLECTION = "cases"

SCANNER_VERSION = "member1-v1.0"
PROCESSING_NODE = "local-dev"  # change to cloud-run-1 later
AI_MODEL_VERSION = "models/gemini-2.5-flash"

DEFAULT_LOCATION = {
    "lat": 4.2105,      # Malaysia approx center
    "lng": 101.9758,
    "state": "Unknown"
}

def is_unprocessed(ev: dict) -> bool:
    """
    Treat as unprocessed if:
    - scannerVersion missing OR
    - caseId missing OR
    - aiScannedAt missing (your requested timestamp)
    """
    return (not ev.get("scannerVersion")) or (not ev.get("caseId")) or (not ev.get("aiScannedAt"))

def download_image_bytes(url: str) -> bytes:
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.content

def init_clients():
    # Support both naming styles: GEMINI_API_KEY (scanner) or VITE_GEMINI_API_KEY (front-end env)
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VITE_GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing GEMINI_API_KEY (or VITE_GEMINI_API_KEY) in .env")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(AI_MODEL_VERSION)
    db = firestore.Client()
    return db, model

def gemini_analyze_image(model, image_bytes: bytes) -> Dict[str, Any]:
    resp = model.generate_content(
        [
            SYSTEM_PROMPT,
            {"mime_type": "image/png", "data": image_bytes},
        ],
        generation_config={"temperature": 0.2},
    )

    text = (resp.text or "").strip()

    # Try to extract JSON if extra text appears
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end + 1]

    return json.loads(text)

def get_next_case_id(db) -> str:
    docs = (
        db.collection(CASES_COLLECTION)
        .order_by("createdAt", direction=firestore.Query.DESCENDING)
        .limit(1)
        .stream()
    )

    latest_id = None
    for d in docs:
        latest_id = d.id

    if not latest_id or not latest_id.startswith("WS-"):
        return "WS-0001"

    num = int(latest_id.split("-")[1])
    return f"WS-{num+1:04d}"

def _guess_location_from_gem(gem: dict) -> dict:
    location = DEFAULT_LOCATION.copy()
    state_guess = gem.get("stateGuess")
    if isinstance(state_guess, str) and state_guess.strip():
        location["state"] = state_guess.strip()
    return location

def create_case(db, case_id: str, gem: dict, rule: dict, platform: str):
    now = firestore.SERVER_TIMESTAMP
    location = _guess_location_from_gem(gem)

    payload = {
        # Existing dashboard-friendly fields
        "confidenceScore": float(gem.get("confidence", 0.5)),
        "createdAt": now,
        "updatedAt": now,
        "statusDate": now,
        "priority": rule["priority"],  # LOW/MEDIUM/HIGH
        "source": "AI_SCANNER",
        "SpeciesDetected": gem.get("suspectedSpecies") or rule.get("species") or "Unknown",
        "Status": "Pending",
        "location": location,

        # Extra helpful fields
        "riskScore": int(rule["riskScore"]),
        "platformSource": platform or "Unknown",
        "reasonSummary": gem.get("summary") or "Suspicious content detected.",
        "codeWords": gem.get("codeWords", rule.get("codeWords", [])),
        "reasons": gem.get("reasons", rule.get("reasons", [])),

        # Requested: AI scanned timestamp in CASE too
        "aiScannedAt": now,
        "aiProcessed": True,

        # Traceability
        "aiModelVersion": AI_MODEL_VERSION,
        "scannerVersion": SCANNER_VERSION,
        "processingNode": PROCESSING_NODE,
    }

    db.collection(CASES_COLLECTION).document(case_id).set(payload)
    return payload

def update_case(db, case_id: str, gem: dict, rule: dict, platform: str):
    """
    Merge-update the case even if it already exists (so dashboard reflects changes).
    Adds aiScannedAt + updatedAt each time scanning happens.
    """
    now = firestore.SERVER_TIMESTAMP
    location = _guess_location_from_gem(gem)

    updates = {
        "confidenceScore": float(gem.get("confidence", 0.5)),
        "updatedAt": now,
        "statusDate": now,

        "priority": rule["priority"],
        "riskScore": int(rule["riskScore"]),
        "platformSource": platform or "Unknown",

        "SpeciesDetected": gem.get("suspectedSpecies") or rule.get("species") or "Unknown",
        "reasonSummary": gem.get("summary") or "Suspicious content detected.",
        "codeWords": gem.get("codeWords", rule.get("codeWords", [])),
        "reasons": gem.get("reasons", rule.get("reasons", [])),

        # Requested: AI scanned timestamp in CASE too
        "aiScannedAt": now,
        "aiProcessed": True,

        # Traceability
        "aiModelVersion": AI_MODEL_VERSION,
        "scannerVersion": SCANNER_VERSION,
        "processingNode": PROCESSING_NODE,

        "location": location,
        "source": "AI_SCANNER",  # keep consistent
    }

    db.collection(CASES_COLLECTION).document(case_id).set(updates, merge=True)

def update_evidence(db, evidence_id: str, case_id: str, gem: dict):
    """
    Updates evidence with AI fields + link to case.
    Adds aiScannedAt timestamp (requested) + updatedAt.
    Uses set(merge=True) to avoid failures if doc missing and to preserve other fields.
    """
    now = firestore.SERVER_TIMESTAMP
    updates = {
        "caseId": case_id,
        "aiSummary": gem.get("summary", ""),
        "aiConfidence": float(gem.get("confidence", 0.5)),
        "aiModelVersion": AI_MODEL_VERSION,
        "scannerVersion": SCANNER_VERSION,
        "processingNode": PROCESSING_NODE,

        # Requested timestamp + standard update timestamp
        "aiScannedAt": now,
        "updatedAt": now,
    }

    # Use merge=True so it:
    # - creates the doc if it doesn't exist
    # - doesn't overwrite other fields (fileUrl, uploadedAt, etc.)
    db.collection(EVIDENCE_COLLECTION).document(evidence_id).set(updates, merge=True)

def process_evidence_doc(db, model, ev_doc):
    evidence_id = ev_doc.id
    ev = ev_doc.to_dict()

    file_url = ev.get("fileUrl")
    platform = ev.get("platformSource", "Unknown")

    if not file_url:
        print(f"[SKIP] {evidence_id}: missing fileUrl")
        return

    print(f"[PROCESS] evidence={evidence_id}, platform={platform}")
    img_bytes = download_image_bytes(file_url)

    # 1) Gemini
    try:
        gem = gemini_analyze_image(model, img_bytes)
    except Exception as e:
        print(f"[ERROR] Gemini failed for evidence={evidence_id}: {e}")
        return

    # 2) Rules score
    blob = " ".join([
        str(gem.get("suspectedSpecies", "")),
        str(gem.get("summary", "")),
        " ".join(gem.get("codeWords", []) if isinstance(gem.get("codeWords", []), list) else []),
        " ".join(gem.get("reasons", []) if isinstance(gem.get("reasons", []), list) else []),
    ])
    rule = score_text(blob)

    # 3) Create/ensure case id
    case_id = ev.get("caseId") or get_next_case_id(db)

    case_ref = db.collection(CASES_COLLECTION).document(case_id)
    if not case_ref.get().exists:
        create_case(db, case_id, gem, rule, platform)
        print(f"[OK] created case {case_id}")

    # 3b) ALWAYS update case (so dashboard reflects AI scan + timestamps)
    update_case(db, case_id, gem, rule, platform)
    print(f"[OK] updated case {case_id}")

    # 4) Update evidence with AI + link to case + aiScannedAt
    update_evidence(db, evidence_id, case_id, gem)
    print(f"[OK] updated evidence {evidence_id} -> caseId {case_id}")

def main():
    db, model = init_clients()

    # Read latest evidence docs
    docs = (
        db.collection(EVIDENCE_COLLECTION)
        .order_by("uploadedAt", direction=firestore.Query.DESCENDING)
        .limit(50)  # bump a bit so you catch more
        .stream()
    )

    processed = 0
    for d in docs:
        ev = d.to_dict()
        if is_unprocessed(ev):
            process_evidence_doc(db, model, d)
            processed += 1

    print(f"Done. Processed {processed} evidence docs.")

if __name__ == "__main__":
    main()
