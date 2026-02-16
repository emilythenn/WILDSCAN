# 🦁 WILDSCAN - User Reporting App

> Real-time Wildlife Crime Detection & Evidence Integrity System

WILDSCAN is a cross-platform Flutter mobile application designed to empower Malaysian citizens to report illegal wildlife trafficking safely and instantly.

By leveraging GPS automation, Cloudinary media hosting, and Firebase real-time synchronization, the system provides enforcement agencies (PERHILITAN) with tamper-proof, actionable intelligence.


## 📂 Project Structure

```
WILDSCAN_REPORT_APP/
├── lib/
│   └── main.dart       # Core Logic: UI Screens, GPS Tracking & Firebase Integration
├── pubspec.yaml        # Project dependencies
└── README.md           # This file
```

## 🚀 Getting Started

### Prerequisites

- Flutter SDK `3.x` or higher
- Android Studio (Android Emulator API 30+)
- Xcode (macOS only for iOS Simulator)

### Backend Services Required

- Firebase Project with Firestore enabled
- Cloudinary Account for media hosting


## Installation

### 1️⃣ Clone the repository

```bash
git clone -b flutter-report-feature https://github.com/emilythenn/WILDSCAN.git
cd WILDSCAN
```

### 2️⃣ Install dependencies

```bash
flutter pub get
```

### 3️⃣ Run the application

```bash
flutter run
```


## ✨ Key Features

### 📸 High-Fidelity Evidence Capture

- Capture or upload photos, videos, and screenshots
- Cloudinary automatic media detection & optimization
- Server-side timestamp + unique Case Reference ID
- Chain-of-custody metadata protection

### 📍 Smart Geolocation Intelligence

- Automatic GPS coordinate capture
- Reverse geocoding to Malaysian States
- Manual UI override for low-signal environments

### 🛡️ Anonymous & Secure Reporting

- Anonymous by default
- Real-time secure Firestore integration
- Tamper-resistant cloud storage pipeline

### 🇲🇾 Malaysian Administrative Optimization

- State-level categorization (13 States + 3 Federal Territories)
- Data structured for enforcement heat-map analysis


## 🔧 Tech Stack

- **Flutter & Dart** – Cross-platform mobile development  
- **Firebase Firestore** – Real-time cloud database  
- **Cloudinary SDK** – Secure media hosting & CDN  
- **Geolocator API** – High-accuracy GPS positioning  
- **Nominatim API** – Reverse geocoding (State detection)


## 📡 Architecture Overview

```
┌─────────────────────────────────────────┐
│         Flutter UI (Dart/Material)      │
├─────────────────────────────────────────┤
│       Real-Time Data Sync (Firebase)    │
├─────────────────────────────────────────┤
│  Cloudinary API      │  Geolocator API  │
│  (Media Storage)     │  (GPS Metadata)  │
├─────────────────────────────────────────┤
│  Firebase Firestore  │  Reverse Geocode │
│  (Cases/Evidence)    │  (State Mapping) │
└─────────────────────────────────────────┘
```


## 📊 Database Collections

### `cases`

- Case ID
- Species
- Status
- Malaysian State
- Timestamp

### `evidence`

- Media URL
- Media Type
- Associated Case ID
- Metadata Hash


## 🌍 Use Cases

1. Social Media Monitoring (Facebook / Telegram evidence capture)
2. Field Reporting (Poaching / Traps GPS lock)
3. Market Evidence Collection
4. Fraud Prevention via geolocation & timestamp validation

## 🎯 Citizen Reporter Workflow

1. Capture Evidence  
2. Identify Species  
3. Verify Location  
4. Submit Report  
5. Receive Case Reference ID  


## 🔐 Security Principles

- Immutable metadata
- Timestamp validation
- Case-ID traceability
- Cloud-hosted media integrity

##📄 License

WILDSCAN MALAYSIA 2026  
For wildlife enforcement and conservation purposes only.

---

> Empowering Malaysian citizens to protect biodiversity — one report at a time.
