# ◈ MindBoard OS 
> A High-Fidelity Spatial Knowledge System for Masterminds.

![MindBoard Banner](https://img.shields.io/badge/System-Active-success?style=for-the-badge&logo=probot&logoColor=white)
![Version](https://img.shields.io/badge/Version-2.0.0-amber?style=for-the-badge)
![UI](https://img.shields.io/badge/UI-Cyber_Noir-red?style=for-the-badge)

**MindBoard OS** is not just a study tracker; it is a visual thinking environment. Built for students, developers, and researchers, it allows you to map out complex concepts on an infinite canvas using draggable "nodes," physical connectors, and deep-dive sub-content panels.

---

## 📸 The Experience

MindBoard OS transforms linear note-taking into a **spatial roadmap**. 
* **Draggable Nodes:** Every idea is a physical object you can pin and move.
* **Threaded Connections:** Define relationships (depends on, builds upon, leads to) with visual "wires."
* **Deep-Dive Sidebars:** Every sticker contains an infinite workspace for notes and checklists.
* **Multi-Plan Support:** Switch between different roadmaps (e.g., "Web Dev," "Biology," "Project X") seamlessly.

---

## 🚀 Key Features

### 🧠 Visual Mind-Mapping
* **Infinite Canvas:** Pan and zoom ($20\% \text{ to } 300\%$) across a massive workspace.
* **Dynamic Connectors:** SVG-based lines that update in real-time as you move nodes.
* **Smart States:** Label nodes as `📚 Idea`, `⚡ Learning`, `🧠 Understood`, or `🚀 Shared`.

### 🛠 Productivity Tools
* **Integrated Checklists:** Track progress within each node with interactive "tick/cross" tasks.
* **Focus Mode:** Highlight a single node and its immediate neighbors to eliminate distractions.
* **Rubber-band Selection:** Mass-edit, move, or recolor multiple nodes at once using `Shift + Drag`.
* **Persistence:** All plans are automatically saved to `LocalStorage` for instant retrieval.

### 🎨 Aesthetic Design
* **Cyber-Noir Theme:** A high-contrast, dark-mode interface designed for long study sessions.
* **Tactile Elements:** Realistic "tape" textures, push-pin icons, and subtle CSS rotations for an organic feel.

---

## ⌨️ Controls & Shortcuts

| Action | Shortcut |
| :--- | :--- |
| **Create Node** | Double-Click Canvas |
| **Select Multiple** | `Shift` + Drag or `Shift` + Click |
| **Pan Canvas** | `Space` + Drag or Middle Mouse |
| **Zoom** | Mouse Wheel |
| **Cancel/Close** | `ESC` |
| **Delete Selected** | `Backspace` / `Delete` |

---

## 🛠 Tech Stack

The system is built with pure, high-performance web technologies:
* **Logic:** Vanilla JavaScript (ES6+)
* **Rendering:** HTML5 & SVG for dynamic line rendering.
* **Styling:** CSS3 with variable-based theming and hardware-accelerated transforms.
* **Storage:** Browser LocalStorage API.

---

## 📦 Installation

Since MindBoard OS is a self-contained visual system, it requires no backend installation.

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/waliullahx82/mindboard-os.git](https://github.com/waliullahx82/mindboard-os.git)
    ```
2.  **Open in Browser:**
    Launch `mindboard-os.html` in any modern browser (Chrome, Edge, or Firefox recommended).

---

## 📈 Roadmap

- [ ] Markdown support within the Notes panel.
- [ ] Export Board as Image/PDF.
- [ ] Cloud-sync via Supabase/Firebase.
- [ ] Collaborative real-time editing.

---

*Built with precision for the modern learner.*