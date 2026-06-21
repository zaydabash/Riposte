# Riposte — Autonomous Defensive Scaffolding

Riposte is an enterprise-grade continuous red-team and auto-remediation pipeline for LLM agents. 

Unlike simple UI mocks or static templates, Riposte executes a real, end-to-end security pipeline: it actively attacks a target AI agent using an adversarial token-level loss optimizer, runs the attack using an automated cloud browser, evaluates the target's response using a mathematical anomaly scoring system (ARiES), and automatically drafts human-in-the-loop Pull Requests to patch the target's codebase if a vulnerability is found.

## Architecture

Riposte consists of a React/Next.js frontend communicating with a Python/FastAPI backend, backed by Redis Stack for vector memory.

### 1. The Fuzzer (Token-Level Loss Optimization)
Instead of using basic "jailbreak" templates, the fuzzer algorithm mathematically generates attacks. It takes a base prompt and iteratively swaps words (tokens) to create an "adversarial suffix." It scores each mutation by seeing how close the target's response gets to a "malicious objective" using semantic embeddings. It uses **Simulated Annealing** to find the optimal string of words that tricks the AI into leaking data.

### 2. The Execution Arm (Stagehand / Browserbase)
Once the payload is generated, the backend uses **Stagehand** to spin up a headless browser. It navigates to the target AI's web interface, securely locates the chat box, injects the adversarial payload, and extracts the response. 

### 3. Evaluation & ARiES Scoring
The response is evaluated using the **AI Risk Enablement Score (ARiES)** out of 100, composed of:
- **Anomaly Detection (M)**: Uses Principal Component Analysis (PCA) to calculate the "Mahalanobis distance." It compares the response against a baseline of "normal" safe responses to detect strange behavior or leaked secrets.
- **Leakage (L)**: Compares the response against a secure database of your company's private documents (stored in Redis) to see if the AI accidentally quoted private data.
- **Attack Success (A)**: Heuristics to determine if the target refused or complied.
- **LLM Judge (J)**: An ensemble of LLMs that scores the threat, vulnerability, and impact.

### 4. Auto-Remediation (Claude Code)
If the ARiES score is dangerously high, Riposte automatically triggers **Claude Code** locally. It instructs Claude to analyze the vulnerability, write input-sanitization code to fix the target's repository, and open a Pull Request. This PR is *never* merged automatically—a human must approve it.

## Quick Start (Full Stack)

### 1. Start the Backend & Database
The backend requires Redis Stack (for vector search capabilities) and FastAPI.

```bash
# Start Redis Stack and the FastAPI backend
docker-compose up --build
```
The backend API will be available at `http://localhost:8000`.

### 2. Configure Environment Variables
**Backend (`backend/.env`):**
Ensure your API keys are set for Anthropic, MiniMax, Browserbase, etc. See `backend/.env.example`.

**Frontend (`frontend/.env.local`):**
Ensure the frontend knows where the API is.
```env
NEXT_PUBLIC_RIPOSTE_API_URL=http://127.0.0.1:8000
```

### 3. Start the Frontend UI
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the landing page.  
Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard) to launch the audit console.

## Project Structure
- `backend/src/services/fuzzer_service.py` - The adversarial fuzzer logic.
- `backend/src/services/eval_service.py` - The ARiES scoring math.
- `backend/src/workers/offensive_worker.py` - Browser execution.
- `backend/src/workers/patch_worker.py` - Auto-remediation PR generation.
- `frontend/app/` - Next.js UI using Hexagonal Architecture (Ports/Adapters).
