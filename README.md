# 🐾 WILDSCAN  
**Real-Time Wildlife Crime Detection & Response Platform**

WildScan is an AI-assisted system designed to detect, report, and investigate illegal wildlife trade activities. The platform integrates artificial intelligence, citizen reporting, and enforcement intelligence tools into a unified workflow.

Wildlife trafficking increasingly occurs across online marketplaces and social platforms, often hidden behind code words, indirect descriptions, and visual signals. WildScan addresses this challenge by transforming digital evidence into structured, investigation-ready cases.

---

## 🚨 Problem Addressed

Illegal wildlife trade presents several operational challenges:

- Monitoring large volumes of online content is difficult and resource-intensive  
- Sellers frequently use disguised language and non-obvious terminology  
- Digital evidence handling inconsistencies weaken investigations  
- Public reporting mechanisms are fragmented or inaccessible  

WildScan provides a scalable, technology-driven response to these gaps.

## 🧩 System Components

WildScan consists of three primary modules developed across separate branches:

- **User Reporting App (Flutter)**  
  Citizen-facing application for secure evidence submission  

- **AI Scanner (Python + Gemini Vision)**  
  Backend intelligence engine for evidence analysis and case generation  

- **Web Dashboard (React + TypeScript)**  
  Web interface for investigation, verification, and response workflows  

Each module maintains its own detailed documentation within its respective branch or directory.

## 🛠 Implementation Details

📱 User Reporting App (Flutter)
Core Responsibilities:
- Evidence capture (image upload)
- Link to actual posting
- GPS automation using device location services
- Timestamp generation
- Secure Firestore submission
Key Implementation Features:
- Firebase SDK integration
- Real-time submission confirmation
- Form validation & safe reporting UX
- Metadata tagging per case
  
🤖 AI Scanner Engine (Python + Gemini Vision)
Processing Workflow:
- Monitor Firestore for unprocessed evidence
- Validate required fields
- Send image to Gemini Vision
- Parse AI output into structured format
- Update case document with all ai produced output 

🖥 Web Dashboard (React + TypeScript)
Functionalities:
- Live case feed via Firestore listeners
- Case status tracking (Pending / Verified / Flagged)
- Map-based visualization
- Evidence preview & metadata display
- AI output verification interface

## 🛠 Technical Implementation Overview

WildScan leverages modern cloud and AI technologies with strong integration of Google services:

- **Google Gemini API / Gemini Vision** – Multimodal AI reasoning  
- **Firebase Firestore** – Real-time database & synchronization  
- **Flutter & Dart** – Cross-platform mobile application  
- **React + TypeScript** – Dashboard interface  
- **Python 3.10+** – Scanner & processing pipeline  
- **Google Maps Platform** – Geographic intelligence  
- **SHA-256 Hashing (Web Crypto API)** – Evidence integrity  

The architecture prioritizes real-time responsiveness, scalability, and evidence reliability.

## 🏗 Technical Architecture

WildScan follows a modular, event-driven cloud architecture built around real-time synchronization and AI-assisted processing

**Step 1 – Evidence Submission**

The Flutter mobile app collects:
- Image or screenshot evidence
- Link to posting/Automatic GPS coordinates
- Timestamp metadata
- Evidence is uploaded to Firestore and media storage.
  
**Step 2 – AI Processing Pipeline**

The Python-based AI Scanner:
- Listens to new evidence entries in Firestore
- Sends images to Gemini Vision for analysis
- Extracts species indicators & potential illegal products
- Generates structured AI summaries
- Stores results back in Firestore
  
**Step 3 – Real-Time Dashboard Sync**

The React dashboard:
- Subscribes to Firestore listeners
- Displays updated case data instantly
- Enables filtering, verification, and case management

## ⚙️ System Architecture Components

1️⃣ Client Layer
- Flutter Mobile App
- Web Dashboard (React + TypeScript)

2️⃣ Intelligence Layer
- Python AI Scanner Service
- Gemini Vision API integration
  
3️⃣ Data Layer
- Firebase Firestore (real-time NoSQL database)
- Media hosting storage
- SHA-256 evidence hash records
  
4️⃣ External Services
- Google Maps Platform
- Google Gemini API
  
The architecture ensures loose coupling between components while maintaining synchronized workflows

## 💡 Innovation Highlights

✅ Context-aware AI-assisted detection  
✅ Real-time cross-platform intelligence pipeline  
✅ Integrated digital evidence integrity mechanisms  
✅ Duplicate evidence detection via cryptographic hashing  
✅ Citizen-to-enforcement workflow integration  

WildScan emphasizes practical, deployable AI rather than theoretical classification models.

## 🧗 Challenges Faced & How We Overcame Them

