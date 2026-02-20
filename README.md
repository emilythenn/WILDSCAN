# 🦁 WILDSCAN - Wildlife Enforcement Detection Dashboard

**Malaysian Wildlife Enforcement AI-Powered Detection & Evidence Integrity System**

A cutting-edge real-time enforcement dashboard designed for investigating illegal wildlife trafficking with cryptographic evidence verification and AI-powered duplicate detection.

## 📂 Project Structure

```
WILDSCAN/
├── wildscan-enforcement-dashboard/  # Main React application
│   ├── components/                  # React components
│   ├── utils/                       # Shared helpers
│   ├── App.tsx                      # Main application component
│   ├── types.ts                     # TypeScript definitions
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
  VITE_GOOGLE_MAPS_API_KEY=your_maps_key_here
  VITE_LOGIN_EMAIL=your_login_email
  VITE_LOGIN_PASSWORD=your_login_password
  VITE_LOGIN_KEY=your_access_key
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

### 🔐 Authentication & Access Control
- Secure enforcement login with email, password, and access key verification
- Session management with local storage persistence

### 📊 Real-Time Case Management
- Live Firestore streaming of detection cases with real-time updates
- Auto-sorted by newest first for immediate incident response
- Priority-based case organization (High/Medium/Low)
- Case status tracking (Pending/Investigating/Resolved)
- Quick case selection from alert feed carousel

### 🔍 Intelligence & Filtering
- **Global Search:** Search across species, case name, location, source, and case ID
- **Priority Filtering:** Filter by High/Medium/Low risk levels
- **Source Filtering:** Filter by platform (e.g., social media, marketplace)
- **Location Filtering:** Filter cases by enforcement jurisdiction
- **Confidence Slider:** Filter by minimum detection confidence threshold
- **Status Strip:** Real-time totals, priority counts, average confidence metrics, and activity sparkline

### 📍 Geographic Visualization
- Google Maps integration with light enforcement theme
- Clickable markers for each detection case
- Auto-centering and zoom on case selection
- Location-based case clustering
- Smart patrol route optimization, turn-by-turn guidance, and Waze handoff

### 🖼️ Evidence Management & Visualization
- Evidence image viewer with full-resolution display
- Toggleable fit/fill mode for different aspect ratios
- Evidence metadata display (source platform, timestamp, confidence)
- Multi-case evidence linking and comparison

### 🔐 Evidence Integrity & Hash Verification
- **SHA-256 Cryptographic Hashing:** Auto-calculated fingerprints for all evidence images
- **Automatic Hash Calculation:** Background processing for cases without hashes
- **Hash Storage:** Persistent storage in Firebase evidence collection with timestamp
- **Chain of Custody:** Tamper-proof verification for Malaysian court proceedings
- **Unique Evidence Badges:** Visual indicators showing "✓ Unique Evidence" or status

### 🚨 Duplicate Detection System
- **Duplicate Badge:** Red "⚠ Duplicate Found" indicator when same hash detected in multiple cases
- **Duplicate Modal:** Interactive display showing:
  - All matching cases with identical evidence hash
  - Animal type, location, and timestamp for each duplicate
  - Hash fingerprint (first 16 characters)
  - Count of cases with same hash
- **Why This Matters:** Educational context about evidence tampering and fraud implications
- **Gemini AI Analysis:** AI-powered explanation of possible reasons for duplication

### 🤖 Gemini AI Integration
- **Risk Assessment:** AI-generated risk analysis for each detection (High/Medium/Low)
- **Legality Assessment:** AI evaluation of conservation concerns and legal implications
- **Recommended Actions:** AI-suggested next steps for investigation
- **Duplicate Analysis:** AI reasoning for why evidence might appear in multiple cases
- **Offline Fallback:** Graceful degradation with fallback analysis when API unavailable
- **Explanation Modals:** 
  - Trust score explanations with similar case matching
  - Duplicate reason analysis with detailed context

### 📈 Trust Score System
- **Metadata-Based Scoring:** Cross-referencing species and location data
- **Community Validation:** Higher scores indicate more reports of same species in same location
- **AI Explanation Modal:** Click to see why a case has its trust score
- **Matching Cases Display:** View all similar cases that contributed to score
- **Investigation Guidance:** Use trust scores to prioritize investigation resources

### 🔔 Notifications & Alerts
- **Real-Time Notifications:** Browser notifications for new case detections and updates
- **Unread Indicators:** Red dot badges on unread cases
- **Notification Feed:** Sortable alert carousel with priority badges
- **System Integration:** Optional browser system notifications
- **Notification State Tracking:** Firebase-backed read/unread status

### ⚡ Quick-Action Ranger Messaging
- **Send to Ranger Button:** One-click WhatsApp or email message for each case
- **Pre-Filled Details:** Case ID, species, location name, and coordinates
- **Field-Ready:** Enables fast dispatch from the command center to patrol teams

### 🔊 Speech Accessibility Features
- **Auto-Speak Case Name:** When you click on a case in the alert feed, the case name automatically speaks aloud
  - Instantly alerts officers when a new case is selected
  - Speaks: "[Animal Type] case detected" (e.g., "Tiger case detected")
  - Helps officers know immediately which case they clicked without looking
  - Works automatically on every case click
- **Text-to-Speech (Read Aloud):** Click the "Read" button in case details to read full case information aloud
  - Reads case ID, species, priority, location, confidence, and status
  - Helps officers with vision impairment access critical case information
  - Manually toggle to start/stop reading detailed case information
  - One-click toggle to start/stop reading
- **Speech-to-Text (Voice Search):** Click the microphone icon next to the search bar for hands-free searching
  - Speak case species, location, or source directly into the dashboard
  - Useful for quick searches while operating in the field
  - Real-time transcription with result highlighting
  - Pulsing green mic icon indicates active listening
  - Supported languages: English (expandable to additional languages)
- **Accessibility Support:** Enables enforcement officers with visual or mobility impairment to operate the dashboard independently
- **Hands-Free Operation:** Particularly useful for field operations where typing is impractical

### 📋 Report Generation
- **AI-Powered Reports:** Automated report generation for prosecution
- **Multiple Formats:** Export to PDF or Word (.docx) formats
- **Detailed Analysis:** Includes:
  - Case metadata and classification
  - Gemini AI risk assessment
  - Evidence information and hash verification
  - Location and timing details
  - Recommended enforcement actions
- **Processing Logs:** Real-time status updates during generation
- **Court-Ready Format:** Professional formatting for Malaysian legal proceedings

### 📊 Analytics & Monitoring
- **Connection Status Indicator:** Real-time Firestore connection status (Live/Connecting/Error/Offline)
- **Activity Tracking:** Recent case activity sparkline visualization
- **Statistics Dashboard:** Total cases, priority breakdowns, confidence averages
- **Performance Monitoring:** Case loading and processing metrics

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