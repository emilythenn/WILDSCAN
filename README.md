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

## 💡 Innovation Highlights

✅ Context-aware AI-assisted detection  
✅ Real-time cross-platform intelligence pipeline  
✅ Integrated digital evidence integrity mechanisms  
✅ Duplicate evidence detection via cryptographic hashing  
✅ Citizen-to-enforcement workflow integration  

WildScan emphasizes practical, deployable AI rather than theoretical classification models.

## 🧗 Challenges Faced

- Balancing detection precision with false-positive reduction  
- Adapting to evolving marketplace slang and code words  
- Designing safe MVP testing without live platform scraping  
- Handling AI response variability and failure scenarios  
- Maintaining secure credential management practices

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

---
