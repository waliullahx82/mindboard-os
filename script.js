// ════════════════════════════════════════════
//  MINDBOARD OS v2
// ════════════════════════════════════════════

const STATE_ICONS = {
  idea: "💡",
  learning: "⚙️",
  understood: "✓",
  shared: "🔗",
};
const STATE_COLORS = {
  idea: "#9b59b6",
  learning: "#e67e22",
  understood: "#27ae60",
  shared: "#2980b9",
};

let plans = [],
  activePlanId = null,
  nodes = [],
  connections = [];
let selectedColor = "y",
  openNodeId = null,
  focusNodeId = null;
let connectSourceId = null,
  pendingConn = {};
let isDraggingNode = false,
  isPanning = false,
  isConnecting = false;
let selectedNodeIds = new Set();
let vx = 0,
  vy = 0,
  vz = 1,
  lastMouse = { x: 0, y: 0 };
let ctxTargetId = null,
  spaceDown = false;
let rbStart = null,
  rbActive = false;
let currentUsername = null;

const canvasEl = document.getElementById("canvas");
const svgEl = document.getElementById("connections-svg");
const sidePanel = document.getElementById("side-panel");
const panelTitle = document.getElementById("panel-title");
const panelNotes = document.getElementById("panel-notes");
const ctxMenu = document.getElementById("ctx-menu");
const focusOverlay = document.getElementById("focus-overlay");
const connPopup = document.getElementById("conn-label-popup");
const zoomInd = document.getElementById("zoom-indicator");
const multiBar = document.getElementById("multi-bar");
const mbCount = document.getElementById("mb-count");
const canvasWrap = document.getElementById("canvas-wrap");
const selRect = document.getElementById("sel-rect");
const plansDrawer = document.getElementById("plans-drawer");

// ── Utils ─────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function applyTransform() {
  canvasEl.style.transform = `translate(${vx}px,${vy}px) scale(${vz})`;
  zoomInd.textContent = Math.round(vz * 100) + "%";
}
function screenToCanvas(sx, sy) {
  return { x: (sx - vx) / vz, y: (sy - vy) / vz };
}
function getNoteCenter(n) {
  return { x: n.x + 90, y: n.y + 55 };
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function setNoteColor(el, color) {
  ["y", "b", "g", "p", "o", "r", "t"].forEach((c) =>
    el.classList.remove("note-color-" + c),
  );
  el.classList.add("note-color-" + color);
}

// ── Node CRUD ─────────────────────────────────
function createNode(cx, cy, title = "", color = null) {
  const rot = (Math.random() - 0.5) * 6;
  const node = {
    id: uid(),
    x: cx - 90,
    y: cy - 55,
    title: title || "New Node",
    notes: "",
    state: "idea",
    color: color || selectedColor,
    rot,
    checklist: [],
    connections: [],
    done: false,
    crossed: false,
  };
  nodes.push(node);
  renderNote(node);
  updateStatus();
  save();
  return node;
}

function renderNote(node) {
  let el = document.getElementById("note-" + node.id);
  if (!el) {
    el = document.createElement("div");
    el.id = "note-" + node.id;
    el.className = "note note-color-" + node.color;
    el.style.setProperty("--rot", node.rot + "deg");
    el.style.transform = `rotate(${node.rot}deg)`;
    el.innerHTML = `<div class="note-pin"></div>
      <button class="note-del-btn" title="Delete">✕</button>
      <button class="note-connect-btn" title="Connect">◎</button>
      <button class="note-done-btn" title="Toggle done">✓</button>
      <input type="checkbox" class="note-check" title="Select">
      <div class="note-title"></div>
      <div class="note-preview"></div>
      <div class="note-state"></div>
      <div class="note-done-badge"></div>`;
    el.style.left = node.x + "px";
    el.style.top = node.y + "px";
    makeDraggable(el, node);
    el.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("note-connect-btn") ||
        e.target.classList.contains("note-del-btn") ||
        e.target.classList.contains("note-done-btn") ||
        e.target.classList.contains("note-check")
      )
        return;
      if (isDraggingNode) return;
      if (isConnecting) {
        finishConnection(node.id);
        return;
      }
      if (e.shiftKey) {
        toggleSelectNode(node.id);
        return;
      }
      openPanel(node.id);
    });
    el.querySelector(".note-connect-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      startConnection(node.id);
    });
    el.querySelector(".note-del-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteNode(node.id);
    });
    el.querySelector(".note-done-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      cycleNodeDone(node.id);
    });
    el.querySelector(".note-check").addEventListener("change", (e) => {
      e.stopPropagation();
      if (e.target.checked) addToSelection(node.id);
      else removeFromSelection(node.id);
    });
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      ctxTargetId = node.id;
      showCtxMenu(e.clientX, e.clientY);
    });
    canvasEl.appendChild(el);
  }
  setNoteColor(el, node.color);
  el.querySelector(".note-title").textContent = node.title;
  el.querySelector(".note-preview").textContent =
    node.notes.slice(0, 80) + (node.notes.length > 80 ? "…" : "");
  el.querySelector(".note-state").textContent = STATE_ICONS[node.state] || "📚";
  const badge = el.querySelector(".note-done-badge");
  badge.textContent = node.done ? "✓ DONE" : node.crossed ? "✕ CROSS" : "";
  badge.style.color = node.done ? "#27ae60" : "#e74c3c";
  el.style.left = node.x + "px";
  el.style.top = node.y + "px";
  el.style.boxShadow = `4px 5px 18px rgba(0,0,0,.6),0 0 12px ${STATE_COLORS[node.state] || "#9b59b6"}44`;
  el.classList.toggle("done-node", !!(node.done || node.crossed));
  el.classList.toggle("selected-node", selectedNodeIds.has(node.id));
  el.querySelector(".note-check").checked = selectedNodeIds.has(node.id);
}

function deleteNode(id) {
  connections = connections.filter((c) => c.from !== id && c.to !== id);
  nodes.forEach((n) => {
    n.connections = n.connections.filter((c) => c !== id);
  });
  document.getElementById("note-" + id)?.remove();
  nodes = nodes.filter((n) => n.id !== id);
  selectedNodeIds.delete(id);
  if (openNodeId === id) closePanel();
  if (focusNodeId === id) clearFocus();
  renderAllConnections();
  updateStatus();
  updateMultiBar();
  save();
}

