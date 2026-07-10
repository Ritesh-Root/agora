# AGORA — Devpost submission draft

Use this as the source of truth while completing the Devpost form. Replace every `[CONFIRM]` or `[ADD]` item before submitting.

## Project overview

**Project name**

AGORA

**Elevator pitch**

AGORA is a live 3D office where a society of Qwen-powered agents breaks down a brief, works in parallel, repairs failed tasks, debates disagreements, and delivers one final result.

## Project details

### About the project

Most AI tools make one model do everything. AGORA takes a different approach: it gives the work to a small society of agents with clear roles.

You enter a brief. A Manager turns it into independent tasks and assigns roles. Workers handle those tasks in parallel. If a worker produces an invalid result, it gets a chance to read the failure and retry. When two agents disagree, a Referee runs a structured debate and scores the options against a rubric. A Lead then combines the accepted work into one answer.

The process is visible in a walkable 3D office. You can see who is working, which task is healing, how tasks connect, and where the final output came from. AGORA also includes a team editor, per-agent model selection, a negotiation view, and a benchmark that compares the society with a single-agent run.

I built AGORA for Track 3: Agent Society because the interesting question is not only whether an AI model can answer a prompt. It is whether several specialized agents can organize their work, handle disagreement, and stay understandable to the person supervising them.

AGORA takes inspiration from [the-delegation](https://github.com/arturitu/the-delegation.git), an open-source project by Arturo Paracuellos. We used its 3D office shell and visual starting point, including the character and office assets, with the required attribution and license notes in the repository. The server-side relay, agent-society orchestration, self-healing workers, Referee negotiation, graph view, benchmark tools, skills system, Qwen Cloud integration, and related UI are AGORA's additions.

### Built with

React, TypeScript, Vite, Three.js, React Flow, Zustand, WebSockets, Node.js, Qwen Cloud / Alibaba Cloud DashScope, Qwen Max, Qwen Plus, Qwen Turbo, NVIDIA NIM fallback.

### Try it out

GitHub: https://github.com/Ritesh-Root/agora

Demo: [ADD PUBLIC DEMO URL]

### Video demo

[ADD PUBLIC VIDEO URL]

## Additional information

### Submitter type

Individual `[CONFIRM]`

### Organization name

Leave blank unless submitting under an organization.

### Country of residence

India `[CONFIRM]`

### New or existing project

Newly built project `[CONFIRM]`

### Project start date

06-19-26

The first repository commit is dated June 19, 2026. Confirm this matches the actual project start date before entering it.

### Work completed during the submission period

The project was started during the submission period. During the build, I added the server-side agent-society orchestrator, parallel worker execution with self-healing retries, per-agent skills, structured Referee negotiation, the live negotiation UI, benchmark tooling, Qwen Cloud/DashScope integration, and the realtime event layer.

### Selected track

Track 3: Agent Society `[CONFIRM THE DEVPOST LABEL]`

### Code repository

https://github.com/Ritesh-Root/agora

Before submitting, push the final code and confirm the public repository contains the latest commit, source files, assets, setup instructions, and the MIT license.

### Alibaba Cloud deployment proof code URL

https://github.com/Ritesh-Root/agora/blob/main/server/alibaba/dashscope.ts

This file shows the DashScope endpoint, model selection, and `DASHSCOPE_API_KEY` usage. It is code-level integration evidence, not proof by itself that the application was hosted on Alibaba Cloud.

### Architecture diagram

Upload the architecture diagram file prepared for this submission. It should show: browser UI → Vite/WebSocket relay → AGORA society orchestrator → Qwen Cloud/DashScope; Manager, Workers, Referee, and Lead; and the environment-variable boundary around the API key.

### Alibaba Cloud deployment screenshot

Upload a screenshot from Alibaba Cloud console or Workbench showing the running deployment. The current repository does not contain this screenshot, so do not submit a fabricated image.

### Blog or social post

[ADD PUBLIC BLOG OR SOCIAL URL, OR LEAVE BLANK IF NOT ENTERING THE BLOG PRIZE]

### AI tools used

Qwen Cloud / Alibaba Cloud DashScope was the core model platform used by AGORA. I also used [CONFIRM: ChatGPT/Codex, Claude, or other tools] during development for planning, implementation, debugging, and documentation.

### What I learned

This project taught me that an agent society needs more than several model calls. The hard parts were defining role boundaries, passing structured events to the UI, making retries visible, handling malformed model output, and giving a human a way to resolve disagreement when the agents cannot. I also learned how to connect Qwen through DashScope's OpenAI-compatible API while keeping the provider behind a small interface, so the orchestration code does not depend on one vendor-specific client.

### Testing instructions

1. Clone https://github.com/Ritesh-Root/agora
2. Install Node.js 18+ and npm.
3. Run `npm install`.
4. Set `DASHSCOPE_API_KEY` in a local `.env` file. Do not commit the key.
5. Run `npm run dev`.
6. Open the Vite URL, create or run a society, and inspect the Manager, Worker, Referee, Lead, task healing, negotiation, and final output views.
7. For static checks, run `npm run lint`, `npm run lint:server`, `npm run test`, and `npm run build`.

The API key is not included in the repository. Judges will need their own DashScope key unless a public demo deployment is provided.

## Submission blockers before clicking Submit

- Push the final local changes to the public GitHub repository. The local checkout is ahead of `origin/main` and also has uncommitted changes.
- Add a real public demo URL if one exists.
- Add an Alibaba Cloud console/Workbench screenshot.
- Confirm the actual Alibaba hosting service. The repository currently documents Function Compute or ECS as alternatives; choose only the service that was really used.
- Upload an architecture diagram.
- Add a blog/social URL only if you want to enter the Blog Post Prize.
- Confirm individual/team status, India residence, age of majority, eligible jurisdiction, and non-sponsor status.
- Review the third-party 3D asset license warning in `LICENSE-ASSETS.md` before claiming commercial readiness.
