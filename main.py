import os
import json
import requests
from typing import Any, Dict

from dotenv import load_dotenv
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

# ---------- Helpers: clean naming ----------
def pick_species_name(gem: dict, rule: dict) -> str:
    # Biological animal name
    return (gem.get("suspectedSpecies") or rule.get("species") or "Unknown").strip() if isinstance(
        (gem.get("suspectedSpecies") or rule.get("species") or "Unknown"), str
    ) else "Unknown"

def pick_illegal_product(gem: dict, rule: dict) -> str:
    """
    What is being trafficked / extracted (contraband).
    Prefer Gemini 'illegalProduct' if your prompt returns it.
    Fallback: rule's 'speciesDetected' if your rules use that naming.
    Otherwise Unknown.
    """
    val = gem.get("illegalProduct") or rule.get("illegalProduct") or rule.get("speciesDetected")
    if isinstance(val, str) and val.strip():
        return val.strip()
    return "Unknown"

def is_unprocessed(ev):
    return True

def download_image_bytes(url: str) -> bytes:
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.content

def init_clients():
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

    species_name = pick_species_name(gem, rule)
    illegal_product = pick_illegal_product(gem, rule)

    payload = {
        # Main fields for dashboard
        "confidenceScore": float(gem.get("confidence", 0.5)),
        "createdAt": now,
        "updatedAt": now,
        "statusDate": now,
        "priority": rule["priority"],  # LOW/MEDIUM/HIGH
        "source": "AI_SCANNER",
        "Status": "Pending",
        "location": location,

        # ✅ NEW CLEAR NAMES
        "detectedSpeciesName": species_name,           # animal name
        "detectedIllegalProduct": illegal_product,     # contraband / product type

        # ✅ Backward compatibility (keep your old key so UI won't break)
        "SpeciesDetected": species_name,

        # Extra helpful fields
        "riskScore": int(rule["riskScore"]),
        "platformSource": platform or "Unknown",
        "reasonSummary": gem.get("summary") or "Suspicious content detected.",
        "codeWords": gem.get("codeWords", rule.get("codeWords", [])),
        "reasons": gem.get("reasons", rule.get("reasons", [])),

        # Scanning state
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
    now = firestore.SERVER_TIMESTAMP
    location = _guess_location_from_gem(gem)

    species_name = pick_species_name(gem, rule)
    illegal_product = pick_illegal_product(gem, rule)

    updates = {
        "confidenceScore": float(gem.get("confidence", 0.5)),
        "updatedAt": now,
        "statusDate": now,

        "priority": rule["priority"],
        "riskScore": int(rule["riskScore"]),
        "platformSource": platform or "Unknown",

        # ✅ NEW CLEAR NAMES
        "detectedSpeciesName": species_name,
        "detectedIllegalProduct": illegal_product,

        # ✅ Backward compatibility
        "SpeciesDetected": species_name,

        "reasonSummary": gem.get("summary") or "Suspicious content detected.",
        "codeWords": gem.get("codeWords", rule.get("codeWords", [])),
        "reasons": gem.get("reasons", rule.get("reasons", [])),

        "aiScannedAt": now,
        "aiProcessed": True,

        "aiModelVersion": AI_MODEL_VERSION,
        "scannerVersion": SCANNER_VERSION,
        "processingNode": PROCESSING_NODE,

        "location": location,
        "source": "AI_SCANNER",
    }

    db.collection(CASES_COLLECTION).document(case_id).set(updates, merge=True)

def update_evidence(db, evidence_id: str, case_id: str, gem: dict):
    now = firestore.SERVER_TIMESTAMP
    updates = {
        "caseId": case_id,
        "aiSummary": gem.get("summary", ""),
        "aiConfidence": float(gem.get("confidence", 0.5)),
        "aiModelVersion": AI_MODEL_VERSION,
        "scannerVersion": SCANNER_VERSION,
        "processingNode": PROCESSING_NODE,
        "aiScannedAt": now,
        "updatedAt": now,
    }

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

    # 3b) Always update case
    update_case(db, case_id, gem, rule, platform)
    print(f"[OK] updated case {case_id}")

    # 4) Update evidence
    update_evidence(db, evidence_id, case_id, gem)
    print(f"[OK] updated evidence {evidence_id} -> caseId {case_id}")

def main():
    db, model = init_clients()

    docs = (
        db.collection(EVIDENCE_COLLECTION)
        .order_by("uploadedAt", direction=firestore.Query.DESCENDING)
        .limit(50)
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