function cycleNodeDone(id) {
  const node = nodes.find((n) => n.id === id);
  if (!node) return;
  if (!node.done && !node.crossed) {
    node.done = true;
    node.crossed = false;
  } else if (node.done) {
    node.done = false;
    node.crossed = true;
  } else {
    node.done = false;
    node.crossed = false;
  }
  renderNote(node);
  if (openNodeId === id) refreshPanelDone(node);
  save();
}

function changeNodeColor(id, color) {
  const node = nodes.find((n) => n.id === id);
  if (!node) return;
  node.color = color;
  renderNote(node);
  if (openNodeId === id) refreshPanelColorPicker(node);
  save();
}

// ── Drag ─────────────────────────────────────
function makeDraggable(el, node) {
  let sx, sy, snx, sny, moved, longPressTimer;
  el.addEventListener("mousedown", (e) => {
    if (
      ["note-connect-btn", "note-del-btn", "note-done-btn", "note-check"].some(
        (c) => e.target.classList.contains(c),
      )
    )
      return;
    if (e.button !== 0) return;
    e.stopPropagation();
    moved = false;
    isDraggingNode = false;
    sx = e.clientX;
    sy = e.clientY;
    snx = node.x;
    sny = node.y;
    el.classList.add("dragging");
    el.style.zIndex = 100;
    const mv = (e2) => {
      const dx = (e2.clientX - sx) / vz,
        dy = (e2.clientY - sy) / vz;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        moved = true;
        isDraggingNode = true;
      }
      node.x = snx + dx;
      node.y = sny + dy;
      el.style.left = node.x + "px";
      el.style.top = node.y + "px";
      renderAllConnections();
    };
    const up = () => {
      el.classList.remove("dragging");
      el.style.zIndex = "";
      setTimeout(() => {
        isDraggingNode = false;
      }, 50);
      if (moved) save();
      document.removeEventListener("mousemove", mv);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", mv);
    document.addEventListener("mouseup", up);
  });
  el.addEventListener(
    "touchstart",
    (e) => {
      if (
        e.target.closest(".note-connect-btn") ||
        e.target.closest(".note-del-btn") ||
        e.target.closest(".note-done-btn") ||
        e.target.closest(".note-check")
      )
        return;
      e.stopPropagation();
      moved = false;
      isDraggingNode = false;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      snx = node.x;
      sny = node.y;
      el.classList.add("dragging");
      el.style.zIndex = 100;
      longPressTimer = setTimeout(() => {
        ctxTargetId = node.id;
        showCtxMenu(sx, sy);
        el.classList.remove("dragging");
      }, 300);
      const mv = (e2) => {
        clearTimeout(longPressTimer);
        const dx = (e2.touches[0].clientX - sx) / vz,
          dy = (e2.touches[0].clientY - sy) / vz;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          moved = true;
          isDraggingNode = true;
        }
        node.x = snx + dx;
        node.y = sny + dy;
        el.style.left = node.x + "px";
        el.style.top = node.y + "px";
        renderAllConnections();
        e2.preventDefault();
      };
      const up = () => {
        clearTimeout(longPressTimer);
        el.classList.remove("dragging");
        el.style.zIndex = "";
        setTimeout(() => {
          isDraggingNode = false;
        }, 50);
        if (moved) save();
        el.removeEventListener("touchmove", mv);
        el.removeEventListener("touchend", up);
      };
      el.addEventListener("touchmove", mv, { passive: false });
      el.addEventListener("touchend", up);
    },
    { passive: false },
  );
}

// ── Multi-Select ──────────────────────────────
function addToSelection(id) {
  selectedNodeIds.add(id);
  const el = document.getElementById("note-" + id);
  if (el) {
    el.classList.add("selected-node");
    el.querySelector(".note-check").checked = true;
  }
  updateMultiBar();
}
function removeFromSelection(id) {
  selectedNodeIds.delete(id);
  const el = document.getElementById("note-" + id);
  if (el) {
    el.classList.remove("selected-node");
    el.querySelector(".note-check").checked = false;
  }
  updateMultiBar();
}
function toggleSelectNode(id) {
  if (selectedNodeIds.has(id)) removeFromSelection(id);
  else addToSelection(id);
}
function clearSelection() {
  selectedNodeIds.forEach((id) => {
    const el = document.getElementById("note-" + id);
    if (el) {
      el.classList.remove("selected-node");
      el.querySelector(".note-check").checked = false;
    }
  });
  selectedNodeIds.clear();
  updateMultiBar();
}
function selectAll() {
  nodes.forEach((n) => addToSelection(n.id));
}
function updateMultiBar() {
  const c = selectedNodeIds.size;
  mbCount.textContent = c;
  multiBar.classList.toggle("visible", c > 0);
}

document.getElementById("mb-mark-done").addEventListener("click", () => {
  selectedNodeIds.forEach((id) => {
    const n = nodes.find((x) => x.id === id);
    if (n) {
      n.done = true;
      n.crossed = false;
      renderNote(n);
    }
  });
  save();
});
document.getElementById("mb-mark-cross").addEventListener("click", () => {
  selectedNodeIds.forEach((id) => {
    const n = nodes.find((x) => x.id === id);
    if (n) {
      n.done = false;
      n.crossed = true;
      renderNote(n);
    }
  });
  save();
});
document.getElementById("mb-clear-status").addEventListener("click", () => {
  selectedNodeIds.forEach((id) => {
    const n = nodes.find((x) => x.id === id);
    if (n) {
      n.done = false;
      n.crossed = false;
      renderNote(n);
    }
  });
  save();
});
document.getElementById("mb-delete").addEventListener("click", () => {
  const ids = [...selectedNodeIds];
  clearSelection();
  ids.forEach((id) => deleteNode(id));
});
document
  .getElementById("mb-deselect")
  .addEventListener("click", clearSelection);
document.querySelectorAll(".mb-swatch").forEach((sw) => {
  sw.addEventListener("click", () => {
    selectedNodeIds.forEach((id) => changeNodeColor(id, sw.dataset.color));
  });
});
document.getElementById("btn-select-all").addEventListener("click", () => {
  if (selectedNodeIds.size === nodes.length) clearSelection();
  else selectAll();
});

