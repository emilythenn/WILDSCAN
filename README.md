# 🐾 WildScan AI Scanner  
**Real-Time Wildlife Crime Detection Prototype**

WildScan AI Scanner is the backend intelligence engine for **Project WildScan**, designed to detect suspicious wildlife trade activity from submitted evidence images.

This module processes screenshots or images stored in Firebase Firestore, analyzes them using **Google Gemini Vision**, applies rule-based risk scoring, and generates investigation-ready cases.

---

## 🚨 Problem Addressed

Illegal wildlife trade frequently occurs on social platforms and online marketplaces using:

- Code words (e.g. "black honey", "pineapple scales")
- Indirect descriptions
- Private messaging signals
- Rapid sales cycles

Manual monitoring is slow and unreliable.

WildScan automates detection and prioritization.

---

## 🧠 What This Scanner Does

1. Reads **unprocessed evidence** from Firestore (`evidence` collection)
2. Downloads image via Cloudinary URL (`fileUrl`)
3. Sends image to **Gemini Vision Model**
4. Extracts suspected wildlife/product signals
5. Applies rule-based risk scoring
6. Generates new case records (`cases` collection)
7. Updates original evidence with AI results

---

## 🏗 System Flow

Evidence Source → Firestore (`evidence`) → AI Scanner → Firestore (`cases`) → Web Dashboard

This design allows future integration with:

- Platform APIs
- Automated crawlers
- NGO submissions
- Public reporting tools

---

## ⚙️ Requirements

- Python 3.10+
- Firebase Firestore
- Gemini API Key
- Service Account Credentials

---

## 🔑 Environment Setup

Create `.env` file:

