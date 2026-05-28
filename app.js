// State Management for OpenWA Studio Flowchart and Live Simulator
let workflowState = {
  flowName: "WhatsApp CRM Gateway Router",
  gatewayUrl: "http://localhost:8080",
  nodes: [
    {
      id: "node_1",
      type: "trigger_on_message",
      title: "On Inbound WhatsApp",
      x: 60,
      y: 120,
      config: {
        triggerType: "all_messages",
        desc: "Reacts to any incoming messages from customers."
      },
      next: "node_2"
    },
    {
      id: "node_2",
      type: "logic_condition",
      title: "Routing Condition",
      x: 420,
      y: 150,
      config: {
        criteria: "keyword_matches",
        value: "pricing,cost,quote",
        caseSensitive: false
      },
      next: "node_3",
      failNext: "node_4"
    },
    {
      id: "node_3",
      type: "action_send_text",
      title: "Reply with Pricing",
      x: 780,
      y: 60,
      config: {
        messageText: "Our starter tier is $49/mo, offering unlimited auto-responses. Get fully hosted OpenWA keys instantly with API!",
        keepSessionAlive: true
      },
      next: "node_5"
    },
    {
      id: "node_4",
      type: "action_send_buttons",
      title: "Interactive Menu",
      x: 780,
      y: 280,
      config: {
        buttonText: "Sorry, I didn't recognize that! What are you trying to achieve today?",
        optionsList: "Pricing Plans, Technical Specs, Talk to Agent"
      },
      next: ""
    },
    {
      id: "node_5",
      type: "logic_webhook_forward",
      title: "Log CRM Event",
      x: 1120,
      y: 80,
      config: {
        webhookUrl: "https://api.crm-connector.io/v1/leads",
        method: "POST"
      },
      next: ""
    }
  ]
};

let selectedNodeId = null;
let currentDraggingNode = null;
let dragOffset = { x: 0, y: 0 };

// Presets / Starter Templates
const TEMPLATES = {
  faq_responder: {
    flowName: "FAQ Keyword Auto-Responder",
    nodes: [
      {
        id: "t_1",
        type: "trigger_on_message",
        title: "Customer Inbound Msg",
        x: 80,
        y: 150,
        config: { triggerType: "all_messages" },
        next: "t_2"
      },
      {
        id: "t_2",
        type: "logic_condition",
        title: "Match 'help'",
        x: 400,
        y: 150,
        config: { criteria: "keyword_matches", value: "help,support" },
        next: "t_3",
        failNext: "t_4"
      },
      {
        id: "t_3",
        type: "action_send_text",
        title: "Help Manual Text",
        x: 720,
        y: 60,
        config: { messageText: "Please type: '1' for order status, '2' to file complaints, or '3' for direct operator access." },
        next: ""
      },
      {
        id: "t_4",
        type: "action_send_text",
        title: "Fallback Out-Of-Office Reply",
        x: 720,
        y: 260,
        config: { messageText: "Thank you for reaching out! We will reply back inside 2 hours." },
        next: ""
      }
    ]
  },
  lead_generation: {
    flowName: "Interactive Lead Capture",
    nodes: [
      {
        id: "lg_1",
        type: "trigger_on_message",
        title: "Greeting Hook",
        x: 60,
        y: 180,
        config: { triggerType: "all_messages" },
        next: "lg_2"
      },
      {
        id: "lg_2",
        type: "action_send_buttons",
        title: "Ask Company Size",
        x: 360,
        y: 180,
        config: { buttonText: "Welcome! To connect you correctly, please choose your workspace size:", optionsList: "Solo-Founder, 2-10 Team, 10+ Enterprise" },
        next: "lg_3"
      },
      {
        id: "lg_3",
        type: "logic_webhook_forward",
        title: "CRM Lead Webhook",
        x: 680,
        y: 180,
        config: { webhookUrl: "https://webhooks.site/openwa-lead-trigger", method: "POST" },
        next: "lg_4"
      },
      {
        id: "lg_4",
        type: "action_send_text",
        title: "Acknowledge Routing",
        x: 980,
        y: 180,
        config: { messageText: "Success! An executive account manager will contact you directly on this WhatsApp phone line." },
        next: ""
      }
    ]
  },
  out_of_hours: {
    flowName: "After-hours Gateway Route",
    nodes: [
      {
        id: "oh_1",
        type: "trigger_on_message",
        title: "Midnight Monitor",
        x: 100,
        y: 150,
        config: { triggerType: "all_messages" },
        next: "oh_2"
      },
      {
        id: "oh_2",
        type: "logic_condition",
        title: "Is After-Hours?",
        x: 400,
        y: 150,
        config: { criteria: "keyword_matches", value: "night,closed,hours" },
        next: "oh_3",
        failNext: "oh_4"
      },
      {
        id: "oh_3",
        type: "action_send_text",
        title: "Send Closed Info Message",
        x: 720,
        y: 60,
        config: { messageText: "We are currently CLOSED. Working hours: Mon-Fri 9AM-6PM GMT. For emergency, see support portal." },
        next: ""
      },
      {
        id: "oh_4",
        type: "action_send_text",
        title: "Send standard auto-reply",
        x: 720,
        y: 260,
        config: { messageText: "Thanks for messaging! Live support is active. Please ask away!" },
        next: ""
      }
    ]
  }
};

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  renderNodes();
  lucide.createIcons();
});