// ── Rubber-band ───────────────────────────────
canvasWrap.addEventListener("mousedown", (e) => {
  if (e.target.closest(".note")) return;
  if (e.button === 1 || spaceDown) return;
  if (e.shiftKey) {
    rbStart = screenToCanvas(e.clientX, e.clientY);
    rbActive = true;
    selRect.style.display = "block";
    selRect.style.left = rbStart.x + "px";
    selRect.style.top = rbStart.y + "px";
    selRect.style.width = "0";
    selRect.style.height = "0";
  }
  hideCtxMenu();
  connPopup.style.display = "none";
  if (!e.shiftKey) clearSelection();
});
document.addEventListener("mousemove", (e) => {
  if (isPanning) {
    vx += e.clientX - lastMouse.x;
    vy += e.clientY - lastMouse.y;
    lastMouse = { x: e.clientX, y: e.clientY };
    applyTransform();
  }
  if (rbActive && rbStart) {
    const cur = screenToCanvas(e.clientX, e.clientY);
    const x = Math.min(rbStart.x, cur.x),
      y = Math.min(rbStart.y, cur.y),
      w = Math.abs(cur.x - rbStart.x),
      h = Math.abs(cur.y - rbStart.y);
    selRect.style.left = x + "px";
    selRect.style.top = y + "px";
    selRect.style.width = w + "px";
    selRect.style.height = h + "px";
  }
});
document.addEventListener("mouseup", (e) => {
  if (isPanning) {
    isPanning = false;
    canvasWrap.style.cursor = spaceDown ? "grab" : "";
  }
  if (rbActive) {
    rbActive = false;
    selRect.style.display = "none";
    if (rbStart) {
      const cur = screenToCanvas(e.clientX, e.clientY);
      const x1 = Math.min(rbStart.x, cur.x),
        y1 = Math.min(rbStart.y, cur.y),
        x2 = Math.max(rbStart.x, cur.x),
        y2 = Math.max(rbStart.y, cur.y);
      if (x2 - x1 > 8 || y2 - y1 > 8) {
        nodes.forEach((n) => {
          const cx = n.x + 90,
            cy = n.y + 55;
          if (cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2)
            addToSelection(n.id);
        });
      }
    }
    rbStart = null;
  }
});

// ── Connections ───────────────────────────────
function startConnection(fromId) {
  isConnecting = true;
  connectSourceId = fromId;
  document.getElementById("note-" + fromId)?.classList.add("connecting-source");
  document.getElementById("hint-text").textContent =
    "Click another node to connect… [ESC to cancel]";
  document.getElementById("sb-mode").textContent = "MODE: CONNECTING";
  nodes.forEach((n) => {
    if (n.id !== fromId)
      document.getElementById("note-" + n.id)?.classList.add("connect-target");
  });
}
function finishConnection(toId) {
  if (!connectSourceId || toId === connectSourceId) {
    cancelConnection();
    return;
  }
  const exists = connections.find(
    (c) =>
      (c.from === connectSourceId && c.to === toId) ||
      (c.from === toId && c.to === connectSourceId),
  );
  if (exists) {
    cancelConnection();
    return;
  }
  pendingConn = { fromId: connectSourceId, toId };
  const toEl = document.getElementById("note-" + toId);
  const rect = toEl.getBoundingClientRect();
  connPopup.style.left =
    Math.min(rect.right + 10, window.innerWidth - 210) + "px";
  connPopup.style.top = Math.min(rect.top, window.innerHeight - 160) + "px";
  connPopup.style.display = "block";
  cancelConnectionVisuals();
}
function cancelConnectionVisuals() {
  if (connectSourceId)
    document
      .getElementById("note-" + connectSourceId)
      ?.classList.remove("connecting-source");
  nodes.forEach((n) =>
    document.getElementById("note-" + n.id)?.classList.remove("connect-target"),
  );
  isConnecting = false;
  connectSourceId = null;
  document.getElementById("hint-text").textContent =
    "Dbl-click canvas → node · Shift+drag → select area · Shift+click → select";
  document.getElementById("sb-mode").textContent = "MODE: EXPLORE";
}
function cancelConnection() {
  cancelConnectionVisuals();
  connPopup.style.display = "none";
}

document.getElementById("conn-confirm-btn").addEventListener("click", () => {
  const type = document.getElementById("conn-type-select").value;
  if (pendingConn.fromId && pendingConn.toId) {
    connections.push({
      id: uid(),
      from: pendingConn.fromId,
      to: pendingConn.toId,
      type,
    });
    const fn = nodes.find((n) => n.id === pendingConn.fromId),
      tn = nodes.find((n) => n.id === pendingConn.toId);
    if (fn && !fn.connections.includes(pendingConn.toId))
      fn.connections.push(pendingConn.toId);
    if (tn && !tn.connections.includes(pendingConn.fromId))
      tn.connections.push(pendingConn.fromId);
    renderAllConnections();
    updateStatus();
    save();
    if (openNodeId) updatePanelConnections(openNodeId);
  }
  connPopup.style.display = "none";
  pendingConn = {};
});

