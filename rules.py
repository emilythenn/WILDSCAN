import re

CODEWORDS = {
    "black honey": ("Bear Bile", 30),
    "pineapple scales": ("Pangolin", 35),
    "special tonic": ("Bear Bile", 15),
    "medicine tonic": ("Bear Bile", 20),
}

SPECIES_KEYWORDS = {
    "pangolin": ("Pangolin", 40),
    "tenggiling": ("Pangolin", 40),
    "bear bile": ("Bear Bile", 45),
    "hempedu": ("Bear Bile", 35),
    "ivory": ("Ivory", 45),
    "gading": ("Ivory", 45),
    "horn": ("Horn", 35),
    "tanduk": ("Horn", 30),
}

CONTACT_SIGNALS = [r"whatsapp", r"telegram", r"pm me", r"dm me", r"wasap", r"ws"]
SELL_SIGNALS = [r"rm\s?\d+", r"\$\s?\d+", r"cod", r"delivery", r"price", r"sell"]

def score_text(text: str):
    text_l = (text or "").lower()
    score = 0
    detected_species = None
    code_words = []
    reasons = []

    for cw, (sp, pts) in CODEWORDS.items():
        if cw in text_l:
            score += pts
            detected_species = detected_species or sp
            code_words.append(cw)
            reasons.append(f"Codeword detected: '{cw}'")

    for kw, (sp, pts) in SPECIES_KEYWORDS.items():
        if kw in text_l:
            score += pts
            detected_species = detected_species or sp
            reasons.append(f"Keyword detected: '{kw}'")

    if any(re.search(pat, text_l) for pat in CONTACT_SIGNALS):
        score += 10
        reasons.append("Contact signal detected")

    if any(re.search(pat, text_l) for pat in SELL_SIGNALS):
        score += 10
        reasons.append("Selling signal detected")

    score = min(score, 100)

    if score >= 70:
        priority = "HIGH"
    elif score >= 40:
        priority = "MEDIUM"
    else:
        priority = "LOW"

    return {
        "riskScore": score,
        "priority": priority,
        "species": detected_species or "Unknown",
        "codeWords": code_words,
        "reasons": reasons[:6],
    }
