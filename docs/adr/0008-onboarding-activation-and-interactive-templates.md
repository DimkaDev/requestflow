# ADR-0008: Onboarding Wizard, Activation Checklist, and Architecture Archetypes

## Status
Accepted

## Context
First-time user experience (FTUE) and Time-to-First-Event (TTFE) are critical metrics for developer tool adoption. In FlowTrace:
1. Developers who manually configure diagrams and API keys without guidance face friction before observing live traffic.
2. Users need ready-made architecture archetypes (Online Shop, Microservices, Async Queue Worker, AI Agent & RAG Pipeline) that match their actual system design.
3. Once an architecture is selected, code snippets with pre-filled API keys in the developer's runtime language (cURL, Java, Node.js, Python, Go) provide immediate copy-paste integration.
4. An interactive radar that waits for the first live packet over WebSocket provides instant positive feedback upon successful ingest.
5. An activation checklist helps new teams track key milestones: selecting a template, issuing a key, sending an event, inviting a teammate, and using TV kiosk mode.

## Decision
1. **Domain Archetypes (`dev.flowtrace.domain`):**
   - Expand `DiagramGraph` and `TemplateDefinition` with four standardized archetypes:
     - `online-shop`: B2C storefront funnel (`visit -> browse -> product -> cart -> checkout -> payment -> paid / failed / abandoned`).
     - `microservices`: Cloud service mesh (`website -> lb -> decision -> service-a/b -> database`).
     - `queue-worker`: Async messaging pipeline (`client -> ingest-api -> queue -> worker -> db / dead-letter-queue`).
     - `ai-rag`: AI agent & vector retrieval pipeline (`prompt -> embedding -> vector-store -> llm-agent -> tools -> response`).
   - Keep domain models 100% framework-free (pure Java 21 records).

2. **Onboarding Wizard Flow (Angular Frontend):**
   - **Step 1 (Archetype):** Project name and visual card selection for the 4 archetypes.
   - **Step 2 (Code Snippet):** Multi-language code snippets with syntax highlighting, pre-populated with active API key and project ingest endpoint. Includes a "Send Test Event" button to verify the pipe without leaving the browser.
   - **Step 3 (Live Detection & Celebration):** Animated radar that listens on the project WebSocket stream. When the first event arrives, it measures Time-to-First-Event (TTFE), plays a celebratory animation, and navigates to the live canvas.

3. **Activation Checklist Component:**
   - Persistent widget displaying 5 progressive milestones:
     1. Architecture template selected.
     2. Ingest API key generated.
     3. First trace/checkpoint received.
     4. Teammate invited.
     5. Kiosk / TV mode tested.
   - Auto-evaluates state from reactive signals, supports minimize/expand, and persists dismissed state in `localStorage`.

4. **Public Demo Access:**
   - Smooth routing to `/demo` and `/demo/shop` without authentication, rendering live synthetic flows with a clear call-to-action to launch the onboarding wizard.

## Consequences
- **Positive:**
  - Dramatically reduces developer Time-to-First-Event (TTFE) from minutes to under 30 seconds.
  - Gives new organizations immediate clarity on how FlowTrace fits their stack.
  - Zero performance overhead on live ingest threads.
- **Negative / Trade-offs:**
  - Adds modal and checklist state to the frontend application component, requiring clean component state isolation.
