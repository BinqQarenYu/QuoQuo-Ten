# Architecture Overview

## Frontend Architecture
* Standard Vite + React SPA.
* State management uses React hooks combined with local storage for persistence (where appropriate).

## Backend / Database
* **Firebase Firestore**: Acts as the primary NoSQL backend.
* **Authentication**: Firebase Auth (Google Sign-In).

## Folder Structure Mapping
* `/src/components/views`: Page-level view components (e.g., Relay, Kitchen).
* `/src/lib`: Core utility functions and Firebase setup.
* `/.ai`: AI context, memory, and automated workflows.