// ── SVG ───────────────────────────────────────
function renderAllConnections() {
  svgEl.innerHTML = "";
  connections.forEach((c) => renderConnection(c));
}
function renderConnection(c) {
  const from = nodes.find((n) => n.id === c.from),
    to = nodes.find((n) => n.id === c.to);
  if (!from || !to) return;
  const f = getNoteCenter(from),
    t = getNoteCenter(to);
  const mx = (f.x + t.x) / 2,
    my = (f.y + t.y) / 2 - Math.abs(t.x - f.x) * 0.08;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M${f.x},${f.y} Q${mx},${my} ${t.x},${t.y}`);
  path.classList.add("connection-line");
  if (focusNodeId) {
    if (c.from === focusNodeId || c.to === focusNodeId)
      path.classList.add("focused");
    else path.classList.add("faded");
  }
  svgEl.appendChild(path);
  [f, t].forEach((pt) => {
    const ci = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    ci.setAttribute("cx", pt.x);
    ci.setAttribute("cy", pt.y);
    ci.setAttribute("r", "4");
    ci.classList.add("conn-dot");
    svgEl.appendChild(ci);
  });
  if (c.type) {
    const lbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
    lbl.setAttribute("x", (f.x + t.x) / 2);
    lbl.setAttribute("y", my - 6);
    lbl.setAttribute("text-anchor", "middle");
    lbl.setAttribute("font-size", "9");
    lbl.setAttribute("font-family", "Courier Prime,monospace");
    lbl.setAttribute(
      "fill",
      focusNodeId
        ? c.from === focusNodeId || c.to === focusNodeId
          ? "#d4a012"
          : "rgba(100,80,40,.3)"
        : "#8b7355",
    );
    lbl.textContent = c.type;
    svgEl.appendChild(lbl);
  }
}

// ── Panel ─────────────────────────────────────
function openPanel(id) {
  const node = nodes.find((n) => n.id === id);
  if (!node) return;
  openNodeId = id;
  panelTitle.value = node.title;
  panelNotes.value = node.notes;
  document
    .querySelectorAll(".state-btn")
    .forEach((b) =>
      b.classList.toggle("active", b.dataset.state === node.state),
    );
  refreshPanelColorPicker(node);
  refreshPanelDone(node);
  renderChecklist(node);
  updatePanelConnections(id);
  sidePanel.classList.add("open");
}
function closePanel() {
  sidePanel.classList.remove("open");
  openNodeId = null;
}
function savePanel() {
  if (!openNodeId) return;
  const node = nodes.find((n) => n.id === openNodeId);
  if (!node) return;
  node.title = panelTitle.value || "Untitled";
  node.notes = panelNotes.value;
  renderNote(node);
  save();
}
panelTitle.addEventListener("input", savePanel);
panelNotes.addEventListener("input", savePanel);
document.getElementById("panel-close").addEventListener("click", closePanel);

document.querySelectorAll(".state-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!openNodeId) return;
    const node = nodes.find((n) => n.id === openNodeId);
    if (!node) return;
    node.state = btn.dataset.state;
    document
      .querySelectorAll(".state-btn")
      .forEach((b) => b.classList.toggle("active", b === btn));
    renderNote(node);
    save();
  });
});

document.querySelectorAll(".panel-swatch").forEach((sw) => {
  sw.addEventListener("click", () => {
    if (!openNodeId) return;
    changeNodeColor(openNodeId, sw.dataset.color);
  });
});
function refreshPanelColorPicker(node) {
  document
    .querySelectorAll(".panel-swatch")
    .forEach((sw) =>
      sw.classList.toggle("active", sw.dataset.color === node.color),
    );
}

document.getElementById("panel-done-cb").addEventListener("change", (e) => {
  if (!openNodeId) return;
  const node = nodes.find((n) => n.id === openNodeId);
  if (!node) return;
  node.done = e.target.checked;
  if (node.done) node.crossed = false;
  renderNote(node);
  refreshPanelDone(node);
  save();
});
function refreshPanelDone(node) {
  const cb = document.getElementById("panel-done-cb"),
    tog = document.getElementById("panel-done-toggle"),
    lbl = document.getElementById("panel-done-label");
  cb.checked = node.done;
  tog.classList.toggle("done-active", node.done);
  lbl.textContent = node.done ? "✓ Marked Complete" : "Mark as Complete / Done";
}

// Checklist
function renderChecklist(node) {
  const cl = document.getElementById("panel-checklist");
  cl.innerHTML = "";
  (node.checklist || []).forEach((item, i) => {
    const div = document.createElement("div");
    div.className =
      "check-item" +
      (item.done ? " item-done" : item.crossed ? " item-crossed" : "");
    div.innerHTML = `<span class="ci-status">${item.done ? "✓" : item.crossed ? "✕" : "○"}</span>
      <span class="ci-text" contenteditable="true">${item.text}</span>
      <div class="cia">
        <button class="ci-btn tick" title="Mark done">✓</button>
        <button class="ci-btn cross" title="Cross out">✕</button>
        <button class="ci-btn del" title="Delete">✗</button>
      </div>`;
    div.querySelector(".ci-text").addEventListener("input", (e2) => {
      item.text = e2.target.textContent;
      save();
    });
    div.querySelector(".tick").addEventListener("click", () => {
      item.done = !item.done;
      if (item.done) item.crossed = false;
      renderChecklist(node);
      save();
    });
    div.querySelector(".cross").addEventListener("click", () => {
      item.crossed = !item.crossed;
      if (item.crossed) item.done = false;
      renderChecklist(node);
      save();
    });
    div.querySelector(".del").addEventListener("click", () => {
      node.checklist.splice(i, 1);
      renderChecklist(node);
      save();
    });
    cl.appendChild(div);
  });
}
document.getElementById("add-check-btn").addEventListener("click", () => {
  if (!openNodeId) return;
  const node = nodes.find((n) => n.id === openNodeId);
  if (!node) return;
  if (!node.checklist) node.checklist = [];
  node.checklist.push({ text: "New task", done: false, crossed: false });
  renderChecklist(node);
  save();
});

function updatePanelConnections(id) {
  const node = nodes.find((n) => n.id === id);
  if (!node) return;
  const list = document.getElementById("panel-connections-list");
  list.innerHTML = "";
  const ci = connections
    .filter((c) => c.from === id || c.to === id)
    .map((c) => ({ id: c.from === id ? c.to : c.from, type: c.type }));
  if (!ci.length) {
    list.innerHTML =
      '<div style="font-size:10px;color:var(--text-dim)">No connections yet.</div>';
    return;
  }
  ci.forEach(({ id: cid, type }) => {
    const cn = nodes.find((n) => n.id === cid);
    if (!cn) return;
    const tag = document.createElement("div");
    tag.className = "conn-tag";
    tag.textContent = `${type}: ${cn.title}`;
    list.appendChild(tag);
  });
}

// ── Focus ─────────────────────────────────────
function setFocus(id) {
  focusNodeId = id;
  focusOverlay.classList.add("active");
  document.getElementById("btn-focus").style.display = "none";
  document.getElementById("btn-clear-focus").style.display = "";
  document.getElementById("sb-mode").textContent = "MODE: FOCUS";
  const related = connections
    .filter((c) => c.from === id || c.to === id)
    .map((c) => (c.from === id ? c.to : c.from));
  nodes.forEach((n) => {
    const el = document.getElementById("note-" + n.id);
    if (!el) return;
    if (n.id === id || related.includes(n.id)) {
      el.classList.remove("faded");
      el.classList.toggle("focused", n.id === id);
    } else el.classList.add("faded");
  });
  renderAllConnections();
}
function clearFocus() {
  focusNodeId = null;
  focusOverlay.classList.remove("active");
  document.getElementById("btn-focus").style.display = "";
  document.getElementById("btn-clear-focus").style.display = "none";
  document.getElementById("sb-mode").textContent = "MODE: EXPLORE";
  nodes.forEach((n) => {
    const el = document.getElementById("note-" + n.id);
    if (el) el.classList.remove("faded", "focused");
  });
  renderAllConnections();
}
document.getElementById("btn-focus").addEventListener("click", () => {
  if (openNodeId) setFocus(openNodeId);
});
document
  .getElementById("btn-clear-focus")
  .addEventListener("click", clearFocus);

// ── Context Menu ──────────────────────────────
function showCtxMenu(x, y) {
  const mx = Math.min(x, window.innerWidth - 200),
    my = Math.min(y, window.innerHeight - 280);
  ctxMenu.style.left = mx + "px";
  ctxMenu.style.top = my + "px";
  ctxMenu.style.display = "block";
}
function hideCtxMenu() {
  ctxMenu.style.display = "none";
}
document.getElementById("ctx-open").addEventListener("click", () => {
  openPanel(ctxTargetId);
  hideCtxMenu();
});
document.getElementById("ctx-connect").addEventListener("click", () => {
  startConnection(ctxTargetId);
  hideCtxMenu();
});
document.getElementById("ctx-focus").addEventListener("click", () => {
  setFocus(ctxTargetId);
  hideCtxMenu();
});
document.getElementById("ctx-done").addEventListener("click", () => {
  cycleNodeDone(ctxTargetId);
  hideCtxMenu();
});
document.getElementById("ctx-delete").addEventListener("click", () => {
  deleteNode(ctxTargetId);
  hideCtxMenu();
});
document.querySelectorAll(".ctx-swatch").forEach((sw) => {
  sw.addEventListener("click", (e) => {
    e.stopPropagation();
    changeNodeColor(ctxTargetId, sw.dataset.color);
    hideCtxMenu();
  });
});
document.addEventListener("click", () => hideCtxMenu());

// ── Canvas pan & zoom ─────────────────────────
document.addEventListener("keydown", (e) => {
  if (
    e.code === "Space" &&
    !e.target.closest("input,textarea,[contenteditable]")
  ) {
    spaceDown = true;
    canvasWrap.style.cursor = "grab";
    e.preventDefault();
  }
  if (e.code === "Escape") {
    cancelConnection();
    closePanel();
    clearFocus();
    clearSelection();
  }
  if (
    (e.key === "Delete" || e.key === "Backspace") &&
    selectedNodeIds.size > 0 &&
    !e.target.closest("input,textarea,[contenteditable]")
  ) {
    const ids = [...selectedNodeIds];
    clearSelection();
    ids.forEach((id) => deleteNode(id));
  }
});
document.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    spaceDown = false;
    canvasWrap.style.cursor = "";
  }
});

canvasWrap.addEventListener("mousedown", (e) => {
  if (e.target.closest(".note")) return;
  if (e.button === 1 || spaceDown) {
    isPanning = true;
    lastMouse = { x: e.clientX, y: e.clientY };
    canvasWrap.style.cursor = "grabbing";
    e.preventDefault();
  }
});
canvasWrap.addEventListener("dblclick", (e) => {
  if (e.target.closest(".note")) return;
  if (e.target.closest("#ctx-menu")) return;
  if (e.target.closest("#conn-label-popup")) return;
  if (e.target.closest("#new-plan-modal")) return;
  if (e.target.closest("#side-panel")) return;
  if (e.target.closest("#plans-drawer")) return;
  const pt = screenToCanvas(e.clientX, e.clientY);
  const node = createNode(pt.x, pt.y);
  setTimeout(() => openPanel(node.id), 50);
});
canvasWrap.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const nz = clamp(vz * factor, 0.2, 3);
    vx = e.clientX - (e.clientX - vx) * (nz / vz);
    vy = e.clientY - (e.clientY - vy) * (nz / vz);
    vz = nz;
    applyTransform();
  },
  { passive: false },
);

// ── Touch / Swipe Pan ────────────────────────────
let touchStartX = 0,
  touchStartY = 0,
  touchLastX = 0,
  touchLastY = 0,
  touchMoved = false;
let pinchStartDist = 0,
  pinchStartVz = 1,
  pinchCenterX = 0,
  pinchCenterY = 0;
canvasWrap.addEventListener(
  "touchstart",
  (e) => {
    if (e.target.closest(".note")) return;
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchLastX = touchStartX;
      touchLastY = touchStartY;
      touchMoved = false;
      isPanning = true;
      lastMouse = { x: touchStartX, y: touchStartY };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist = Math.sqrt(dx * dx + dy * dy);
      pinchStartVz = vz;
      pinchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      pinchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      isPanning = false;
    }
  },
  { passive: true },
);
canvasWrap.addEventListener(
  "touchmove",
  (e) => {
    if (e.target.closest(".note")) return;
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const factor = dist / pinchStartDist;
      const nz = clamp(pinchStartVz * factor, 0.2, 3);
      vx = pinchCenterX - (pinchCenterX - vx) * (nz / vz);
      vy = pinchCenterY - (pinchCenterY - vy) * (nz / vz);
      vz = nz;
      applyTransform();
      e.preventDefault();
    } else if (e.touches.length === 1 && isPanning) {
      const tx = e.touches[0].clientX,
        ty = e.touches[0].clientY;
      const dx = tx - touchLastX,
        dy = ty - touchLastY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        touchMoved = true;
      }
      vx += dx;
      vy += dy;
      lastMouse = { x: tx, y: ty };
      touchLastX = tx;
      touchLastY = ty;
      applyTransform();
      e.preventDefault();
    }
  },
  { passive: false },
);
canvasWrap.addEventListener(
  "touchend",
  (e) => {
    isPanning = false;
    pinchStartDist = 0;
  },
  { passive: true },
);
canvasWrap.addEventListener("touchcancel", (e) => {
  isPanning = false;
  pinchStartDist = 0;
});

document.addEventListener("dblclick", (e) => {
  if (window.matchMedia("(max-width:768px)").matches) return;
  if (e.target.closest(".note")) return;
  if (e.target.closest("#ctx-menu")) return;
  if (e.target.closest("#conn-label-popup")) return;
  if (e.target.closest("#new-plan-modal")) return;
  if (e.target.closest("#side-panel")) return;
  if (e.target.closest("#plans-drawer")) return;
  const pt = screenToCanvas(e.clientX, e.clientY);
  const node = createNode(pt.x, pt.y);
  setTimeout(() => openPanel(node.id), 50);
});

// ── Fit All ───────────────────────────────────
document.getElementById("btn-fit").addEventListener("click", fitAll);
function fitAll() {
  if (!nodes.length) {
    vx = 0;
    vy = 52;
    vz = 1;
    applyTransform();
    return;
  }
  const xs = nodes.map((n) => n.x),
    ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs) - 40,
    maxX = Math.max(...xs) + 220,
    minY = Math.min(...ys) - 40,
    maxY = Math.max(...ys) + 150;
  const w = maxX - minX,
    h = maxY - minY;
  vz =
    Math.min(window.innerWidth / w, (window.innerHeight - 80) / h, 1.5) * 0.85;
  vx = (window.innerWidth - w * vz) / 2 - minX * vz;
  vy = 52 + (window.innerHeight - 80 - h * vz) / 2 - minY * vz;
  applyTransform();
}

document.getElementById("btn-new").addEventListener("click", () => {
  const cx = (window.innerWidth / 2 - vx) / vz,
    cy = (window.innerHeight / 2 - vy) / vz;
  const node = createNode(cx, cy);
  setTimeout(() => openPanel(node.id), 50);
});
document.querySelectorAll(".swatch").forEach((sw) => {
  sw.addEventListener("click", () => {
    document
      .querySelectorAll(".swatch")
      .forEach((s) => s.classList.remove("selected"));
    sw.classList.add("selected");
    selectedColor = sw.dataset.color;
  });
});
document.getElementById("btn-save").addEventListener("click", () => {
  save();
  flashSave();
});

// ── Plans ─────────────────────────────────────
document
  .getElementById("btn-plans")
  .addEventListener("click", () => plansDrawer.classList.toggle("open"));
document
  .getElementById("plans-close")
  .addEventListener("click", () => plansDrawer.classList.remove("open"));
document.getElementById("new-plan-btn").addEventListener("click", () => {
  document.getElementById("new-plan-name").value = "";
  document.getElementById("new-plan-modal").classList.add("visible");
  setTimeout(() => document.getElementById("new-plan-name").focus(), 100);
});
document
  .getElementById("npm-cancel")
  .addEventListener("click", () =>
    document.getElementById("new-plan-modal").classList.remove("visible"),
  );
document.getElementById("npm-confirm").addEventListener("click", doCreatePlan);
document.getElementById("new-plan-name").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doCreatePlan();
  if (e.key === "Escape")
    document.getElementById("new-plan-modal").classList.remove("visible");
});

function doCreatePlan() {
  const name =
    document.getElementById("new-plan-name").value.trim() || "Untitled Plan";
  saveCurrentPlanState();
  const plan = {
    id: uid(),
    name,
    createdAt: Date.now(),
    nodes: [],
    connections: [],
  };
  plans.push(plan);
  switchToPlan(plan.id);
  document.getElementById("new-plan-modal").classList.remove("visible");
}

function switchToPlan(planId) {
  saveCurrentPlanState();
  nodes.forEach((n) => document.getElementById("note-" + n.id)?.remove());
  nodes = [];
  connections = [];
  svgEl.innerHTML = "";
  closePanel();
  clearFocus();
  clearSelection();
  activePlanId = planId;
  const plan = plans.find((p) => p.id === planId);
  if (plan) {
    nodes = JSON.parse(JSON.stringify(plan.nodes || []));
    connections = JSON.parse(JSON.stringify(plan.connections || []));
  }
  nodes.forEach((n) => renderNote(n));
  renderAllConnections();
  updateStatus();
  document.getElementById("sb-plan-name").textContent =
    "PLAN: " + (plan ? plan.name.toUpperCase() : "—");
  setTimeout(fitAll, 100);
  saveUserData();
  renderPlansList();
}

function saveCurrentPlanState() {
  const plan = plans.find((p) => p.id === activePlanId);
  if (plan) {
    plan.nodes = JSON.parse(JSON.stringify(nodes));
    plan.connections = JSON.parse(JSON.stringify(connections));
  }
}

function makeEditable(element, currentValue, onSave) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentValue;
  input.className = 'inline-edit-input';
  element.textContent = '';
  element.appendChild(input);
  input.focus();
  input.select();
  
  const save = () => {
    const newValue = input.value.trim();
    if (newValue && newValue !== currentValue) {
      onSave(newValue);
    } else {
      element.textContent = currentValue;
    }
  };
  
  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') element.textContent = currentValue;
  });
}

function renderPlansList() {
  const list = document.getElementById("plans-list");
  list.innerHTML = "";
  plans.forEach((plan) => {
    const card = document.createElement("div");
    card.className =
      "plan-card" + (plan.id === activePlanId ? " active-plan" : "");
    const d = new Date(plan.createdAt);
    card.innerHTML = `<div class="plan-card-title">${plan.name}</div>
      <div class="plan-card-meta">${(plan.nodes || []).length} nodes · ${d.toLocaleDateString()}</div>
      <button class="plan-card-del" title="Delete plan">🗑</button>`;
    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("plan-card-del")) return;
      if (plan.id !== activePlanId) switchToPlan(plan.id);
    });
    
    const titleEl = card.querySelector(".plan-card-title");
    titleEl.addEventListener("click", (e) => {
      e.stopPropagation();
      makeEditable(titleEl, plan.name, (newName) => {
        plan.name = newName;
        document.getElementById("sb-plan-name").textContent = "PLAN: " + plan.name.toUpperCase();
        renderPlansList();
        saveUserData();
      });
    });
    
    card.querySelector(".plan-card-del").addEventListener("click", (e) => {
      e.stopPropagation();
      deletePlan(plan.id);
    });
    list.appendChild(card);
  });
}

// Add click handler for status bar plan name
document.getElementById("sb-plan-name").addEventListener("click", () => {
  const currentPlan = plans.find(p => p.id === activePlanId);
  if (!currentPlan) return;
  const el = document.getElementById("sb-plan-name");
  makeEditable(el, currentPlan.name, (newName) => {
    currentPlan.name = newName;
    el.textContent = "PLAN: " + newName.toUpperCase();
    renderPlansList();
    saveUserData();
  });
});
function deletePlan(id) {
  if (plans.length <= 1) {
    alert("Cannot delete the last plan.");
    return;
  }
  plans = plans.filter((p) => p.id !== id);
  if (activePlanId === id) switchToPlan(plans[0].id);
  saveUserData();
  renderPlansList();
}

// ── Save / Load ───────────────────────────────
let autoSaveInterval = null;
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

function save() {
  saveCurrentPlanState();
  saveUserData();
  document.getElementById("sb-save-status").textContent =
    "✓ SAVED " + new Date().toLocaleTimeString();
}

function startAutoSave() {
  if (autoSaveInterval) clearInterval(autoSaveInterval);
  autoSaveInterval = setInterval(() => {
    saveCurrentPlanState();
    saveUserData();
    document.getElementById("sb-save-status").textContent =
      "↻ AUTO " + new Date().toLocaleTimeString();
    document.getElementById("sb-save-status").style.color = "var(--amber)";
    setTimeout(() => {
      document.getElementById("sb-save-status").style.color = "";
    }, 2000);
  }, AUTO_SAVE_INTERVAL);
}

function stopAutoSave() {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
}
function saveUserData() {
  saveCurrentPlanState();
  if (!currentUsername) return;
  const viewState = {
    vx: vx,
    vy: vy,
    vz: vz,
    activePlanId: activePlanId
  };
  fetch(`/api/users/${currentUsername}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plans: plans, viewState: viewState })
  }).catch(e => console.error("Save error:", e));
}
function loadUserData(username) {
  return fetch(`/api/users/${username}`)
    .then(res => {
      if (!res.ok) {
        if (res.status === 503) return res.text().then(t => Promise.reject(new Error('Database not connected. Please try again.')));
        return res.json().then(t => Promise.reject(new Error(t.error || 'Unknown error')));
      }
      return res.json();
    })
    .then(data => {
      if (data.exists && data.user) {
        return data.user;
      }
      return null;
    })
    .catch(e => {
      console.error("Load error:", e);
      return null;
    });
}
function createUser(username) {
  return fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username })
  })
    .then(res => {
      if (!res.ok) {
        if (res.status === 503) return res.text().then(t => Promise.reject(new Error('Database not connected. Please try again.')));
        return res.json().then(t => Promise.reject(new Error(t.error || 'Unknown error')));
      }
      return res.json();
    })
    .then(data => {
      if (data.success) {
        return data.user;
      }
      throw new Error(data.error || "Failed to create user");
    })
    .catch(e => {
      console.error("Create user error:", e);
      throw e;
    });
}
function flashSave() {
  const el = document.getElementById("sb-save-status");
  el.style.color = "var(--amber)";
  setTimeout(() => (el.style.color = ""), 1500);
}
function updateStatus() {
  document.getElementById("sb-nodes").textContent = nodes.length + " NODES";
  document.getElementById("sb-connections").textContent =
    connections.length + " CONNECTIONS";
}

