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

## Credits & Provenance

AGORA stands on open work, and credits it openly.

- **UI / 3D shell — [the-delegation](https://github.com/arturitu/the-delegation)** by **Arturo Paracuellos (unboring.net)**. The source code is **MIT-licensed** and AGORA's interface and 3D scaffolding build directly on it.
- **3D models & assets** (`public/models/*.glb` and textures) are **CC BY-NC 4.0** (© Arturo Paracuellos) — **non-commercial**. They ship here as **placeholders** and are flagged for replacement with original/CC0 assets before any commercial use. See [`public/models/README.txt`](public/models/README.txt).
- Owner's own building blocks: **swarmpilot** (parallel execution), **Self-heal-Runtime** (worker self-heal), and **queue-cure-server** (realtime).

See [`NOTICE.md`](NOTICE.md) for the full attribution notice.

## License

- **Code:** MIT. AGORA's original code © 2026 Ritesh-Root; upstream the-delegation code © Arturo Paracuellos. See [`LICENSE`](LICENSE).
- **Bundled 3D assets:** **CC BY-NC 4.0** (© Arturo Paracuellos) — non-commercial. These remain under their original license and **must be replaced before any commercial submission, release, or distribution.**

---

Author: **Ritesh-Root** &lt;workstationritalks@gmail.com&gt; · https://github.com/Ritesh-Root
