# 🦁 WILDSCAN - Wildlife Enforcement Detection Dashboard

**Malaysian Wildlife Enforcement AI-Powered Detection & Evidence Integrity System**

A cutting-edge real-time enforcement dashboard designed for investigating illegal wildlife trafficking with cryptographic evidence verification and AI-powered duplicate detection.

## 📂 Project Structure

```
WILDSCAN/
├── wildscan-enforcement-dashboard/  # Main React application
│   ├── src/
│   │   ├── components/              # React components
│   │   ├── App.tsx                  # Main application component
│   │   └── types.ts                 # TypeScript definitions
│   ├── package.json
│   ├── README.md                    # Complete feature documentation
│   └── vite.config.ts               # Vite configuration
└── README.md                        # This file
```

## 🚀 Getting Started

### Quick Start Guide

1. **Clone and setup:**
   ```bash
   cd wildscan-enforcement-dashboard
   npm install
   ```

2. **Configure environment:**
   Create `.env.local` with your credentials:
   ```env
   VITE_GEMINI_API_KEY=your_key_here
   VITE_FIREBASE_PROJECT_ID=your_project_id
   # See wildscan-enforcement-dashboard/README.md for full config
   ```

3. **Run the dashboard:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser

4. **Build for production:**
   ```bash
   npm run build
   ```

## ✨ Key Features

### 🔐 Evidence Integrity
- **SHA-256 Hash Verification:** Cryptographic fingerprints for all evidence
- **Duplicate Detection:** AI-powered identification of reused evidence across cases
- **Chain of Custody:** Court-admissible tamper-proof verification for Malaysian legal proceedings

### 🤖 AI-Powered Analysis
- **Gemini AI Integration:** Risk assessment, legality evaluation, and duplicate reasoning
- **Trust Score System:** Community-validated case prioritization
- **Offline Fallback:** Graceful degradation when AI unavailable

### 📊 Real-Time Enforcement
- **Live Case Streaming:** Firestore-backed real-time case updates
- **Multi-Filter Intelligence:** Search, priority, location, source, and confidence filtering
- **Geographic Mapping:** Google Maps integration with marker visualization

### 📋 Investigation Support
- **AI-Generated Reports:** Automated PDF/Word prosecution reports
- **Notification System:** Real-time alerts for new detections
- **Case Management:** Status tracking and investigator assignment

## 📚 Complete Documentation

For comprehensive feature list, setup instructions, troubleshooting, and API configuration, see:

📖 [**`wildscan-enforcement-dashboard/README.md`**](wildscan-enforcement-dashboard/README.md)

## 🔧 Tech Stack

- **React 18** + TypeScript
- **Firebase Firestore** for real-time database
- **Google Gemini 1.5 Flash** for AI analysis
- **Web Crypto API** for SHA-256 hashing
- **Google Maps API** for geographic visualization
- **Tailwind CSS** for styling
- **Vite** for build tooling

## 📡 Architecture Overview

```
┌─────────────────────────────────────────┐
│        React UI (Vite/TypeScript)       │
├─────────────────────────────────────────┤
│      Real-Time State Management          │
├─────────────────────────────────────────┤
│  Firebase Firestore  │  Gemini AI API    │
│  (Cases/Evidence)    │  (Analysis)       │
├─────────────────────────────────────────┤
│    Web Crypto API    │  Google Maps      │
│    (SHA-256 Hashing) │  (Visualization)  │
└─────────────────────────────────────────┘
```

## 🔒 Security

- Authentication via email + access key
- Firebase security rules for collection access
- HTTPS enforcement for all API communication
- Environment variables for sensitive credentials
- Production-ready authentication patterns

## 📊 Database Collections

- **`cases`** - Detection records with evidence hash and status
- **`evidence`** - Image files with SHA-256 fingerprints
- **`notifications`** - Real-time case alerts
- **`caseStatus`** - Investigation status tracking
- **`notificationState`** - Read/unread tracking

## 🌍 Use Cases

1. **Evidence Verification:** Detect tampered or reused evidence across investigations
2. **Fraud Prevention:** Identify false or duplicate wildlife trafficking reports
3. **Case Prioritization:** Use trust scores and AI analysis to focus resources
4. **Legal Documentation:** Generate court-ready prosecution reports with AI analysis
5. **Real-Time Response:** Receive immediate notifications for new detections

## 🎯 Enforcement Officer Workflow

1. **Login** → Secure access with authentication
2. **Review Cases** → View real-time detections on map and feed
3. **Filter & Search** → Use smart filters to find relevant cases
4. **Analyze Evidence** → View hash verification and duplicate detection
5. **Check Trust Score** → See metadata-based confidence and similar cases
6. **Generate Report** → Export AI-powered prosecution documentation
7. **Track Status** → Mark cases as Pending/Investigating/Resolved

## 📞 Support & Documentation

- See [wildscan-enforcement-dashboard/README.md](wildscan-enforcement-dashboard/README.md) for:
  - Complete feature documentation
  - Setup & installation guide
  - Troubleshooting FAQ
  - Firestore schema reference
  - Environment variable guide

## 📄 License

For wildlife enforcement use only.

---

**Build by enforcement officers, for enforcement officers. Protecting Malaysia's wildlife through technology.**