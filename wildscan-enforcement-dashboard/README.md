<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Cobr64U6Dn0YlqqGCRbJT4y1ogg180aI

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `VITE_GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Features

- Secure enforcement login gate with email, password, and access key checks (stored in local storage).
- Live Firestore streaming for `cases` with real-time updates and ordering by newest first.
- Evidence enrichment by linking latest `evidence` record to each case (image URL, platform source, AI summary).
- Global search across species, case name, location, source, and case ID.
- Priority filtering (High/Medium/Low), source filtering, and minimum-confidence slider.
- Status strip with totals, priority counts, average confidence, and recent activity sparkline.
- Alert feed carousel with quick selection and priority badges.
- Google Maps visualization with themed map, clickable markers, and optional heatmap layer.
- Case details sidebar with evidence image viewer and toggleable fit/fill mode.
- Gemini AI risk assessment for each case (with offline fallback messaging).
- Evidence report generator with simulated processing logs.
- Report downloads in PDF and Word formats.
- In-app notifications and browser system notifications for new cases.
- Firestore connection status indicator (Live/Connecting/Error/Offline).

## Firestore Rules (Suggested for Local Testing)

If you do not see data from the `cases` collection, ensure your Firestore rules allow reads for your current setup.
For local testing only, you can allow public reads and lock down later:

```rules
rules_version = '2';
service cloud.firestore {
   match /databases/{database}/documents {
      match /cases/{caseId} {
         allow read: if true;
      }
   }
}
```