1️⃣ AI Accuracy vs False Positives
Challenge: Wildlife listings often use coded language (“black honey”, “pineapple scales”), making detection inconsistent. Raw AI outputs were also too verbose and unclear.
Solution:
- Implemented structured JSON AI responses
- Added hybrid AI + rule-based keyword detection
- Introduced confidence thresholds
- Simplified AI explanations into short, readable summaries
Impact: Improved detection consistency and user trust.

2️⃣ AI Transparency & User Trust
Challenge: Users questioned why certain posts were flagged and hesitated to trust AI decisions.
Solution:
- Added expandable “Why Flagged” explanation panel
- Displayed detected keywords, species, and confidence score
Impact: Increased trust and clarity in AI-assisted decisions.

3️⃣ Dashboard Urgency Clarity
Challenge: Test users struggled to quickly identify urgent cases.
Solution:
- Introduced color-coded severity badges (Red / Orange / Green)
- Auto-sorted cases by priority
- Added short urgency labels
Impact: Users could identify critical cases within seconds.

4️⃣ Fear of Reporting & Privacy Concerns
Challenge: Users were concerned about identity exposure and retaliation.
Solution:
- Implemented anonymous reporting mode
- No login required
- Random case ID generation
- Clear privacy messaging (“Your identity is not stored.”)
Impact: All external testers reported higher confidence in submitting reports.

5️⃣ Ethical Testing & Platform Compliance
Challenge: Avoiding unauthorized scraping while validating real-world scenarios.
Solution:
- Used archived screenshots for controlled testing
- Designed roadmap for future policy-compliant platform collaborations
Impact: Ensured ethical development while preparing for scalable integration.

## 🚀 Future Roadmap
WildScan is designed as a scalable national-level wildlife intelligence system. Future development will focus on automation, institutional collaboration, and responsible AI expansion.

🔎 1. Platform-Level Monitoring (Policy-Compliant Integration)
To move beyond manual citizen reporting, WildScan aims to explore formal collaborations with major online platforms, including:
- Facebook
- Telegram
- Instagram
- Carousell
Planned Approach:
- Work through official APIs and reporting frameworks
- Establish NGO or enforcement-backed partnerships
- Implement compliant monitoring within platform terms of service
- Support automated flagging workflows via approved data-sharing mechanisms
  
⚠️ WildScan does not support unauthorized scraping or policy violations.
All integrations will respect privacy regulations and platform governance policies.

🤖 2. Automated Intelligence Pipeline
- Scheduled scanning of public wildlife-related content (where legally permitted)
- AI-assisted detection of suspicious listings using multimodal analysis
- Continuous slang & coded-language database updates

🧠 3. Advanced Wildlife-Specific AI Models
- Fine-tuned wildlife detection models trained on regional datasets
- Species verification assistance for enforcement agencies
- Multilingual content analysis (Bahasa Malaysia, English, regional dialects)
  
🔗 4. Cross-Case Intelligence & Pattern Linking
- Seller behavior clustering
- Repeated image detection across platforms
- Geographic hotspot prediction using spatial analytics
- Network graph visualization of trafficking patterns

🔐 5. Evidence Integrity & Legal Strengthening
- Immutable evidence storage architecture
- Advanced audit logging
- Tamper-detection verification layers
- Secure chain-of-custody expansion
  
🌏 6. Regional & Institutional Expansion
- Collaboration with wildlife NGOs
- Integration with enforcement agencies (e.g., PERHILITAN)
- ASEAN cross-border wildlife intelligence partnerships
- Research collaboration with conservation institutions
  
📡 7. Scalable Cloud Deployment
- Containerized AI services
- Event-driven cloud infrastructure
- Role-based access control (RBAC)
- Load-balanced architecture for national rollout

## 🌏 Sustainable Development Goals (SDG) Alignment

**Primary: SDG 15 – Life on Land**  
Supports efforts to combat wildlife trafficking and biodiversity loss.

**Secondary: SDG 16 – Peace, Justice & Strong Institutions**  
Enhances digital evidence workflows and enforcement decision support.

**Secondary: SDG 17 – Partnerships for the Goals**  
Connects citizens, NGOs, and authorities through shared intelligence systems.

## 📂 Repository Structure & Branches

WildScan modules are organized as follows:

- **User Reporting App** → `user-reporting-app` branch  
- **AI Scanner Engine** → `ai-scanner` branch
- **Web Dashboard** → `web-dashboard` branch

Refer to each module’s README for detailed setup, configuration, and usage instructions.


## ⚙️ Quick Start

Each system component can be run independently.

Please follow the setup guides inside:

- user-reporting-app README  
- ai-scanner README  
- web-dashboard README  

All required dependencies, environment variables, and credentials are documented within their respective modules.

## 🔐 Security Notice

Sensitive files such as API keys, service accounts, and environment variables must never be committed to the repository.

Use `.gitignore` to exclude:

- `.env` files  
- Credential JSON files  
- Secrets and tokens  

---

## 📄 License

For wildlife protection, enforcement, and research purposes only.