// ── Splash / Tutorial ─────────────────────────
document.getElementById("splash-btn").addEventListener("click", () => {
  const s = document.getElementById("splash");
  s.classList.add("out");
  setTimeout(() => s.remove(), 700);
});
document.getElementById("tutorial-close").addEventListener("click", () => {
  const t = document.getElementById("tutorial");
  t.style.opacity = "0";
  setTimeout(() => t.remove(), 500);
});
// Tutorial close handled in initBoard() function

// ── INIT ──────────────────────────────────────
function seedDemoPlan(plan) {
  const seed = [
    {
      x: 400,
      y: 200,
      title: "HTML",
      notes: "Foundation of the web.",
      state: "understood",
      color: "o",
    },
    {
      x: 650,
      y: 160,
      title: "CSS",
      notes: "Styling, layout, Flexbox & Grid.",
      state: "understood",
      color: "b",
    },
    {
      x: 950,
      y: 200,
      title: "JavaScript",
      notes: "Dynamic behavior. ES6+, DOM.",
      state: "learning",
      color: "y",
    },
    {
      x: 1250,
      y: 180,
      title: "React",
      notes: "Component model, hooks.",
      state: "learning",
      color: "g",
    },
    {
      x: 700,
      y: 440,
      title: "Backend",
      notes: "Node.js, Express, REST APIs.",
      state: "idea",
      color: "p",
    },
    {
      x: 1100,
      y: 430,
      title: "TypeScript",
      notes: "Static typing for JavaScript.",
      state: "idea",
      color: "y",
    },
    {
      x: 400,
      y: 450,
      title: "Git",
      notes: "Branching, commits, pull requests.",
      state: "understood",
      color: "g",
    },
  ];
  seed.forEach((s) => {
    const rot = (Math.random() - 0.5) * 6;
    const n = {
      id: uid(),
      x: s.x,
      y: s.y,
      title: s.title,
      notes: s.notes,
      state: s.state,
      color: s.color,
      rot,
      checklist: [
        { text: "Study basics", done: true, crossed: false },
        { text: "Build a project", done: false, crossed: false },
        { text: "Teach someone", done: false, crossed: false },
      ],
      connections: [],
      done: false,
      crossed: false,
    };
    plan.nodes.push(n);
  });
  const ns = plan.nodes;
  [
    [0, 1, "related to"],
    [0, 2, "leads to"],
    [1, 2, "related to"],
    [2, 3, "builds upon"],
    [2, 4, "leads to"],
    [3, 5, "builds upon"],
    [0, 6, "related to"],
  ].forEach(([ai, bi, type]) => {
    const a = ns[ai],
      b = ns[bi];
    if (!a || !b) return;
    plan.connections.push({ id: uid(), from: a.id, to: b.id, type });
    if (!a.connections.includes(b.id)) a.connections.push(b.id);
    if (!b.connections.includes(a.id)) b.connections.push(a.id);
    });
}

