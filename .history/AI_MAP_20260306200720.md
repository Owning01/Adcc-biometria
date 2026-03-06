# 🗺️ ADCC Biometric - AI Map & Project Guide

This document is designed to help AI assistants understand the complete project structure, locate logic components rapidly, and preserve token context. **Always read this file first to navigate the project.**

---

## 🏗️ 1. Core Architecture

- **`src/App.tsx`**: The primary Orchestrator. Manages routing, global authentication (`userRole`), the Global Biometric Login modal, and the global layout.
- **`src/firebase.ts`**: Firebase initialization (Auth, Firestore, Storage).
- **`src/index.css`**: The design system. Handles all global styles, modern typography, glassmorphism, and responsive design. *Do not add raw CSS files without styling through here.*

---

## 🧠 2. Global State & Contexts (`src/contexts/`)

- **`BatchProcessorContext.tsx`**: Context that handles bulk processing of images/photos, detecting faces in the background, and matching them.
- **`MatchBatchProcessorContext.tsx`**: Similar to the Batch context, specialized for importing and validating players from match data.

---

## 👁️ 3. Biometric Engine (`src/services/`)

The application uses an advanced Hybrid Biometric System, executing rapid client-side checks and heavy descriptor-based recognition:

- **`hybridFaceService.ts`**: The glue logic. Orchestrates `mediapipeService` and `faceServiceLocal`.
- **`mediapipeService.ts`**: Fast, lightweight face tracking and bounding box UI in real-time (green/red feedback).
- **`faceServiceLocal.ts`**: Heavy lifting models (Face-API). Extracts Face Descriptors when quality is ok.
- **`playerRegistrationService.ts`**: Handles the logic to save a player's facial descriptors into Firestore / IndexedDB.
- **`audioService.ts` / `voiceService.ts`**: Audio feedback functionality.

---

## 🗄️ 4. Data Layer (`src/services/`)

- **`db.ts`**: Core abstractions for Firebase CRUD operations (Users, Audits, Teams).
- **`matchesService.ts`**: Matches and tournament structures.
- **`teamsService.ts`**: Team structures.
- **`syncService.ts`**: Handles offline-first capabilities or caching mechanisms if any.
- **`adccService.ts`**: Interacts with the external ADCC API to fetch matches and tournament info.

---

## 📱 5. Main Pages (`src/pages/`)

- **`App.tsx`**: (Root) Houses the Biometric Login Modal and global layout.
- **`Home.tsx`**: Main dashboard for Admins and global view.
- **`HomeUser.tsx` & `HomePublic.tsx`**: Dashboards restricted by roles.
- **`AltaLocal.tsx`**: "Kiosk Mode" page where users verify their biometric identity locally.
- **`DevTools.tsx`**: Admin panel for database migrations and raw data viewing.
- **`MatchImporter.tsx`**: UI tool to import matches directly from the ADCC API and auto-generate teams/players/categories.
- **`CheckIn.tsx`**: Fast face verification per event format.
- **`Equipos.tsx`**: Teams administration.
- **`Partidos.tsx` & `MatchDetail.tsx`**: Match scheduling and detailed results.
- **`Register.tsx`**: Traditional / manual registration page.
- **`AuditLogs.tsx`**: Viewer for all facial logins (allows/denies).

---

## 🔧 6. Standardized Code Sections

To save tokens and reduce AI friction, files in this project are separated by strictly named comment blocks. 
*When modifying files, look for these sections:*

1. `// ============================================`
2. `// 1. IMPORTS & DEPENDENCIES`
3. `// 2. INTERFACES & BACKEND TYPES`
4. `// 3. COMPONENT DEFINITION`
5. `// 4. STATE & REFS`
6. `// 5. EFFECTS & LIFECYCLE`
7. `// 6. HANDLERS & LOGIC`
8. `// 7. RENDER HELPERS`
9. `// 8. MAIN RENDER`
10. `// ============================================`

*By sticking to these sections, AIs can easily do regex or targeted search + replace without losing the context.*
