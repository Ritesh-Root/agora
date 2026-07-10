# AGORA

**A no-code platform where a society of AI agents self-organizes to deliver your brief — live, in a 3D office.**

Built for the **Global AI Hackathon Series with Qwen Cloud** (Alibaba Cloud) — **Track 3: Agent Society**.

---

## What it is

You hand AGORA a brief. A *society* of Qwen-powered agents takes it from there:

- **Manager** decomposes the brief, defines the goal, and assigns roles.
- **Workers** pick up their roles and execute in parallel, with self-healing retries when a step fails.
- **Referee** steps in when workers disagree, resolving conflicts through structured debate rather than silent overwrites.
- **Lead** synthesizes the results into a single coherent deliverable and hands it back to you.

Every move — assignment, execution, debate, synthesis — plays out as a live, walkable 3D office, so you can *watch* the organization think instead of staring at a spinner. No code required to set it up.

## Getting Started

Requirements: Node.js 18+ and npm.

```bash
npm install
npm run dev
```

Then open the URL printed by Vite (default `http://localhost:3000`).

Useful scripts:

```bash
npm run build     # production build
npm run preview   # preview the production build
npm run lint      # type-check the client (tsc --noEmit)
```

## Powered by Qwen Cloud (DashScope)

AGORA drives its agent society with **Qwen** models via **DashScope's OpenAI-compatible endpoint**. Because the integration speaks the OpenAI chat-completions protocol, it slots in cleanly and stays portable; an **NVIDIA provider** is wired in as a fallback.

Configure your provider credentials via environment before running `npm run dev`.

## License

Code is **MIT** — see [`LICENSE`](LICENSE). Some bundled UI scaffolding and 3D assets carry third-party licenses (MIT / CC BY-NC 4.0) recorded in [`NOTICE.md`](NOTICE.md); the bundled 3D models are **non-commercial** placeholders to be replaced before any commercial release.

---

Author: **Ritesh-Root** &lt;workstationritalks@gmail.com&gt; · https://github.com/Ritesh-Root

## Acknowledgements and provenance

AGORA takes inspiration from [the-delegation](https://github.com/arturitu/the-delegation.git), an open-source project by Arturo Paracuellos. We used its 3D office shell and visual starting point, including the character and office assets, under the terms recorded in [`NOTICE.md`](NOTICE.md) and [`LICENSE-ASSETS.md`](LICENSE-ASSETS.md).

The agent-society architecture and the main hackathon features are AGORA's work. These include the server-side WebSocket relay, parallel orchestration, worker self-healing, Referee negotiation, the graph and benchmark views, composable skills, Qwen Cloud integration, and the related UI and protocol changes.