// Replace old init with new flow - handled in login section below

// ── User / Login ────────────────────────────────
function checkCachedUser() {
  return localStorage.getItem("mindboard_username");
}

function cacheUser(username) {
  localStorage.setItem("mindboard_username", username);
}

async function handleLogin(username) {
  const trimmedUsername = username.trim().toLowerCase();
  if (!trimmedUsername) {
    document.getElementById("login-error").textContent = "Please enter a username";
    return;
  }

  document.getElementById("login-error").textContent = "Loading your workspace...";
  document.getElementById("login-confirm").disabled = true;
  
  try {
    const userData = await loadUserData(trimmedUsername);
    
    if (userData) {
      currentUsername = trimmedUsername;
      cacheUser(currentUsername);
      plans = userData.plans || [];
      
      // If no plans, create new one
      if (!plans.length) {
        plans.push({
          id: uid(),
          name: "New Plan",
          createdAt: Date.now(),
          nodes: [],
          connections: []
        });
      }
      
      // Restore viewState and activePlanId
      if (userData.viewState) {
        vx = userData.viewState.vx || 0;
        vy = userData.viewState.vy || 52;
        vz = userData.viewState.vz || 1;
        if (userData.viewState.activePlanId) {
          const found = plans.find(p => p.id === userData.viewState.activePlanId);
          if (found) activePlanId = userData.viewState.activePlanId;
        }
      } else {
        activePlanId = plans[0]?.id || null;
      }
      
      // Initialize board first
      initBoard();
      applyTransform();
      
      // Wait for everything to fully load (canvas + drawer + fitAll)
      document.getElementById("login-error").textContent = "Loading canvas...";
      
      setTimeout(() => {
        // Open plans drawer briefly to show all plans loaded
        plansDrawer.classList.add('open');
        
        setTimeout(() => {
          plansDrawer.classList.remove('open');
          
          // Now hide login modal after everything is ready
          hideLoginModal();
          document.getElementById("login-confirm").disabled = false;
        }, 800);
      }, 200);
      
    } else {
      const newUser = await createUser(trimmedUsername);
      currentUsername = trimmedUsername;
      cacheUser(currentUsername);
      plans = newUser.plans || [];
      activePlanId = plans[0]?.id || null;
      
      initBoard();
      applyTransform();
      
      setTimeout(() => {
        plansDrawer.classList.add('open');
        setTimeout(() => {
          plansDrawer.classList.remove('open');
          hideLoginModal();
          document.getElementById("login-confirm").disabled = false;
        }, 800);
      }, 200);
    }
  } catch (e) {
    document.getElementById("login-error").textContent = "Error: " + e.message;
    document.getElementById("login-confirm").disabled = false;
  }
}

