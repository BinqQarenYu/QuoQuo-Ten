# AI Assistant Core Guidelines

You are operating within an AI-optimized project structure designed to prevent context loss (amnesia) and hallucinations. 

## Memory System
Always ensure you are aware of the current project context by consulting the following files when starting new conceptual tasks:
- `.ai/memory/global.md`: The single source of truth for the project's current state and roadmap.
- `.ai/memory/lessons.md`: A log of patterns that work and past mistakes to avoid.
- `docs/architecture/overview.md`: High-level system design and architectural decisions.

## Rules of Engagement
1. **Document as you go**: If establishing a new pattern, updating the database schema, or fixing a subtle bug, briefly record it in the memory files.
2. **Read before writing**: When interacting with an unfamiliar part of the codebase, check the documentation and memory files first.
3. **Modularity**: Keep components, skills, and prompts modular and focused.
4. **No Hallucinations**: Rely strictly on verified codebase state (using file reads and directory listings) and explicitly recorded architectural decisions.

This project uses an advanced structure inspired by "Claude Code Project Structure V2" adapted for Google AI Studio Build.
