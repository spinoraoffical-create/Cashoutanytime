---
name: bypass-all-game-captchas
description: A dynamic multi-platform login skill that bypasses numeric CAPTCHAs for Game Vault, Fire Kirin, Vblink, Panda Master, Milky Ways, and Orion Stars using server-side API solvers.
model: gemini-3.5-flash
---

# Skill Workflow: Universal Casino Portal Authentication

## Objective
Autonomously authenticate into any specified target gaming platform portal by dynamically reading login parameters, extracting verification image payloads, sending them to a third-party solver API, and executing form submissions.

## Rules of Engagement
- **Dynamic Vendor Target**: Read the `target_platform` and `target_url` dynamically from the execution context. Do not hardcode field selectors.
- **Strict Fallback Retry**: If the server rejects the verification code, trigger a challenge reload event up to 3 recursive times before logging a critical alert notification hook.

## Prescriptive Execution Steps

### Step 1: Target Identification & Context Scaping
1. Identify the active `target_platform` (e.g., "Game Vault", "Fire Kirin", "Vblink", "Panda Master", "Milky Ways", "Orion Stars").
2. Navigate the internal browser tool to the active `target_url` specified by the pipeline coordinator.
3. Locate the user credential form inputs. Inject the `merchant_username` and `secure_password` allocated for this specific gaming vendor node.

### Step 2: Image Payload Extraction
1. Scrape the DOM to isolate the unique graphical validation/CAPTCHA element container.
2. Render the bounding box pixels of that specific element container to a raw Base64 data string payload.
3. Confirm the payload string is clean and structurally complete before dispatching to the decryption processor.

### Step 3: Asynchronous API Solver Integration
1. Dispatch an outbound `POST` request payload to the server-side captcha solver API endpoint (e.g., 2Captcha or Anti-Captcha).
2. Pass your secure token `process.env.CAPTCHA_SOLVER_KEY` along with the processed Base64 graphic string.
3. Handle the returned unique task transaction ID. Enter a non-blocking asynchronous polling loop every 1.5 seconds until a clean string answer (e.g., `"4280"`) is returned.

### Step 4: Form Populating & Session Validation
1. Inject the alphanumeric solver string output directly into the targeted portal validation text box field.
2. Dispatch a high-priority `click()` event on the primary form submission or "Login" node element.
3. Monitor network response redirection states to verify dashboard accessibility, indicating successful loop resolution.
