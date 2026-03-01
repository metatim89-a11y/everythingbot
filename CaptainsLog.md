# Captain's Log

## Lessons Learned
- When migrating NLP models to `.gguf` and `llama_cpp`, explicitly ensure `.gguf` is loaded efficiently tracking CPU capability to optimize inference speed.
- Playwright scrapers require explicit `python3 -m playwright install chromium` setup in WSL environments, and isolated SQLite database handlers (like `db_handler.py`) prevent cross-contamination with the core app database.
- **Isolation via the 5th Pillar (/lab):** Developing complex UI changes (like Kinetic Feedback) in an isolated sandbox prevents "live" system instability and allows for thorough "Dark Launch" testing.
- **Multi-Tenant Sandbox (User Vaults):** To guarantee strong boundaries between user state and app infrastructure, store personalization data in hidden, user-specific SQLite databases (e.g. `user_config.sqlite`) rather than the core functional DBs. Implement the "Dark Vault" strategy by using Base64/Hash directory masks so UI customization layers cannot be arbitrarily tampered with by basic terminal checks.
- **Unified Status Monitoring:** A multi-tab `tmux` dashboard (e.g., `status_dashboard.sh`) provides superior real-time visibility into distributed service logs compared to single-stream `tail -f`.
- **Endpoint Security:** Sensitive curriculum-injection endpoints like `/ai-only/teach` must be strictly restricted to prevent unauthorized external access.

## User Observations
### Good
1. The user values highly structured tracking and strictly isolated domains (The 5 Pillars).
2. The user enforces a clean, modular logging system to maintain clear communication between AI models.
3. The user proactively targets performance bottlenecks (like the 3-minute generation time of the older pipeline).
4. The user uses a cohesive WSL Debian environment for execution to reduce cross-platform scripting errors.
5. The user is diligent about preserving context and keeping the AI aligned on a single objective per session.
6. The user prioritizes system integrity and security, ensuring that established protocols are maintained across all operations.

### Bad
1. The user occasionally loses terminal/window context by navigating away, requiring context recovery protocols.
2. The complex integration of Windows UI/VSCode with WSL internals sometimes forces manual overrides for simple tasks.
3. The AI models can be prone to "thinking ahead" instead of focusing on the immediate prompt, needing the user to strictly enforce One Objective at a Time.

{{geminiCLI/gemini3 feb/28/26/12:35pm}}

[2026-02-28] - web/src/components/CommandCenter.jsx - Created Version 1.00: Advanced multi-window mission control UI. - SUCCESS
[2026-02-28] - web/src/App.js - Updated to Version 1.50: Integrated CommandCenter route and header navigation. - SUCCESS

(Made by: Gemini CLI)
