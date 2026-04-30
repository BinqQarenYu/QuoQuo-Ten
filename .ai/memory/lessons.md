# Lessons & Patterns

This file tracks successful patterns and past mistakes to prevent the AI assistant from repeating errors and to enforce consistency.

## Known Patterns
* **Firestore Security Rules**: The project uses a highly strict Attribute-Based Access Control (ABAC) pattern with explicit schema validation (`isValid[Entity]`) inside the rules. Always validate exact fields during updates.
* **Map Views**: The application uses `react-leaflet` for map interfaces and polyline route tracking.

## Mistakes to Avoid (Anti-patterns)
* Do not make parallel edits to the same file.
* Do not assume data representations without checking the `.ai/memory` or `firebase-blueprint.json`.
