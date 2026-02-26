import os
import json
import requests
import hashlib
from typing import Any, Dict

from dotenv import load_dotenv
from google.cloud import firestore
import google.generativeai as genai

from prompts import SYSTEM_PROMPT
from rules import score_text

load_dotenv()

EVIDENCE_COLLECTION = "evidence"
CASES_COLLECTION = "cases"

SCANNER_VERSION = "member1-v1.1"
PROCESSING_NODE = "local-dev"
AI_MODEL_VERSION = "models/gemini-2.5-flash"

DEFAULT_LOCATION = {
    "lat": 4.2105,
    "lng": 101.9758,
    "state": "Unknown"
}

# ---------------------------------------------------
# Basic helpers
# ---------------------------------------------------

def is_unprocessed(ev):
    if not ev:
        return True
    if not ev.get("aiScannedAt"):
        return True
    if not ev.get("scannerVersion"):
        return True
    return ev.get("scannerVersion") != SCANNER_VERSION

def download_image_bytes(url: str) -> bytes:
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.content

def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def init_clients():
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VITE_GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing GEMINI_API_KEY in .env")

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

    parsed = json.loads(text)

    return {
        "suspectedSpecies": parsed.get("suspectedSpecies", ""),
        "illegalProduct": parsed.get("illegalProduct", ""),
        "confidence": float(parsed.get("confidence", 0.5)),
        "summary": parsed.get("summary", ""),
        "codeWords": parsed.get("codeWords", []),
        "reasons": parsed.get("reasons", []),
        "stateGuess": parsed.get("stateGuess", "")
    }

def combine_priority(rule_priority: str, gem_confidence: float) -> str:
    """
    Hybrid logic:
    - Keep your rule priority as base.
    - If AI confidence is strong (>0.8), escalate one level.
    """

    if gem_confidence >= 0.85:
        return "HIGH"

    if gem_confidence >= 0.75 and rule_priority == "LOW":
        return "MEDIUM"

    return rule_priority

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

def find_duplicate_case(db, evidence_hash: str, current_case_id: str):
    if not evidence_hash:
        return None

    q = (
        db.collection(CASES_COLLECTION)
        .where("evidenceHash", "==", evidence_hash)
        .limit(3)
        .stream()
    )

    for doc in q:
        if doc.id != current_case_id:
            return doc.id

    return None

# ---------------------------------------------------
# Core Processing
# ---------------------------------------------------

def process_evidence_doc(db, model, ev_doc):
    evidence_id = ev_doc.id
    ev = ev_doc.to_dict()

    file_url = ev.get("fileUrl")
    platform = ev.get("platformSource", "Unknown")

    if not file_url:
        print(f"[SKIP] {evidence_id}: missing fileUrl")
        return

    print(f"[PROCESS] evidence={evidence_id}")

    # 1) Download image + hash
    img_bytes = download_image_bytes(file_url)
    evidence_hash = sha256_hex(img_bytes)

    # 2) Gemini
    try:
        gem = gemini_analyze_image(model, img_bytes)
    except Exception as e:
        print(f"[ERROR] Gemini failed: {e}")
        return

    # 3) Rules scoring (your exact rules.py)
    blob = " ".join([
        str(platform),
        str(ev.get("caption", "")),
        str(ev.get("description", "")),
        str(gem.get("suspectedSpecies", "")),
        str(gem.get("summary", "")),
        " ".join(gem.get("codeWords", [])),
        " ".join(gem.get("reasons", [])),
    ])

    rule = score_text(blob)

    # 4) Hybrid priority
    final_priority = combine_priority(
        rule["priority"],
        gem.get("confidence", 0.5)
    )

    # 5) Case ID
    case_id = ev.get("caseId") or get_next_case_id(db)

    duplicate_of = find_duplicate_case(db, evidence_hash, case_id)
    is_duplicate = bool(duplicate_of)

    now = firestore.SERVER_TIMESTAMP

    case_payload = {
        "confidenceScore": gem.get("confidence", 0.5),
        "riskScore": rule["riskScore"],
        "priority": final_priority,
        "platformSource": platform,

        "detectedSpeciesName": gem.get("suspectedSpecies") or rule.get("species"),
        "detectedIllegalProduct": gem.get("illegalProduct") or "Unknown",

        "reasonSummary": gem.get("summary"),
        "codeWords": rule.get("codeWords", []),
        "reasons": rule.get("reasons", []),

        "evidenceHash": evidence_hash,
        "isDuplicate": is_duplicate,
        "duplicateOfCaseId": duplicate_of,

        "aiScannedAt": now,
        "aiProcessed": True,
        "scannerVersion": SCANNER_VERSION,
        "aiModelVersion": AI_MODEL_VERSION,
        "processingNode": PROCESSING_NODE,

        "updatedAt": now,
        "source": "AI_SCANNER",
        "Status": "Pending"
    }

    db.collection(CASES_COLLECTION).document(case_id).set(case_payload, merge=True)

    db.collection(EVIDENCE_COLLECTION).document(evidence_id).set({
        "caseId": case_id,
        "aiSummary": gem.get("summary"),
        "aiConfidence": gem.get("confidence", 0.5),
        "aiRiskLevel": final_priority,
        "evidenceHash": evidence_hash,
        "isDuplicate": is_duplicate,
        "duplicateOfCaseId": duplicate_of,
        "aiScannedAt": now,
        "scannerVersion": SCANNER_VERSION,
        "updatedAt": now
    }, merge=True)

    print(f"[OK] case {case_id} updated (Priority: {final_priority})")

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
        if is_unprocessed(d.to_dict()):
            process_evidence_doc(db, model, d)
            processed += 1

    print(f"Done. Processed {processed} evidence docs.")

if __name__ == "__main__":
    main()