// Render current workspace state nodes and connections
function renderNodes() {
  const canvasNodes = document.getElementById("canvas-nodes");
  canvasNodes.innerHTML = "";
  
  workflowState.nodes.forEach(node => {
    const nodeEl = document.createElement("div");
    nodeEl.className = `absolute bg-slate-900 border ${selectedNodeId === node.id ? 'node-active-highlight border-emerald-500' : 'border-slate-800'} hover:border-slate-600 rounded-2xl w-64 shadow-xl p-4 transition-all duration-150 cursor-pointer select-none`;
    nodeEl.style.left = `${node.x}px`;
    nodeEl.style.top = `${node.y}px`;
    nodeEl.id = `el-${node.id}`;
    nodeEl.onclick = (e) => {
      e.stopPropagation();
      selectNode(node.id);
    };
    
    // Enable drag functionality on visual elements
    nodeEl.setAttribute("draggable", "true");
    nodeEl.ondragstart = (e) => {
      currentDraggingNode = node.id;
      const rect = nodeEl.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
    };

    const typeDetails = getNodeTypeStyling(node.type);
    
    nodeEl.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <span class="p-1.5 rounded ${typeDetails.bg} ${typeDetails.color} flex items-center justify-center">
            <i data-lucide="${typeDetails.icon}" class="w-4 h-4"></i>
          </span>
          <span class="text-xs font-bold uppercase text-slate-400 tracking-wide">${typeDetails.tag}</span>
        </div>
        <span class="text-[10px] text-slate-600 font-mono">${node.id}</span>
      </div>
      <h3 class="text-sm font-semibold text-white mb-1.5">${node.title || 'Untitled Node'}</h3>
      <p class="text-[11px] text-slate-400 truncate">${getBriefPreview(node)}</p>
      
      <!-- Connection Dots -->
      <div class="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-slate-800 border-2 border-slate-900 rounded-full"></div>
      <div class="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-slate-800 border-2 border-emerald-500 rounded-full"></div>
    `;
    
    canvasNodes.appendChild(nodeEl);
  });

  // Refresh lines drawing
  setTimeout(drawConnectionPaths, 50);
  lucide.createIcons();
}

// Helper to identify visual styles by custom OpenWA node type
function getNodeTypeStyling(type) {
  switch (type) {
    case "trigger_on_message":
      return { icon: "message-square", bg: "bg-emerald-500/10", color: "text-emerald-400", tag: "Trigger" };
    case "trigger_webhook_event":
      return { icon: "globe", bg: "bg-cyan-500/10", color: "text-cyan-400", tag: "API Trigger" };
    case "action_send_text":
      return { icon: "send", bg: "bg-blue-500/10", color: "text-blue-400", tag: "Action (Text)" };
    case "action_send_image":
      return { icon: "image", bg: "bg-indigo-500/10", color: "text-indigo-400", tag: "Action (Media)" };
    case "action_send_buttons":
      return { icon: "list-ordered", bg: "bg-purple-500/10", color: "text-purple-400", tag: "Action (Buttons)" };
    case "logic_condition":
      return { icon: "git-branch", bg: "bg-amber-500/10", color: "text-amber-400", tag: "Condition Branch" };
    case "logic_webhook_forward":
      return { icon: "arrow-up-right", bg: "bg-rose-500/10", color: "text-rose-400", tag: "Webhook Post" };
    default:
      return { icon: "box", bg: "bg-slate-500/10", color: "text-slate-400", tag: "Default Node" };
  }
}

// Generate dynamic short summaries of node config fields inside cards
function getBriefPreview(node) {
  if (!node.config) return "No configuration specified";
  switch (node.type) {
    case "trigger_on_message":
      return `Detect: ${node.config.triggerType || "All messages"}`;
    case "trigger_webhook_event":
      return `Payload Key: ${node.config.payloadTriggerKey || "event_key"}`;
    case "action_send_text":
      return node.config.messageText ? `"${node.config.messageText}"` : "Enter WhatsApp response body...";
    case "action_send_image":
      return `Media: ${node.config.imageUrl || "No URL entered"}`;
    case "action_send_buttons":
      return `Options: ${node.config.optionsList || "No options entered"}`;
    case "logic_condition":
      return `Keywords: ${node.config.value || "None"}`;
    case "logic_webhook_forward":
      return `Target: ${node.config.webhookUrl || "None entered"}`;
    default:
      return "Click to modify parameters";
  }
}

// Drag and Drop flow operations
function allowDrop(ev) {
  ev.preventDefault();
}

function drag(ev, nodeType) {
  ev.dataTransfer.setData("text/plain", nodeType);
}

function drop(ev) {
  ev.preventDefault();
  const container = document.getElementById("canvas-container");
  const rect = container.getBoundingClientRect();
  const mouseX = ev.clientX - rect.left + container.scrollLeft;
  const mouseY = ev.clientY - rect.top + container.scrollTop;

  // Check if we are dragging a new element from side-palette or relocating an existing node
  if (currentDraggingNode) {
    const node = workflowState.nodes.find(n => n.id === currentDraggingNode);
    if (node) {
      node.x = Math.max(0, mouseX - dragOffset.x);
      node.y = Math.max(0, mouseY - dragOffset.y);
    }
    currentDraggingNode = null;
  } else {
    const nodeType = ev.dataTransfer.getData("text/plain");
    if (nodeType) {
      createNewNode(nodeType, mouseX - 100, mouseY - 40);
    }
  }
  
  renderNodes();
}

// Dynamically draw modern connecting lines with customizable markers
function drawConnectionPaths() {
  const svg = document.getElementById("canvas-lines");
  // Keep standard SVG line indicators inside limits
  svg.innerHTML = `
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
      </marker>
      <marker id="arrow-orange" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
      </marker>
      <marker id="arrow-rose" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
      </marker>
    </defs>
  `;

  workflowState.nodes.forEach(node => {
    const startEl = document.getElementById(`el-${node.id}`);
    if (!startEl) return;

    const startX = node.x + 256; 
    const startY = node.y + 44;

    // Render Primary Destination Line
    if (node.next) {
      const destNode = workflowState.nodes.find(n => n.id === node.next);
      if (destNode) {
        const endX = destNode.x;
        const endY = destNode.y + 44;
        drawBezierCurve(svg, startX, startY, endX, endY, "#10b981", "arrow");
      }
    }

    // Render Conditional Fallback Branch Path Line
    if (node.type === "logic_condition" && node.failNext) {
      const failDestNode = workflowState.nodes.find(n => n.id === node.failNext);
      if (failDestNode) {
        const endX = failDestNode.x;
        const endY = failDestNode.y + 44;
        drawBezierCurve(svg, startX, startY, endX, endY, "#f43f5e", "arrow-rose");
      }
    }
  });
}

// Mathematical computation for custom curved paths between cards
function drawBezierCurve(svg, sx, sy, ex, ey, strokeColor, markerId) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const dx = Math.abs(ex - sx) * 0.5;
  const cx1 = sx + dx;
  const cy1 = sy;
  const cx2 = ex - dx;
  const cy2 = ey;
  
  const pathString = `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${ex} ${ey}`;
  
  path.setAttribute("d", pathString);
  path.setAttribute("stroke", strokeColor);
  path.setAttribute("stroke-width", "2.5");
  path.setAttribute("fill", "none");
  path.setAttribute("marker-end", `url(#${markerId})`);
  path.setAttribute("class", "transition-all duration-300");
  svg.appendChild(path);
}

// Create a fresh node in the current system state
function createNewNode(type, x, y) {
  const nodeTypeCount = workflowState.nodes.filter(n => n.type === type).length + 1;
  const randId = `node_${Math.floor(Math.random() * 900) + 100}`;
  
  let nodeTemplate = {
    id: randId,
    type: type,
    title: `${type.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} ${nodeTypeCount}`,
    x: x || 150,
    y: y || 150,
    config: {},
    next: ""
  };

  // Default fields for each specific workflow component type
  if (type === "action_send_text") {
    nodeTemplate.config = { messageText: "Thank you for contacting OpenWA Gateway services!" };
  } else if (type === "logic_condition") {
    nodeTemplate.config = { criteria: "keyword_matches", value: "support,help" };
    nodeTemplate.failNext = "";
  } else if (type === "action_send_buttons") {
    nodeTemplate.config = { buttonText: "Which department?", optionsList: "Sales, Support, billing" };
  } else if (type === "logic_webhook_forward") {
    nodeTemplate.config = { webhookUrl: "https://hooks.slack.com/services/...", method: "POST" };
  } else if (type === "action_send_image") {
    nodeTemplate.config = { imageUrl: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c" };
  }

  workflowState.nodes.push(nodeTemplate);
  selectNode(randId);
  renderNodes();
}

function addNodePrompt() {
  createNewNode("action_send_text", 200, 200);
}

// Node selection & sidebar inspector configuration updates
function selectNode(id) {
  selectedNodeId = id;
  renderNodes();

  const node = workflowState.nodes.find(n => n.id === id);
  if (!node) return;

  document.getElementById("inspector-empty-state").classList.add("hidden");
  document.getElementById("inspector-active-panel").classList.remove("hidden");
  
  document.getElementById("inspector-node-id").innerText = node.id;
  document.getElementById("node-edit-title").value = node.title || "";
  
  // Set category tag styling
  const style = getNodeTypeStyling(node.type);
  document.getElementById("inspector-node-type").innerText = style.tag;
  
  const iconContainer = document.getElementById("inspector-icon-container");
  iconContainer.className = `p-1.5 rounded ${style.bg} ${style.color}`;
  iconContainer.innerHTML = `<i data-lucide="${style.icon}" class="w-4 h-4"></i>`;

  // Generate dynamic contextual HTML fields inside Inspector panel based on node types
  const dynamicFieldsDiv = document.getElementById("node-dynamic-fields");
  dynamicFieldsDiv.innerHTML = "";

  if (node.type === "action_send_text") {
    dynamicFieldsDiv.innerHTML = `
      <div>
        <label class="block text-xs text-slate-400 mb-1 font-semibold">WhatsApp Message Body Text</label>
        <textarea id="field-text-body" class="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-100 h-24 outline-none focus:border-emerald-500">${node.config.messageText || ""}</textarea>
        <p class="text-[10px] text-slate-500 mt-1">Supports template brackets like {{sender}} and {{last_body}}.</p>
      </div>
    `;
  } else if (node.type === "logic_condition") {
    dynamicFieldsDiv.innerHTML = `
      <div>
        <label class="block text-xs text-slate-400 mb-1 font-semibold">Match Operation Type</label>
        <select id="field-match-type" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-100 outline-none focus:border-emerald-500">
          <option value="keyword_matches" ${node.config.criteria === 'keyword_matches' ? 'selected' : ''}>Message Matches Key Phrases</option>
          <option value="regex_pattern" ${node.config.criteria === 'regex_pattern' ? 'selected' : ''}>Custom Regex Formula</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-slate-400 mb-1 font-semibold">Keywords (comma separated)</label>
        <input type="text" id="field-keywords" value="${node.config.value || ''}" class="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-100 outline-none focus:border-emerald-500">
        <p class="text-[10px] text-slate-500 mt-1">Example: hello,help,assist,human</p>
      </div>
      <div>
        <label class="block text-xs text-rose-400 mb-1 font-semibold">FAIL Condition Redirect Node ID</label>
        <select id="field-fail-next" class="w-full bg-slate-950 border border-rose-800/80 rounded p-1.5 text-xs text-rose-300 outline-none">
          <option value="">-- Terminate Flow on Fail --</option>
          ${workflowState.nodes.map(n => n.id !== node.id ? `<option value="${n.id}" ${node.failNext === n.id ? 'selected' : ''}>${n.id} - ${n.title}</option>` : '').join('')}
        </select>
      </div>
    `;
  } else if (node.type === "action_send_buttons") {
    dynamicFieldsDiv.innerHTML = `
      <div>
        <label class="block text-xs text-slate-400 mb-1 font-semibold">Main Buttons Prompt Banner</label>
        <input type="text" id="field-button-text" value="${node.config.buttonText || ''}" class="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-100 outline-none">
      </div>
      <div>
        <label class="block text-xs text-slate-400 mb-1 font-semibold">Quick Reply Buttons (comma list)</label>
        <input type="text" id="field-button-options" value="${node.config.optionsList || ''}" class="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-100 outline-none">
        <p class="text-[10px] text-slate-500 mt-1">List up to three choices maximum.</p>
      </div>
    `;
  } else if (node.type === "logic_webhook_forward") {
    dynamicFieldsDiv.innerHTML = `
      <div>
        <label class="block text-xs text-slate-400 mb-1 font-semibold">External Endpoint URL</label>
        <input type="text" id="field-webhook-url" value="${node.config.webhookUrl || ''}" class="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-100 outline-none">
      </div>
      <div>
        <label class="block text-xs text-slate-400 mb-1 font-semibold">HTTP Verb Method</label>
        <select id="field-webhook-verb" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-100 outline-none">
          <option value="POST" ${node.config.method === 'POST' ? 'selected' : ''}>POST (application/json)</option>
          <option value="GET" ${node.config.method === 'GET' ? 'selected' : ''}>GET (query parameters)</option>
        </select>
      </div>
    `;
  } else if (node.type === "action_send_image") {
    dynamicFieldsDiv.innerHTML = `
      <div>
        <label class="block text-xs text-slate-400 mb-1 font-semibold">Image Attachment Hosted Link</label>
        <input type="text" id="field-image-url" value="${node.config.imageUrl || ''}" class="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-100 outline-none">
      </div>
    `;
  }

  // Populate Next Node selector menu options list dynamically
  const nextSelect = document.getElementById("node-edit-next");
  nextSelect.innerHTML = `<option value="">-- End of Workflow Chain --</option>`;
  
  workflowState.nodes.forEach(n => {
    if (n.id !== node.id) {
      const selectedAttr = node.next === n.id ? "selected" : "";
      nextSelect.innerHTML += `<option value="${n.id}" ${selectedAttr}>${n.id} - ${n.title}</option>`;
    }
  });

  lucide.createIcons();
}

// Write changed UI inspector values back into memory state
function saveNodeInspector() {
  if (!selectedNodeId) return;
  const node = workflowState.nodes.find(n => n.id === selectedNodeId);
  if (!node) return;

  node.title = document.getElementById("node-edit-title").value;
  node.next = document.getElementById("node-edit-next").value;

  // Pull correct fields based on category
  if (node.type === "action_send_text") {
    node.config.messageText = document.getElementById("field-text-body").value;
  } else if (node.type === "logic_condition") {
    node.config.criteria = document.getElementById("field-match-type").value;
    node.config.value = document.getElementById("field-keywords").value;
    node.failNext = document.getElementById("field-fail-next").value;
  } else if (node.type === "action_send_buttons") {
    node.config.buttonText = document.getElementById("field-button-text").value;
    node.config.optionsList = document.getElementById("field-button-options").value;
  } else if (node.type === "logic_webhook_forward") {
    node.config.webhookUrl = document.getElementById("field-webhook-url").value;
    node.config.method = document.getElementById("field-webhook-verb").value;
  } else if (node.type === "action_send_image") {
    node.config.imageUrl = document.getElementById("field-image-url").value;
  }

  renderNodes();
  addLogEntry("SYSTEM", `Applied settings changes to ${node.id} (${node.title}) successfully.`);
}

// Remove selected node safely
function deleteSelectedNode() {
  if (!selectedNodeId) return;
  
  // Clean dangling connections references
  workflowState.nodes.forEach(n => {
    if (n.next === selectedNodeId) n.next = "";
    if (n.failNext === selectedNodeId) n.failNext = "";
  });

  workflowState.nodes = workflowState.nodes.filter(n => n.id !== selectedNodeId);
  
  addLogEntry("SYSTEM", `Deleted node: ${selectedNodeId}`);
  selectedNodeId = null;
  
  document.getElementById("inspector-empty-state").classList.remove("hidden");
  document.getElementById("inspector-active-panel").classList.add("hidden");
  
  renderNodes();
}

// Clear entire screen layout
function clearCanvas() {
  workflowState.nodes = [];
  selectedNodeId = null;
  document.getElementById("inspector-empty-state").classList.remove("hidden");
  document.getElementById("inspector-active-panel").classList.add("hidden");
  renderNodes();
  addLogEntry("SYSTEM", "Workflow workspace completely cleared.");
}

// Simulator Logic Event Execution Simulator Engine!
function triggerSimulation() {
  const logsBox = document.getElementById("simulator-logs-box");
  const sender = document.getElementById("sim-sender").value || "+14155552671";
  const bodyText = document.getElementById("sim-body").value || "";
  
  logsBox.innerHTML = ""; 
  addLogEntry("INCOMING", `From: ${sender} | Body: "${bodyText}"`);

  // Locate start trigger node
  let currentNode = workflowState.nodes.find(n => n.type === "trigger_on_message");
  if (!currentNode) {
    addLogEntry("ERROR", "Missing 'On Incoming Message' starting trigger node! Webhook has nowhere to begin.");
    return;
  }

  executeSimulationStep(currentNode, bodyText, sender);
}

function executeSimulationStep(node, body, sender) {
  if (!node) {
    addLogEntry("SYSTEM", "Workflow execution terminated safely with no subsequent actions queued.");
    return;
  }

  // visually pulse active simulator node path temporarily
  const element = document.getElementById(`el-${node.id}`);
  if (element) {
    element.classList.add("border-cyan-400");
    element.style.transform = "scale(1.04)";
    setTimeout(() => {
      element.classList.remove("border-cyan-400");
      element.style.transform = "scale(1)";
    }, 900);
  }

  let nextToExecute = node.next;

  switch (node.type) {
    case "trigger_on_message":
      addLogEntry("ROUTER", `Match Trigger: "${node.title}" -> routing event.`);
      break;

    case "action_send_text":
      addLogEntry("OPENWA API", `POST /api/sendMessage: Text => "${node.config.messageText || ''}" to ${sender}`);
      break;

    case "action_send_buttons":
      addLogEntry("OPENWA API", `POST /api/sendButtons: Prompt: "${node.config.buttonText || ''}" | [${node.config.optionsList || ''}]`);
      break;

    case "action_send_image":
      addLogEntry("OPENWA API", `POST /api/sendFile: Url => "${node.config.imageUrl || ''}"`);
      break;

    case "logic_webhook_forward":
      addLogEntry("WEBHOOK OUT", `Triggering Outward HTTP ${node.config.method || 'POST'} -> ${node.config.webhookUrl || 'no-endpoint-configured'}`);
      break;

    case "logic_condition":
      const cleanBody = body.toLowerCase().trim();
      const keywords = (node.config.value || "").split(",").map(k => k.trim().toLowerCase());
      const isMatch = keywords.some(kw => cleanBody.includes(kw));
      
      if (isMatch) {
        addLogEntry("LOGIC", `Success! Core condition evaluated true for keyword match against list: [${node.config.value}]`);
        nextToExecute = node.next;
      } else {
        addLogEntry("LOGIC", `Condition evaluation failed! No match found for input value. Branching downstream -> Fail redirect.`);
        nextToExecute = node.failNext;
      }
      break;
  }

  // Execute subsequent chains with tiny delay mimicking server runtime processing
  if (nextToExecute) {
    const nextNode = workflowState.nodes.find(n => n.id === nextToExecute);
    setTimeout(() => {
      executeSimulationStep(nextNode, body, sender);
    }, 600);
  } else {
    setTimeout(() => {
      addLogEntry("DONE", "All routing completed successfully with response 200 OK.");
    }, 600);
  }
}

function addLogEntry(tag, text) {
  const logsBox = document.getElementById("simulator-logs-box");
  let tagColor = "text-slate-400";
  
  if (tag === "INCOMING") tagColor = "text-cyan-400 font-bold";
  else if (tag === "OPENWA API") tagColor = "text-emerald-400 font-semibold";
  else if (tag === "LOGIC") tagColor = "text-amber-400";
  else if (tag === "WEBHOOK OUT") tagColor = "text-rose-400";
  else if (tag === "DONE") tagColor = "text-emerald-500 font-bold bg-emerald-500/10 px-1 py-0.5 rounded";
  else if (tag === "ERROR") tagColor = "text-red-500 font-bold";

  const entry = document.createElement("div");
  entry.className = "border-b border-slate-900/60 pb-1.5";
  entry.innerHTML = `<span class="${tagColor}">[${tag}]</span> <span class="text-slate-300">${text}</span>`;
  logsBox.appendChild(entry);
  logsBox.scrollTop = logsBox.scrollHeight;
}

function clearSimulationLogs() {
  document.getElementById("simulator-logs-box").innerHTML = `
    <div class="text-slate-500 italic">Simulator logs cleared.</div>
  `;
}

// Tab switching functionality in sidebars
function switchSidebarTab(tabName) {
  const paletteBtn = document.getElementById("tab-palette");
  const templatesBtn = document.getElementById("tab-templates");
  
  const paletteContent = document.getElementById("sidebar-content-palette");
  const templatesContent = document.getElementById("sidebar-content-templates");

  if (tabName === "palette") {
    paletteBtn.className = "w-1/2 py-3 font-semibold border-b-2 border-emerald-500 text-emerald-400 bg-slate-900/40";
    templatesBtn.className = "w-1/2 py-3 font-semibold border-b-2 border-transparent text-slate-400 hover:text-slate-200";
    
    paletteContent.classList.remove("hidden");
    templatesContent.classList.add("hidden");
  } else {
    templatesBtn.className = "w-1/2 py-3 font-semibold border-b-2 border-emerald-500 text-emerald-400 bg-slate-900/40";
    paletteBtn.className = "w-1/2 py-3 font-semibold border-b-2 border-transparent text-slate-400 hover:text-slate-200";
    
    templatesContent.classList.remove("hidden");
    paletteContent.classList.add("hidden");
  }
}

// Load a complete preset workflow templates on user tap
function loadTemplate(templateId) {
  if (confirm("Are you sure you want to replace current canvas with this template layout?")) {
    const chosen = TEMPLATES[templateId];
    if (chosen) {
      workflowState.flowName = chosen.flowName;
      workflowState.nodes = JSON.parse(JSON.stringify(chosen.nodes)); // deep copy
      document.getElementById("flow-name-input").value = chosen.flowName;
      
      selectedNodeId = null;
      document.getElementById("inspector-empty-state").classList.remove("hidden");
      document.getElementById("inspector-active-panel").classList.add("hidden");

      renderNodes();
      addLogEntry("SYSTEM", `Template loaded successfully: "${chosen.flowName}"`);
    }
  }
}

// Open export JSON window
function exportWorkflow() {
  const modal = document.getElementById("export-modal");
  const textarea = document.getElementById("export-json-textarea");
  
  // Sync core input updates
  workflowState.flowName = document.getElementById("flow-name-input").value;
  workflowState.gatewayUrl = document.getElementById("gateway-url-input").value;
  
  textarea.value = JSON.stringify(workflowState, null, 2);
  modal.classList.remove("hidden");
}

function importWorkflowTrigger() {
  document.getElementById("import-file-input").click();
}

function importWorkflow(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed && Array.isArray(parsed.nodes)) {
        workflowState = parsed;
        document.getElementById("flow-name-input").value = parsed.flowName || "Imported OpenWA Workflow";
        document.getElementById("gateway-url-input").value = parsed.gatewayUrl || "http://localhost:8080";
        
        selectedNodeId = null;
        document.getElementById("inspector-empty-state").classList.remove("hidden");
        document.getElementById("inspector-active-panel").classList.add("hidden");
        
        renderNodes();
        addLogEntry("SYSTEM", "Workflow definition successfully loaded from file structure.");
      } else {
        alert("Invalid configuration: File must contain a node checklist schema array.");
      }
    } catch(err) {
      alert("Error parsing raw file. Confirm valid JSON notation standards.");
    }
  };
  reader.readAsText(file);
}

function closeModal() {
  document.getElementById("export-modal").classList.add("hidden");
}

function copyExportedJSON() {
  const textarea = document.getElementById("export-json-textarea");
  textarea.select();
  document.execCommand("copy");
  alert("JSON Configuration copied to workspace clipboard successfully!");
}