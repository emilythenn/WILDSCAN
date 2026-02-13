# WILDSCAN - Wildlife Enforcement Detection Dashboard

A real-time wildlife trade enforcement dashboard powered by AI-driven evidence integrity verification and duplicate detection. Built for Malaysian enforcement officers to investigate illegal wildlife trafficking with cryptographic evidence authentication and AI-powered detection analysis.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16+)
- npm or yarn
- Gemini API key (for AI features)
- Firebase project with Firestore database

### Installation & Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env.local` file in the project root:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_sender_id
   VITE_FIREBASE_APP_ID=your_firebase_app_id
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```
   The dashboard will be available at `http://localhost:5173`

4. **Build for production:**
   ```bash
   npm run build
   ```

## ✨ Core Features

### 🔐 Authentication & Access Control
- Secure enforcement login with email, password, and access key verification
- Session management with local storage persistence
- Role-based access control (local enforcement officers only)

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
- Google Maps integration with themed dark map styling
- Clickable markers for each detection case
- Optional heatmap layer for high-density areas
- Auto-centering and zoom on case selection
- Location-based case clustering

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
- **Real-Time Notifications:** Browser notifications for new case detections
- **Unread Indicators:** Red dot badges on unread cases
- **Notification Feed:** Sortable alert carousel with priority badges
- **System Integration:** Optional browser system notifications
- **Notification State Tracking:** Firebase-backed read/unread status

### ⚡ Quick-Action Ranger Messaging
- **Send to Ranger Button:** One-click WhatsApp or email message for each case
- **Pre-Filled Details:** Case ID, species, location name, and coordinates
- **Field-Ready:** Enables fast dispatch from the command center to patrol teams

### 🌐 Multi-Language Translation
- **Translate to English:** On-demand translation of case descriptions via Gemini
- **Local Context Support:** Helps officers understand Chinese/Malay listings quickly
- **Preserves Meaning:** Translation preserves names, species, and evidence wording

### 🌓 Dark / Light Mode Toggle
- **Theme Switch:** Simple toggle in the header
- **Night Shift Ready:** Dark mode optimized for low-light operations
- **Daylight Visibility:** Light mode for briefing rooms and reports

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

## 📁 Firestore Database Schema

### Collections Structure

**`cases/{caseId}`**
```json
{
  "id": "string",
  "animal_type": "string",
  "source": "string",
  "description": "string",
  "location_name": "string",
  "latitude": 0.0,
  "longitude": 0.0,
  "confidence": 0.0,
  "priority": "High|Medium|Low",
  "timestamp": "Timestamp",
  "evidence_hash": "string (SHA-256)",
  "status": "Pending|Investigating|Resolved",
  "duplicateStatus": {
    "isDuplicate": true,
    "reason": "string",
    "duplicateCaseIds": ["string"],
    "flaggedAt": "Timestamp"
  }
}
```

**`evidence/{docId}`**
```json
{
  "caseId": "string",
  "imageUrl": "string",
  "hash": "string (SHA-256)",
  "hashCalculatedAt": "Timestamp",
  "platform": "string",
  "confidence": 0.0,
  "metadata": {}
}
```

**`notifications/{caseId}`**
```json
{
  "caseId": "string",
  "caseData": {},
  "read": false,
  "timestamp": "Timestamp"
}
```

**`caseStatus/{caseId}`**
```json
{
  "status": "Pending|Investigating|Resolved",
  "updatedAt": "Timestamp"
}
```

**`notificationState/{caseId}`**
```json
{
  "read": false,
  "timestamp": "Timestamp"
}
```

## 🔒 Security Configuration

### Firestore Rules (Development)
```rules
rules_version = '2';
service cloud.firestore {
   match /databases/{database}/documents {
      match /cases/{caseId} {
         allow read, write: if true;
      }
      match /evidence/{docId} {
         allow read, write: if true;
      }
      match /notifications/{docId} {
         allow read, write: if true;
      }
      match /caseStatus/{docId} {
         allow read, write: if true;
      }
      match /notificationState/{docId} {
         allow read, write: if true;
      }
   }
}
```

**⚠️ For production, implement proper authentication:**
```rules
rules_version = '2';
service cloud.firestore {
   match /databases/{database}/documents {
      match /cases/{caseId} {
         allow read: if request.auth != null;
         allow write: if request.auth.token.role == "enforcement_officer";
      }
   }
}
```

## 🛠️ Technology Stack

- **Frontend:** React 18 with TypeScript
- **Styling:** Tailwind CSS
- **Build Tool:** Vite
- **Database:** Google Firebase Firestore
- **AI/ML:** Google Gemini 1.5 Flash API
- **Cryptography:** Web Crypto API (SHA-256)
- **Maps:** Google Maps API
- **Export:** jsPDF and Document libraries
- **Icons:** Lucide React

## 📱 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 🔧 Troubleshooting

### No cases appearing in dashboard
1. Verify Firestore rules allow reads from your IP
2. Check `VITE_FIREBASE_PROJECT_ID` in `.env.local`
3. Ensure cases collection exists in Firestore

### Gemini AI features not working
1. Verify `VITE_GEMINI_API_KEY` is set correctly
2. Check API key has Generative Language API enabled
3. Monitor API quota usage in Google Cloud Console

### Hash calculation not working
1. Ensure browser supports Web Crypto API (all modern browsers)
2. Check image URLs are accessible (CORS enabled)
3. Review browser console for specific errors

### Maps not displaying
1. Verify Google Maps API key is configured
2. Check Maps API has Geolocation enabled
3. Ensure locations have valid coordinates (lat/lng)

## 📝 Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_GEMINI_API_KEY` | Google Gemini API key for AI features | Yes |
| `VITE_FIREBASE_API_KEY` | Firebase API key | Yes |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | Yes |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key | Yes |

## 📄 License

This project is for wildlife enforcement use only.

## 🤝 Support

For issues and feature requests, contact the enforcement operations team.