function hideLoginModal() {
  document.getElementById("login-modal").classList.add("hidden");
  document.getElementById("splash").classList.add("out");
  setTimeout(() => {
    document.getElementById("splash").remove();
  }, 700);
}

function initBoard() {
  if (!plans.length) {
    const plan = {
      id: uid(),
      name: "My First Plan",
      createdAt: Date.now(),
      nodes: [],
      connections: [],
    };
    plans.push(plan);
    activePlanId = plan.id;
  } else {
    const active = plans.find((p) => p.id === activePlanId) || plans[0];
    activePlanId = active.id;
    nodes = JSON.parse(JSON.stringify(active.nodes || []));
    connections = JSON.parse(JSON.stringify(active.connections || []));
    nodes.forEach((n) => renderNote(n));
  }
  
  renderAllConnections();
  updateStatus();
  document.getElementById("sb-plan-name").textContent =
    "PLAN: " + (plans.find(p => p.id === activePlanId)?.name || "—").toUpperCase();
  renderPlansList();
  setTimeout(fitAll, 150);
  
  startAutoSave();
  
  if (window.matchMedia("(max-width:768px)").matches) {
    document.getElementById("mobile-tutorial").style.display = "block";
    document.getElementById("tutorial").style.display = "none";
  }
}

// Initialize based on cached user
const cachedUser = checkCachedUser();
if (cachedUser) {
  document.getElementById("splash").classList.add("out");
  setTimeout(() => {
    document.getElementById("splash").remove();
    document.getElementById("login-username").value = cachedUser;
    handleLogin(cachedUser);
  }, 700);
} else {
  document.getElementById("splash-btn").addEventListener("click", () => {
    document.getElementById("login-modal").classList.remove("hidden");
  });
}

