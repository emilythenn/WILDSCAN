# 🐾 WildScan AI Scanner  
Real-Time Wildlife Crime Detection Prototype

WildScan AI Scanner is the backend intelligence engine for Project WildScan, designed to detect suspicious wildlife trade activity from submitted evidence images.

This module processes screenshots or images stored in Firebase Firestore, analyzes them using Google Gemini Vision, applies rule-based risk scoring, and generates investigation-ready cases.

## 🚨 Problem Addressed

Illegal wildlife trade frequently occurs on social platforms and online marketplaces using code words, indirect descriptions, private messaging signals, and rapid sales cycles.

Examples include disguised terms like "black honey" or "pineapple scales" that refer to illegal wildlife products.

Manual monitoring is slow, inconsistent, and difficult to scale. WildScan automates detection and prioritization.

## 🧠 What This Scanner Does

1. Reads unprocessed evidence from Firestore (evidence collection)
2. Downloads images using Cloudinary URLs (fileUrl)
3. Sends images to Google Gemini Vision models
4. Extracts suspected wildlife or product signals
5. Applies rule-based risk scoring logic
6. Generates new case records in Firestore (cases collection)
7. Updates original evidence documents with AI results

## 🏗 System Flow

Evidence Source → Firestore (evidence) → AI Scanner → Firestore (cases) → Web Dashboard

This design allows future integration with platform APIs, automated crawlers, NGO submissions, and public reporting tools without modifying the detection engine.

## ⚙️ Requirements

Python 3.10 or newer  
Firebase Firestore database  
Gemini API key (Google AI Studio)  
Firebase service account credentials

## 🔑 Environment Setup

Create a `.env` file in the project root directory:

GEMINI_API_KEY=YOUR_API_KEY  
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json

## 📦 Install Dependencies

pip install google-cloud-firestore python-dotenv requests google-generativeai

## ▶️ Running the Scanner

python main.py

When executed, the scanner will automatically detect new evidence documents, analyze images using Gemini, generate new cases, and update Firestore in real time.

## 📂 Firestore Structure Used

Evidence Collection:

Stores raw submissions such as screenshots or images.

Fields include:
- fileUrl (Cloudinary image URL)
- platformSource
- uploadedAt
- capturedAt

Scanner updates:
- aiSummary
- aiConfidence
- aiModelVersion
- scannerVersion
- processingNode
- caseId

Cases Collection:

Stores AI-generated detection records used by the dashboard and enforcement workflows.

Fields include:
- SpeciesDetected
- priority
- confidenceScore
- Status
- location
- reasonSummary
- riskScore

## 🧪 Testing Strategy

This prototype uses user-submitted screenshots, simulated platform captures, and Cloudinary-hosted images.

Live platform scraping is intentionally excluded from MVP scope due to operational complexity and platform security constraints.

## 🚀 Future Enhancements

Automated platform acquisition layer  
Multi-platform connectors  
Evidence integrity & hashing  
Investigator workflow features  
Alerting & notification systems

## 👨‍💻 Team Role

AI & Detection Engine

Responsibilities:
- Gemini Vision integration
- Detection & classification logic
- Risk scoring rules
- Case generation pipeline
- Evidence processing

## ⚠️ Security Notice

Never commit sensitive files to GitHub repositories:

.env  
serviceAccount.json  
.venv/

These files must be excluded via `.gitignore`.

## 🌏 Impact Vision

WildScan aims to support wildlife law enforcement, conservation NGOs, public reporting workflows, and biodiversity protection initiatives.

Aligned with UN Sustainable Development Goal 15 – Life on Land.
