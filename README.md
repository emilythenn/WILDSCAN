# 🦁 WILDSCAN - Wildlife Crime User Reporting App

**Malaysian Citizen Wildlife Reporting & Evidence Integrity System**

A cross-platform Flutter mobile application that empowers Malaysian citizens to safely report illegal wildlife trafficking, poaching activities, and suspicious online listings with GPS-verified metadata and secure cloud-backed evidence storage.

## 📂 Project Structure

```
WILDSCAN_REPORT_APP/
├── assets/
│   └── logo.svg                        # App branding
├── lib/
│   └── main.dart                       # Core application logic
│                                        - Camera & media handling
│                                        - GPS + reverse geocoding
│                                        - Cloudinary upload pipeline
│                                        - Firestore batch submission
├── pubspec.yaml                        # Dependencies
└── README.md                           # This file
```

## 🚀 Getting Started

### Quick Start Guide

1. **Clone repository:**
   ```bash
   git clone -b user-reporting-app https://github.com/emilythenn/WILDSCAN.git
   cd WILDSCAN
   ```

2. **Install dependencies:**
   ```bash
   flutter pub get
   ```

3. **Run the application:**
   ```bash
   flutter run
   ```

## 🔧 Technical Implementation Overview

### 1️⃣ Technologies Used

| Layer           | Technology           | Description                                         |
|-----------------|-------------------|---------------------------------------------------|
| Frontend        | Flutter & Dart      | Cross-platform UI & app logic                     |
| Media Handling  | image_picker        | Capture/upload images & videos                    |
| Cloud Storage   | Cloudinary API      | Secure media hosting & CDN                        |
| Database        | Firebase Firestore  | Real-time storage for cases & evidence           |
| GPS             | Geolocator API      | Location capture & reverse geocoding             |
| Web Fallback    | Nominatim API       | OpenStreetMap reverse geocoding fallback         |
| Security        | Firestore rules     | Ensures data integrity and anonymous submissions |

### 2️⃣ Google/Firebase Tools Integrated
- **Firebase Firestore:**
    - Live synchronization of reports and evidence
    - Batched writes to ensure atomic case submission
    - Timestamp enforcement for metadata integrity
- **Cloudinary:**
    - Image/video uploads via REST API
    - Automatic file type detection
    - Secure, unique URL generation for evidence
- **Google/Nominatim API:**
    - Reverse geocoding for Malaysian states
    - Ensures location validation in low-GPS areas

## 🛠 Implementation Approach

### Evidence Capture & Upload
1. User selects or captures media (photo/video)
2. Media converted to byte stream
3. Multipart HTTP upload to Cloudinary
4. Upload progress displayed to user
5. Cloudinary returns secure URL → batched Firestore write triggers

### Location Handling
- Permissions verified before GPS acquisition
- Real-time coordinate capture via Geolocator
- Reverse geocode coordinates into Malaysian state
- Manual override supported if GPS unavailable
- Coordinates synced into Firestore before submission

### Case ID & Data Integrity
- Unique Case ID (WS-XXXX) auto-generated
- Firestore existence check ensures no collisions
- Batched writes guarantee atomic submission of cases + evidence collections

## 💡 Innovation Highlights
- **GPS + Metadata Integrity:** Ensures verifiable location for every report
- **Anonymous Reporting:** No personal identity required for submissions
- **Atomic Firestore Writes:** Prevents partial submission errors
- **Cloud-First Evidence Storage:** Off-device media hosting with CDN delivery
- **Dual Geocoding Strategy:** Native + web fallback ensures robust location detection


## ⚠ Challenges Faced

| Challenge                                | Solution                                                          |
|-----------------------------------------|------------------------------------------------------------------|
| Web vs Mobile Geocoding Differences     | Implemented dual geocoding strategy (Placemark API + Nominatim fallback) |
| Upload Progress Tracking with Multipart Stream | Custom streamed response handler to calculate byte progress     |
| Unique Case ID Without Race Conditions  | Implemented Firestore Transactions to ensure atomic ID increments and zero collisions.              |
| GPS Permission Denials                   | Graceful UI fallback with retry mechanism                        |
  
## 🔐 Backend Configuration

### Required Services
- Firebase Project
    - Firestore enabled
    - Web + Android configuration
- Cloudinary Account
    - Upload preset configured (unsigned upload)

### Firebase Setup
You must configure:
- FirebaseOptions for Web & Android
- Firestore security rules
- google-services.json (Android)

## 📱 Core Application Features

### 📸 Evidence Capture & Upload
- Capture photo or record video (camera / gallery)
- Auto-detect media type (image / video)
- Cloudinary upload with progress indicator
- Secure URL generation for evidence storage
- Unique Case ID auto-generation (WS-0001 format)
- Batched Firestore write for atomic submission

### 📍 GPS Intelligence & Location Verification
- Real-time GPS capture via Geolocator
- Reverse geocoding via:
    - Native placemark API (mobile)
    - Nominatim API (web fallback)
- Malaysian State detection (13 states + 3 federal territories)
- Manual address override + coordinate sync
- Timeout & permission handling logic

### 🗂 Structured Case Submission Pipeline

`cases` Collection
- `caseId` – Unique identifier for the wildlife report
- `speciesDetected` – Detected wildlife species
- `status` – Report status (OPEN)
- `createdAt` – Firestore server timestamp
- `reportTime` – User-submitted timestamp
- `state` – Malaysian state of detection
- `discoveryType` – Online / Physical
- `location` – Latitude, longitude, full address

`evidence` Collection
- `evidenceId` – Unique media ID
- `caseId` – Associated case reference
- `fileUrl` – Cloudinary media URL
- `mediaType` – Image / Video
- `platformSource` – e.g., Facebook / Telegram / Physical
- `onlineLink` – Online source link
- `uploadedAt` – Upload timestamp

Firestore batch writes ensure atomic integrity.

## 🛡️ Anonymous & Secure Reporting
- No identity required
- Server-side timestamp validation
- Cloud-hosted media storage
- GPS metadata preserved
- Case reference issued instantly

## 📡 Architecture Overview
```
┌─────────────────────────────────────────┐
│        Flutter UI (Material 3)          │
├─────────────────────────────────────────┤
│     Real-Time Submission Controller      │
├─────────────────────────────────────────┤
│  Cloudinary Upload API   │  Geolocator   │
│  (Media Storage)         │  (GPS Data)   │
├─────────────────────────────────────────┤
│     Firebase Firestore   │ Reverse Geo   │
│     (Cases/Evidence)     │ State Mapping │
└─────────────────────────────────────────┘
```

## 🌍 Use Cases
1. Social media illegal wildlife listing reporting
2. Physical poaching detection in rural areas
3. Market wildlife trade documentation
4. Evidence preservation for enforcement units

## 🎯 Citizen Reporter Workflow
1. Capture Evidence
2. Verify Discovery Type (Online / Physical)
3. Identify Wildlife Species
4. Confirm Location & Timestamp
5. Submit Secure Report
6. Receive Case Reference ID


## 🇲🇾 Malaysian Administrative Optimization
State mapping logic includes:
- 13 States
- 3 Federal Territories (Kuala Lumpur, Labuan, Putrajaya)
Ensures consistent categorization for enforcement analysis and heat-mapping.

## 🔒 Security Design Principles
- Batched atomic Firestore writes
- Server timestamp validation
- Media stored off-device (Cloudinary CDN)
- GPS metadata preserved
- No local persistent sensitive storage

## 📄 License

For wildlife enforcement and conservation use only.

---

**Empowering Malaysian citizens to protect biodiversity — one verified report at a time. 🇲🇾**