document.getElementById("login-confirm").addEventListener("click", () => {
  const username = document.getElementById("login-username").value;
  handleLogin(username);
});
document.getElementById("login-username").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const username = document.getElementById("login-username").value;
    handleLogin(username);
  }
});

// Mobile tutorial close
document.getElementById("mobile-tutorial-close").addEventListener("click", () => {
  const t = document.getElementById("mobile-tutorial");
  t.classList.add("hidden");
  document.getElementById("fab").classList.add("fab-low");
  document.getElementById("fab-menu").classList.add("fab-low");
  document.getElementById("multi-bar").classList.add("fab-low");
  setTimeout(() => {
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 500);
  }, 300);
});

// ── FAB ──────────────────────────────────────────
const fab = document.getElementById("fab");
const fabMenu = document.getElementById("fab-menu");
const fabOverlay = document.getElementById("fab-overlay");
function toggleFab() {
  fab.classList.toggle("open");
  fabMenu.classList.toggle("open");
  fabOverlay.classList.toggle("open");
}
fab.addEventListener("click", toggleFab);
fabOverlay.addEventListener("click", toggleFab);
document.getElementById("fab-plans").addEventListener("click", () => {
  toggleFab();
  plansDrawer.classList.toggle("open");
});
document.getElementById("fab-new").addEventListener("click", () => {
  toggleFab();
  const cx = (window.innerWidth / 2 - vx) / vz,
    cy = (window.innerHeight / 2 - vy) / vz;
  const node = createNode(cx, cy);
  setTimeout(() => openPanel(node.id), 50);
});
document.getElementById("fab-select").addEventListener("click", () => {
  toggleFab();
  if (selectedNodeIds.size === nodes.length) clearSelection();
  else selectAll();
});
document.getElementById("fab-focus").addEventListener("click", () => {
  toggleFab();
  if (openNodeId) setFocus(openNodeId);
});
document.getElementById("fab-fit").addEventListener("click", () => {
  toggleFab();
  fitAll();
});
document.getElementById("fab-save").addEventListener("click", () => {
  toggleFab();
  save();
  flashSave();
});
