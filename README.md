# 🐾 WildScan AI Scanner 
**Real-Time Wildlife Crime Detection Prototype**

WildScan AI Scanner is the backend intelligence engine for Project WildScan, designed to detect suspicious wildlife trade activity from submitted evidence images. This module processes screenshots or images stored in Firebase Firestore, analyzes them using Google Gemini Vision, applies rule-based risk scoring, and generates investigation-ready cases.

## 🚨 Problem Addressed
Illegal wildlife trade frequently occurs on social platforms and online marketplaces using code words, indirect descriptions, private messaging signals, and rapid sales cycles. Examples include disguised terms like "black honey" or "pineapple scales" that refer to illegal wildlife products. Manual monitoring is slow, inconsistent, and difficult to scale. WildScan automates detection and prioritization.

---

## 🛠️ Technical Implementation Overview
This project relies on a modern stack to process, analyze, and store data in real-time, heavily utilizing Google tools for infrastructure and artificial intelligence:

* **Google Gemini Vision (Google AI Studio):** Acts as the core intelligence engine. It analyzes images and screenshots to identify visual evidence of wildlife products and parses text/slang to understand the context of the trade.
* **Google Firebase Firestore:** Serves as the primary NoSQL database, managing two main collections: raw `evidence` (inputs) and generated `cases` (outputs).
* **Python (3.10+):** The backend scripting language that orchestrates the data pipeline between Firestore, Cloudinary, and the Gemini API.
* **Cloudinary:** Handles image hosting, generating accessible URLs (`fileUrl`) for the AI to ingest.

---

## 💡 Explanation of Implementation & Innovation

### **Implementation / System Flow**
The scanner operates as an automated, continuous pipeline:
1. **Ingestion:** Reads unprocessed evidence from the Firestore `evidence` collection.
2. **Retrieval:** Downloads images using Cloudinary URLs.
3. **Analysis:** Sends the images and context to Google Gemini Vision models to extract suspected wildlife or product signals.
4. **Scoring:** Applies rule-based risk scoring logic to the AI's findings.
5. **Output:** Generates new, structured case records in the Firestore `cases` collection and updates the original evidence documents with AI results. 

*(Evidence Source → Firestore [evidence] → AI Scanner → Firestore [cases] → Web Dashboard)*

### **Innovation**
The primary innovation lies in moving away from rigid, keyword-based detection. By leveraging Google Gemini Vision's multimodal reasoning, WildScan can understand the *context* of a screenshot. It doesn't just look for the word "pangolin"; it can recognize disguised slang, evaluate the visual components of an image, and piece together the intent of a seller, automating a highly complex process that historically required manual human investigation.

---

## 🧗 Challenges Faced
Building an AI-driven detection engine presented several distinct challenges throughout the development cycle:

* **Increasing Accuracy to Fulfill Goals:** A major hurdle was tuning the AI to accurately distinguish between legal, everyday items and illegal wildlife products disguised through code words. Achieving the high-precision detection required to fulfill our project goals meant minimizing false positives without missing critical evidence.
* **Continuous Iteration and Prompt Engineering:** The nature of online illegal trade is constantly evolving. We had to continuously edit, change, and improve our prompts and rule-based logic to keep up. It required a constant loop of refining how we asked Gemini to analyze the images to get the best possible data extraction.
* **Testing Limitations and Strategy:** Live platform scraping was intentionally excluded from the MVP due to operational complexity and strict platform security constraints. Therefore, developing a robust testing cycle using simulated platform captures, user-submitted screenshots, and Cloudinary-hosted images was challenging but necessary to ensure the system worked safely and reliably.

---

## ⚙️ Requirements
* Python 3.10 or newer
* Firebase Firestore database
* Gemini API key (Google AI Studio)
* Firebase service account credentials

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

### **Evidence Collection**
Stores raw submissions such as screenshots or images.
* **Fields include:** `fileUrl` (Cloudinary image URL), `platformSource`, `uploadedAt`, `capturedAt`
* **Scanner updates:** `aiSummary`, `aiConfidence`, `aiModelVersion`, `scannerVersion`, `processingNode`, `caseId`

### **Cases Collection**
Stores AI-generated detection records used by the dashboard and enforcement workflows.
* **Fields include:** `SpeciesDetected`, `priority`, `confidenceScore`, `Status`, `location`, `reasonSummary`, `riskScore`

---

## 🚀 Future Enhancements
* Automated platform acquisition layer
* Multi-platform connectors
* Evidence integrity & hashing
* Investigator workflow features
* Alerting & notification systems

## 👨‍💻 Team Role: AI & Detection Engine
**Responsibilities:**
* Gemini Vision integration
* Detection & classification logic
* Risk scoring rules
* Case generation pipeline
* Evidence processing

## ⚠️ Security Notice
Never commit sensitive files to GitHub repositories (`.env`, `serviceAccount.json`, `.venv/`). These files must be excluded via `.gitignore`.

## 🌏 Impact Vision
WildScan aims to support wildlife law enforcement, conservation NGOs, public reporting workflows, and biodiversity protection initiatives. Aligned with UN Sustainable Development Goal 15 – Life on Land.
