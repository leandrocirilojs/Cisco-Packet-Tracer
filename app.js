// ══════════════════════════════════════════
//  ESTADO GLOBAL
// ══════════════════════════════════════════
let nodes = [];
let links = [];
let selected = null;
let mode = 'select'; // select | connect | delete | note
let connectSource = null;
let viewX = 0, viewY = 0, viewScale = 1;
let isDraggingNode = false;
let isDraggingCanvas = false;
let dragNodeId = null;
let dragOffX = 0, dragOffY = 0;
let panStartX = 0, panStartY = 0;
let nodeCounter = { router:0, router3layer:0, switch:0, switch3layer:0, pc:0, laptop:0, server:0, printer:0, ap:0, smartphone:0, cloud:0, internet:0, modem:0, firewall:0, camera:0, sensor:0 };
let undoStack = [], redoStack = [];
let simMode = false;
let cliHistory = [], cliHistIdx = -1;
let ctxTarget = null;
let currentCliTab = 'terminal';
let dragDeviceType = null;

const svg = document.getElementById('network-canvas');

const DEVICE_META = {
  router:       { label:'Roteador',  icon:'🔷', color:'#00a0d1', shape:'diamond', interfaces:['Fa0/0','Fa0/1','Se0/0','Se0/1'] },
  router3layer: { label:'Roteador L3',icon:'🔹',color:'#0080b0', shape:'diamond', interfaces:['Gi0/0','Gi0/1','Gi0/2','Gi0/3'] },
  switch:       { label:'Switch',    icon:'🔲', color:'#00c896', shape:'rect',    interfaces:['Fa0/1','Fa0/2','Fa0/3','Fa0/4','Fa0/5','Fa0/6','Fa0/7','Fa0/8'] },
  switch3layer: { label:'Switch L3', icon:'◼',  color:'#009070', shape:'rect',    interfaces:['Gi0/1','Gi0/2','Gi0/3','Gi0/4','Gi0/5','Gi0/6'] },
  pc:           { label:'PC',        icon:'🖥️', color:'#9aa0aa', shape:'rect',    interfaces:['Fa0'] },
  laptop:       { label:'Notebook',  icon:'💻', color:'#9aa0aa', shape:'rect',    interfaces:['Wireless0','Fa0'] },
  server:       { label:'Servidor',  icon:'🖨️', color:'#c090d0', shape:'rect',    interfaces:['Fa0','Fa1'] },
  printer:      { label:'Impressora',icon:'🖨',  color:'#a0a0a0', shape:'rect',    interfaces:['Fa0'] },
  ap:           { label:'Access Pt', icon:'📡', color:'#f0a500', shape:'circle',  interfaces:['Fa0','Wireless0','Wireless1'] },
  smartphone:   { label:'Smartphone',icon:'📱', color:'#e06080', shape:'circle',  interfaces:['Wireless0'] },
  cloud:        { label:'Cloud',     icon:'☁️', color:'#5080b0', shape:'cloud',   interfaces:['Se0','Se1','Fa0','Fa1'] },
  internet:     { label:'Internet',  icon:'🌐', color:'#4070a0', shape:'cloud',   interfaces:['Fa0','Fa1','Se0'] },
  modem:        { label:'Modem',     icon:'📟', color:'#80a080', shape:'rect',    interfaces:['DSL0','Fa0'] },
  firewall:     { label:'Firewall',  icon:'🛡️', color:'#e05050', shape:'rect',    interfaces:['Fa0/0 (WAN)','Fa0/1 (LAN)','Fa0/2 (DMZ)'] },
  camera:       { label:'Câmera IP', icon:'📷', color:'#708090', shape:'circle',  interfaces:['Fa0'] },
  sensor:       { label:'Sensor',    icon:'🌡️', color:'#80b080', shape:'circle',  interfaces:['Wireless0'] },
};

function isSwitchNode(n) {
  return n && (n.type === 'switch' || n.type === 'switch3layer');
}

function ensureNodeDefaults(n) {
  if (!n || n.type === 'note') return;
  if (!n.cli) n.cli = { mode: 'user', iface: null };
  if (!['user', 'privileged', 'config', 'interface'].includes(n.cli.mode)) n.cli.mode = 'user';
  if (isSwitchNode(n)) {
    if (!n.vlans || typeof n.vlans !== 'object') n.vlans = { 1: { name: 'default' } };
    if (!n.vlans[1]) n.vlans[1] = { name: 'default' };
  }
  (n.interfaces || []).forEach(iface => {
    if (iface.adminDown === undefined) iface.adminDown = false;
    if (isSwitchNode(n)) {
      if (!iface.switchportMode) iface.switchportMode = 'access';
      if (iface.accessVlan === undefined || iface.accessVlan === null) iface.accessVlan = 1;
    }
  });
}

function ifaceNameOnNode(link, nodeId) {
  if (!link || !nodeId) return null;
  if (link.src === nodeId) return link.srcIface || null;
  if (link.dst === nodeId) return link.dstIface || null;
  return null;
}

function getLinkBetween(nodeIdA, nodeIdB) {
  return links.find(l => l.active && ((l.src === nodeIdA && l.dst === nodeIdB) || (l.dst === nodeIdA && l.src === nodeIdB)));
}

function refreshIfaceLinkStatuses() {
  nodes.forEach(n => {
    if (!n.interfaces || n.type === 'note') return;
    const used = new Set();
    links.filter(l => l.active).forEach(l => {
      if (l.src === n.id && l.srcIface) used.add(l.srcIface);
      if (l.dst === n.id && l.dstIface) used.add(l.dstIface);
    });
    n.interfaces.forEach(iface => {
      iface.status = used.has(iface.name) ? 'up' : 'down';
    });
  });
}

function ifaceForwarding(iface) {
  return iface && iface.status === 'up' && !iface.adminDown;
}

function linkOperational(lk) {
  if (!lk.active) return false;
  const a = getNode(lk.src), b = getNode(lk.dst);
  if (!a || !b) return false;
  const ia = a.interfaces?.find(i => i.name === lk.srcIface);
  const ib = b.interfaces?.find(i => i.name === lk.dstIface);
  if (!ia || !ib) return true;
  return ifaceForwarding(ia) && ifaceForwarding(ib);
}

function isIfaceFree(nodeId, ifaceName) {
  return !links.some(l => l.active && ((l.src === nodeId && l.srcIface === ifaceName) || (l.dst === nodeId && l.dstIface === ifaceName)));
}

function pickInterfacesForLink(a, b) {
  ensureNodeDefaults(a); ensureNodeDefaults(b);
  const ia = a.interfaces?.find(i => isIfaceFree(a.id, i.name));
  const ib = b.interfaces?.find(i => isIfaceFree(b.id, i.name));
  if (!ia || !ib) return null;
  return { srcIface: ia.name, dstIface: ib.name };
}

function getCableChoices(srcId, dstId) {
  const hint = getLinkType(srcId, dstId);
  if (hint === 'wireless') {
    return {
      hint: 'Par envolvendo Wi‑Fi — apenas link wireless.',
      options: [{ value: 'wireless', label: 'Wireless (802.11)' }]
    };
  }
  if (hint === 'serial') {
    return {
      hint: 'Equipamentos WAN — serial é o típico; também pode usar cobre/fibra como genérico.',
      options: [
        { value: 'serial', label: 'Serial (DCE/DTE)' },
        { value: 'ethernet', label: 'Ethernet cobre (straight-through)' },
        { value: 'crossover', label: 'Ethernet crossover' },
        { value: 'fiber', label: 'Fibra óptica' }
      ]
    };
  }
  return {
    hint: 'LAN típica — straight-through ou crossover; fibra opcional.',
    options: [
      { value: 'ethernet', label: 'Cobre straight-through' },
      { value: 'crossover', label: 'Cobre crossover' },
      { value: 'fiber', label: 'Fibra óptica' }
    ]
  };
}

function cableOkForDevices(srcId, dstId, cable) {
  const auto = getLinkType(srcId, dstId);
  if (auto === 'wireless') return cable === 'wireless';
  return cable !== 'wireless';
}

let pendingLinkPair = null;

function populateLinkCableSelect(srcId, dstId) {
  const sel = document.getElementById('link-cable-type');
  const hintEl = document.getElementById('link-cable-hint');
  const { hint, options } = getCableChoices(srcId, dstId);
  hintEl.textContent = hint;
  sel.innerHTML = options.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  sel.value = options[0].value;
}

function fillLinkIfaceSelect(selectEl, nodeId) {
  const n = getNode(nodeId);
  if (!n?.interfaces) {
    selectEl.innerHTML = '';
    return;
  }
  ensureNodeDefaults(n);
  const opts = n.interfaces.filter(iface => isIfaceFree(nodeId, iface.name));
  selectEl.innerHTML = opts.map(iface => `<option value="${iface.name}">${iface.name}</option>`).join('');
}

function openLinkChooserModal(srcNode, dstNode) {
  pendingLinkPair = { srcId: srcNode.id, dstId: dstNode.id };
  connectSource = null;
  document.getElementById('link-peer-summary').textContent = `${srcNode.name} ↔ ${dstNode.name}`;
  populateLinkCableSelect(srcNode.id, dstNode.id);
  fillLinkIfaceSelect(document.getElementById('link-src-iface'), srcNode.id);
  fillLinkIfaceSelect(document.getElementById('link-dst-iface'), dstNode.id);
  const picked = pickInterfacesForLink(srcNode, dstNode);
  const si = document.getElementById('link-src-iface');
  const di = document.getElementById('link-dst-iface');
  if (picked && [...si.options].some(o => o.value === picked.srcIface)) si.value = picked.srcIface;
  if (picked && [...di.options].some(o => o.value === picked.dstIface)) di.value = picked.dstIface;
  document.getElementById('link-modal').classList.add('open');
  render();
}

function confirmLinkModal() {
  if (!pendingLinkPair) return;
  const cable = document.getElementById('link-cable-type').value;
  const srcIface = document.getElementById('link-src-iface').value;
  const dstIface = document.getElementById('link-dst-iface').value;
  if (!srcIface || !dstIface) {
    cliLog('err', 'Escolha uma porta livre em cada equipamento.');
    return;
  }
  if (!cableOkForDevices(pendingLinkPair.srcId, pendingLinkPair.dstId, cable)) {
    cliLog('err', 'Tipo de cabo incompatível com este par de dispositivos.');
    return;
  }
  addLink(pendingLinkPair.srcId, pendingLinkPair.dstId, {
    srcIface,
    dstIface,
    cableType: cable
  });
  pendingLinkPair = null;
  connectSource = null;
  closeModal('link-modal');
  setMode('select');
}

function cancelLinkModal() {
  pendingLinkPair = null;
  connectSource = null;
  closeModal('link-modal');
  setMode('select');
}

function migrateLegacyLinks() {
  links.forEach(l => {
    const a = getNode(l.src), b = getNode(l.dst);
    if (!a || !b) return;
    if (!l.srcIface && a.interfaces?.[0]) l.srcIface = a.interfaces[0].name;
    if (!l.dstIface && b.interfaces?.[0]) l.dstIface = b.interfaces[0].name;
  });
}

function hydrateProject() {
  nodes.forEach(ensureNodeDefaults);
  migrateLegacyLinks();
  refreshIfaceLinkStatuses();
}

function vlanAtSwitchPort(sw, peerId, link) {
  const iface = sw.interfaces?.find(i => i.name === ifaceNameOnNode(link, sw.id));
  if (!iface || iface.switchportMode === 'trunk') return null;
  return iface.accessVlan ?? 1;
}

function pathVlanOk(path) {
  for (let i = 1; i < path.length - 1; i++) {
    const cur = path[i];
    if (!isSwitchNode(cur)) continue;
    const prev = path[i - 1], next = path[i + 1];
    const lkPrev = getLinkBetween(prev.id, cur.id);
    const lkNext = getLinkBetween(cur.id, next.id);
    if (!lkPrev || !lkNext) return false;
    const vIn = vlanAtSwitchPort(cur, prev.id, lkPrev);
    const vOut = vlanAtSwitchPort(cur, next.id, lkNext);
    if (vIn === null || vOut === null) continue;
    if (vIn !== vOut) return false;
  }
  return true;
}

function cliPromptString(n) {
  if (!n) return 'NetSim#';
  ensureNodeDefaults(n);
  const st = n.cli;
  const base = n.name;
  if (st.mode === 'user') return base + '>';
  if (st.mode === 'privileged') return base + '#';
  if (st.mode === 'config') return base + '(config)#';
  if (st.mode === 'interface') return base + '(config-if)#';
  return base + '>';
}

function findIfaceByPartial(n, token) {
  if (!token || !n.interfaces) return null;
  const t = token.toLowerCase().replace(/\s+/g, '');
  let hit = n.interfaces.find(i => i.name.toLowerCase().replace(/\s+/g, '') === t);
  if (hit) return hit;
  return n.interfaces.find(i => i.name.toLowerCase().includes(t)) || null;
}

function getCurrentIfaceContext(n) {
  ensureNodeDefaults(n);
  if (n.cli.mode !== 'interface' || !n.cli.iface) return null;
  return n.interfaces?.find(i => i.name === n.cli.iface) || null;
}

let simPduQueue = [];

// ══════════════════════════════════════════
//  INICIALIZAÇÃO
// ══════════════════════════════════════════
window.onload = () => {
  hydrateProject();
  render();
  updateStatusBar();
  cliLog('info','NetSim Pro v1.1 — Simulador de Redes');
  cliLog('info','Digite <b>help</b> ou <b>show netsim-parity</b> (limitações vs Packet Tracer).');
  cliLog('','');
  document.addEventListener('keydown', globalKeyDown);
  document.addEventListener('click', ()=>{ document.getElementById('ctx-menu').style.display='none'; });
  showHelp();
};

// ══════════════════════════════════════════
//  RENDER SVG
// ══════════════════════════════════════════
function render() {
  const W = svg.clientWidth || svg.parentElement.clientWidth;
  const H = svg.clientHeight || svg.parentElement.clientHeight;
  svg.setAttribute('viewBox', `${-viewX/viewScale} ${-viewY/viewScale} ${W/viewScale} ${H/viewScale}`);

  let html = '';

  // Links
  links.forEach(lk => {
    const a = getNode(lk.src), b = getNode(lk.dst);
    if (!a || !b) return;
    const lw = lk.type === 'fiber' ? 2.8 : lk.type === 'serial' ? 1.5 : 2;
    const dash = lk.type === 'serial' ? '6,3' : lk.type === 'wireless' ? '4,4' : lk.type === 'crossover' ? '4,3' : '';
    let col = '#4a5260';
    if (lk.active) {
      if (lk.type === 'crossover') col = '#f0a500';
      else if (lk.type === 'fiber') col = '#40d0ff';
      else if (lk.type === 'serial') col = '#c090d0';
      else col = '#00c896';
    }
    html += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${col}" stroke-width="${lw}" stroke-dasharray="${dash}" opacity="0.8" data-link="${lk.id}"/>`;
    // midpoint label
    const mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
    const lkLbl = lk.label || (lk.srcIface && lk.dstIface ? `${lk.srcIface} ↔ ${lk.dstIface}` : '');
    if (lkLbl) html += `<text x="${mx}" y="${my-6}" text-anchor="middle" fill="#5a6070" font-size="9" font-family="IBM Plex Mono">${lkLbl}</text>`;
  });

  // Connection line preview
  if (connectSource) {
    html += `<line id="connect-preview" x1="${connectSource.x}" y1="${connectSource.y}" x2="${connectSource.x}" y2="${connectSource.y}" stroke="#00c896" stroke-width="2" stroke-dasharray="6,3" opacity="0.6"/>`;
  }

  // Nodes
  nodes.forEach(n => {
    const m = DEVICE_META[n.type];
    const sel = selected === n.id ? 'node-selected' : '';
    html += renderNode(n, m, sel);
  });

  svg.innerHTML = html;

  // Attach node events
  nodes.forEach(n => {
    const g = svg.querySelector(`[data-node="${n.id}"]`);
    if (!g) return;
    g.addEventListener('mousedown', e => nodeMouseDown(e, n.id));
    g.addEventListener('contextmenu', e => showCtxMenu(e, n.id));
    g.addEventListener('click', e => nodeClick(e, n.id));
    g.addEventListener('mouseenter', e => showTooltip(e, n));
    g.addEventListener('mouseleave', hideTooltip);
  });

  // Link click
  svg.querySelectorAll('line[data-link]').forEach(l => {
    l.addEventListener('click', e => linkClick(e, l.dataset.link));
    l.style.cursor = mode === 'delete' ? 'pointer' : 'default';
  });

  document.getElementById('sb-devices').textContent = nodes.filter(nd=>nd.type!=='note').length;
  document.getElementById('sb-links').textContent = links.length;
  document.getElementById('zoom-display').textContent = Math.round(viewScale*100)+'%';
  refreshIfaceLinkStatuses();
}

function renderNode(n, m, selClass) {
  const pw = 52, ph = 52;
  const ip = n.ip || '';
  let shape = '';
  if (m.shape === 'diamond') {
    shape = `<polygon points="${n.x},${n.y-pw/2} ${n.x+pw/2},${n.y} ${n.x},${n.y+ph/2} ${n.x-pw/2},${n.y}" fill="${m.color}22" stroke="${m.color}" stroke-width="2"/>`;
  } else if (m.shape === 'circle') {
    shape = `<circle cx="${n.x}" cy="${n.y}" r="${pw/2}" fill="${m.color}22" stroke="${m.color}" stroke-width="2"/>`;
  } else if (m.shape === 'cloud') {
    shape = `<ellipse cx="${n.x}" cy="${n.y}" rx="${pw/2+4}" ry="${ph/2}" fill="${m.color}22" stroke="${m.color}" stroke-width="2"/>`;
  } else {
    shape = `<rect x="${n.x-pw/2}" y="${n.y-ph/2}" width="${pw}" height="${ph}" rx="5" fill="${m.color}22" stroke="${m.color}" stroke-width="2"/>`;
  }
  const hasIpConflict = n.ip && nodes.filter(nd => nd.ip === n.ip && nd.id !== n.id && nd.type !== 'note').length > 0;
  const dotColor = hasIpConflict ? '#f5d020' : (n.active !== false ? '#00c896' : '#e05050');
  const conflictBorder = hasIpConflict ? `<rect x="${n.x-pw/2-3}" y="${n.y-ph/2-3}" width="${pw+6}" height="${ph+6}" rx="7" fill="none" stroke="#f5d020" stroke-width="2" stroke-dasharray="4,3" opacity="0.7"/>` : '';
  const statusDot = `<circle cx="${n.x+20}" cy="${n.y-20}" r="5" fill="${dotColor}"/>`;
  const icon = `<text x="${n.x}" y="${n.y+6}" text-anchor="middle" dominant-baseline="middle" font-size="20">${m.icon}</text>`;
  const label = `<text x="${n.x}" y="${n.y+ph/2+14}" text-anchor="middle" class="node-label" font-size="12">${n.name}</text>`;
  const ipColor = hasIpConflict ? '#f5d020' : '#9aa0aa';
  const sublabel = ip ? `<text x="${n.x}" y="${n.y+ph/2+26}" text-anchor="middle" class="node-sublabel" fill="${ipColor}">${ip}${hasIpConflict?' ⚠':''}</text>` : '';
  const cursorStyle = mode==='connect'?'crosshair':mode==='delete'?'pointer':'move';
  return `<g data-node="${n.id}" class="${selClass}" style="cursor:${cursorStyle}">${conflictBorder}${shape}${icon}${statusDot}${label}${sublabel}</g>`;
}

// ══════════════════════════════════════════
//  NODES
// ══════════════════════════════════════════
function addNode(type, x, y) {
  const m = DEVICE_META[type];
  nodeCounter[type] = (nodeCounter[type]||0) + 1;
  const prefix = type.replace('3layer','').replace('router','R').replace('switch','SW').replace('pc','PC').replace('laptop','NB').replace('server','SRV').replace('printer','PRT').replace('ap','AP').replace('smartphone','PHONE').replace('cloud','CLOUD').replace('internet','NET').replace('modem','MODEM').replace('firewall','FW').replace('camera','CAM').replace('sensor','SENS');
  const id = 'n' + Date.now() + Math.random().toString(36).substr(2,4);
  const n = {
    id, type, x, y,
    name: prefix + nodeCounter[type],
    ip: autoIP(type, nodeCounter[type]),
    mask: '255.255.255.0',
    gateway: '',
    active: true,
    interfaces: m.interfaces.map((iface,i) => ({ name: iface, ip: '', mask: '255.255.255.0', status: 'down' })),
    routing: [],
    arp: []
  };
  pushUndo();
  nodes.push(n);
  ensureNodeDefaults(n);
  render();
  updateStatusBar();
  select(id);
  return id;
}

function autoIP(type, n) {
  if (['cloud','internet','modem'].includes(type)) return '';
  const base = { router:'10.0', router3layer:'10.1', switch:'', switch3layer:'', pc:'192.168.1', laptop:'192.168.1', server:'192.168.2', printer:'192.168.3', ap:'192.168.0', smartphone:'192.168.1', firewall:'172.16.0', camera:'192.168.10', sensor:'192.168.20' };
  const b = base[type];
  if (!b) return '';
  return `${b}.${n}`;
}

function getNode(id) { return nodes.find(n => n.id === id); }

function select(id) {
  selected = id;
  const n = getNode(id);
  if (n) {
    ensureNodeDefaults(n);
    document.getElementById('sb-selected').style.display = 'flex';
    document.getElementById('sb-sel-name').textContent = n.name;
    updateCliPrompt(n);
    showProperties(n);
  }
  render();
}

function deselect() {
  selected = null;
  document.getElementById('sb-selected').style.display = 'none';
  document.getElementById('rp-props').innerHTML = '<div class="empty-state">Selecione um dispositivo<br>para ver suas propriedades</div>';
  updateCliPrompt(null);
  render();
}

// ══════════════════════════════════════════
//  LINKS
// ══════════════════════════════════════════
function addLink(srcId, dstId, opts = {}) {
  if (srcId === dstId) return;
  if (links.find(l => (l.src===srcId&&l.dst===dstId)||(l.src===dstId&&l.dst===srcId))) {
    cliLog('warn', 'Conexão já existe entre esses dispositivos.');
    return;
  }
  const a = getNode(srcId), b = getNode(dstId);
  if (!a || !b) return;
  ensureNodeDefaults(a); ensureNodeDefaults(b);

  let srcIface = opts.srcIface;
  let dstIface = opts.dstIface;
  let cableType = opts.cableType || getLinkType(srcId, dstId);

  if (!cableOkForDevices(srcId, dstId, cableType)) {
    cliLog('err', 'Tipo de cabo inválido para este par.');
    return;
  }

  if (!srcIface || !dstIface) {
    const picked = pickInterfacesForLink(a, b);
    if (!picked) {
      cliLog('err', 'Sem porta física livre em um dos dispositivos.');
      return;
    }
    srcIface = picked.srcIface;
    dstIface = picked.dstIface;
  } else {
    if (!isIfaceFree(srcId, srcIface) || !isIfaceFree(dstId, dstIface)) {
      cliLog('err', 'Uma das portas escolhidas já está em uso.');
      return;
    }
  }

  pushUndo();
  const id = 'l' + Date.now();
  links.push({
    id, src: srcId, dst: dstId,
    srcIface, dstIface,
    type: cableType,
    active: true,
    label: ''
  });
  const cableLabel = ({ ethernet:'Ethernet', crossover:'Crossover', fiber:'Fibra', serial:'Serial', wireless:'Wireless' })[cableType] || cableType;
  cliLog('ok', `${cableLabel}: ${a.name} (${srcIface}) ↔ ${b.name} (${dstIface})`);
  render();
  updateStatusBar();
  if (selected) showProperties(getNode(selected));
}

function getLinkType(src, dst) {
  const a = getNode(src), b = getNode(dst);
  const wireless = ['ap','smartphone'];
  if (wireless.includes(a?.type) || wireless.includes(b?.type)) return 'wireless';
  const serial = ['router','router3layer','modem','cloud','internet'];
  if (serial.includes(a?.type) && serial.includes(b?.type)) return 'serial';
  return 'ethernet';
}

function linkClick(e, id) {
  e.stopPropagation();
  if (mode === 'delete') {
    pushUndo();
    links = links.filter(l => l.id !== id);
    cliLog('warn','Conexão removida.');
    render();
    updateStatusBar();
  }
}

// ══════════════════════════════════════════
//  MOUSE EVENTS
// ══════════════════════════════════════════
function nodeMouseDown(e, id) {
  if (e.button !== 0) return;
  e.stopPropagation();
  if (mode === 'connect') return;
  if (mode === 'delete') return;
  isDraggingNode = true;
  dragNodeId = id;
  const n = getNode(id);
  const pt = svgPoint(e);
  dragOffX = pt.x - n.x;
  dragOffY = pt.y - n.y;
  select(id);
}

function nodeClick(e, id) {
  e.stopPropagation();
  if (mode === 'delete') {
    pushUndo();
    links = links.filter(l => l.src !== id && l.dst !== id);
    nodes = nodes.filter(n => n.id !== id);
    if (selected === id) deselect();
    cliLog('warn', `Dispositivo ${getNode(id)?.name||id} excluído.`);
    render();
    updateStatusBar();
    return;
  }
  if (mode === 'connect') {
    if (!connectSource) {
      connectSource = getNode(id);
      cliLog('info', `Conectar: ${connectSource.name} → clique no destino`);
      render();
    } else {
      openLinkChooserModal(connectSource, getNode(id));
    }
    return;
  }
  select(id);
}

function canvasMouseDown(e) {
  if (e.button === 1 || (e.button === 0 && !isDraggingNode)) {
    if (e.target === svg || e.target.tagName === 'svg' || e.target.classList.contains('canvas-grid')) {
      isDraggingCanvas = true;
      panStartX = e.clientX - viewX;
      panStartY = e.clientY - viewY;
      svg.style.cursor = 'grabbing';
    }
  }
}

function canvasMouseMove(e) {
  // Update coords
  const pt = svgPoint(e);
  document.getElementById('sb-coords').textContent = `x:${Math.round(pt.x)} y:${Math.round(pt.y)}`;

  if (isDraggingNode && dragNodeId) {
    const pt = svgPoint(e);
    const n = getNode(dragNodeId);
    if (n) {
      n.x = pt.x - dragOffX;
      n.y = pt.y - dragOffY;
      render();
    }
    return;
  }
  if (isDraggingCanvas) {
    viewX = e.clientX - panStartX;
    viewY = e.clientY - panStartY;
    render();
    return;
  }
  // Connect preview line
  if (connectSource) {
    const preview = svg.querySelector('#connect-preview');
    if (preview) {
      const pt = svgPoint(e);
      preview.setAttribute('x2', pt.x);
      preview.setAttribute('y2', pt.y);
    }
  }
}

function canvasMouseUp(e) {
  isDraggingNode = false;
  isDraggingCanvas = false;
  dragNodeId = null;
  svg.style.cursor = 'default';
  if (e.target === svg || e.target.tagName === 'svg' || e.target.classList.contains('canvas-grid')) {
    if (mode === 'connect' && connectSource) {
      connectSource = null;
      render();
    } else if (mode === 'note') {
      const pt = svgPoint(e);
      addNoteAt(pt.x, pt.y);
    } else {
      deselect();
    }
  }
}

function svgPoint(e) {
  const rect = svg.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) / viewScale - viewX/viewScale,
    y: (e.clientY - rect.top) / viewScale - viewY/viewScale
  };
}

function onWheel(e) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  viewScale = Math.min(3, Math.max(0.2, viewScale * delta));
  render();
}

// ══════════════════════════════════════════
//  DRAG & DROP FROM SIDEBAR
// ══════════════════════════════════════════
function startDrag(e, type) {
  dragDeviceType = type;
  e.dataTransfer.setData('text', type);
}

function onDrop(e) {
  e.preventDefault();
  const type = e.dataTransfer.getData('text') || dragDeviceType;
  if (!type || !DEVICE_META[type]) return;
  const rect = svg.getBoundingClientRect();
  const x = (e.clientX - rect.left) / viewScale - viewX/viewScale;
  const y = (e.clientY - rect.top) / viewScale - viewY/viewScale;
  addNode(type, x, y);
  dragDeviceType = null;
}

function addDeviceCenter(type) {
  const W = svg.clientWidth || 800;
  const H = svg.clientHeight || 500;
  const x = W/2/viewScale - viewX/viewScale + (Math.random()-0.5)*80;
  const y = H/2/viewScale - viewY/viewScale + (Math.random()-0.5)*80;
  addNode(type, x, y);
}

// ══════════════════════════════════════════
//  MODES
// ══════════════════════════════════════════
function setMode(m) {
  mode = m;
  connectSource = null;
  ['select','connect','delete','note'].forEach(x => {
    document.getElementById('btn-'+x)?.classList.remove('active');
  });
  document.getElementById('btn-'+m)?.classList.add('active');
  const badge = document.getElementById('mode-badge');
  const labels = { select:'SELECIONAR', connect:'CONECTAR', delete:'EXCLUIR', note:'NOTA' };
  badge.textContent = labels[m] || m.toUpperCase();
  badge.className = 'mode-badge ' + m;
  if (m === 'connect') cliLog('info','Modo Conectar: clique no dispositivo de origem.');
  render();
}

function addNote() { setMode('note'); }

function addNoteAt(x, y) {
  const text = prompt('Texto da nota:');
  if (!text) { setMode('select'); return; }
  pushUndo();
  nodes.push({ id:'note'+Date.now(), type:'note', x, y, name: text, active: true });
  setMode('select');
  render();
}

// ══════════════════════════════════════════
//  PROPERTIES PANEL
// ══════════════════════════════════════════
function showProperties(n) {
  if (!n || n.type === 'note') return;
  const m = DEVICE_META[n.type];
  let html = `
    ${n.ipConflict ? `<div style="background:rgba(245,208,32,.12);border:1px solid rgba(245,208,32,.4);border-radius:4px;padding:7px 10px;margin-bottom:10px;font-size:11px;color:#f5d020;line-height:1.6">⚠ <b>CONFLITO DE ENDEREÇO IP</b><br>Este dispositivo está com o IP duplicado na rede. Comunicação indisponível.</div>` : ''}
    <div class="rp-section-title">Identificação</div>
    <div class="prop-row"><div class="prop-label">Nome:</div><input class="prop-input" value="${n.name}" onchange="updateProp('${n.id}','name',this.value)"></div>
    <div class="prop-row"><div class="prop-label">Tipo:</div><div class="prop-value">${m?.label||n.type}</div></div>
    <div class="prop-row"><div class="prop-label">Status:</div><div class="prop-value ${n.active?'status-up':'status-down'}">${n.active?'🟢 Ativo':'🔴 Inativo'}</div></div>
  `;
  if (m && !['cloud','internet','switch','switch3layer'].includes(n.type)) {
    html += `
      <div class="rp-section-title">TCP/IP</div>
      <div class="prop-row"><div class="prop-label">IP:</div><input class="prop-input" value="${n.ip||''}" placeholder="ex: 192.168.1.1" onchange="updateProp('${n.id}','ip',this.value)"></div>
      <div class="prop-row"><div class="prop-label">Máscara:</div><input class="prop-input" value="${n.mask||'255.255.255.0'}" onchange="updateProp('${n.id}','mask',this.value)"></div>
      <div class="prop-row"><div class="prop-label">Gateway:</div><input class="prop-input" value="${n.gateway||''}" placeholder="ex: 192.168.1.254" onchange="updateProp('${n.id}','gateway',this.value)"></div>
    `;
  }
  html += `<div class="rp-section-title">Interfaces (${n.interfaces?.length||0})</div>`;
  (n.interfaces||[]).forEach((iface,i) => {
    const swExtra = isSwitchNode(n)
      ? `<div class="iface-ip">modo ${iface.switchportMode||'access'}${iface.switchportMode==='access'?`, VLAN ${iface.accessVlan??1}`:' — trunk (stub)'}</div>`
      : '';
    const adm = iface.adminDown ? '<span class="status-down">🔒 Admin down</span>' : '';
    html += `
      <div class="iface-row">
        <div class="iface-name">${iface.name}${iface.description?` — ${iface.description}`:''}</div>
        ${swExtra}
        <div><input class="prop-input" style="width:100%;margin-top:4px" value="${iface.ip||''}" placeholder="IP da interface" onchange="updateIface('${n.id}',${i},'ip',this.value)"></div>
        <div class="iface-status ${iface.status==='up'?'status-up':'status-down'}">${iface.status==='up'?'🟢 Up':'🔴 Down'} ${adm}</div>
      </div>
    `;
  });
  // Connected links
  const myLinks = links.filter(l => l.src===n.id||l.dst===n.id);
  if (myLinks.length) {
    html += `<div class="rp-section-title">Conexões (${myLinks.length})</div>`;
    myLinks.forEach(lk => {
      const peer = getNode(lk.src===n.id?lk.dst:lk.src);
      const myIF = lk.src===n.id ? lk.srcIface : lk.dstIface;
      const ct = ({ ethernet:'Ethernet', crossover:'Crossover', fiber:'Fibra', serial:'Serial', wireless:'Wireless' })[lk.type] || lk.type;
      html += `<div class="iface-row"><div class="iface-name">${peer?.name||'?'}</div><div class="iface-ip">via ${myIF||'?'} · ${ct} — ${lk.active?'<span class="status-up">🟢 Ativo</span>':'<span class="status-down">🔴 Inativo</span>'}</div></div>`;
    });
  }
  document.getElementById('rp-props').innerHTML = html;

  // Routing table
  let rt = `<div class="rp-section-title">Tabela de Roteamento</div>`;
  if (n.routing?.length) {
    n.routing.forEach(r => {
      rt += `<div class="iface-row"><div class="iface-name">${r.network}/${r.prefix}</div><div class="iface-ip">via ${r.nexthop} [${r.metric}]</div></div>`;
    });
  } else {
    rt += `<div class="empty-state" style="padding:10px">Sem rotas configuradas.<br>Use: <code style="color:var(--accent)">ip route [rede] [máscara] [nexthop]</code></div>`;
  }
  document.getElementById('rp-routing').innerHTML = rt;

  // ARP table
  let arp = `<div class="rp-section-title">Tabela ARP</div>`;
  if (n.arp?.length) {
    n.arp.forEach(a => {
      arp += `<div class="iface-row"><div class="iface-name">${a.ip}</div><div class="iface-ip">${a.mac}</div></div>`;
    });
  } else {
    arp += `<div class="empty-state" style="padding:10px">Tabela ARP vazia.<br>Execute um ping para popular.</div>`;
  }
  document.getElementById('rp-arp').innerHTML = arp;
}

function updateProp(id, key, val) {
  const n = getNode(id);
  if (!n) return;
  const oldVal = n[key];
  n[key] = val;
  if (key === 'ip' && val) {
    const conflict = nodes.find(nd => nd.ip === val && nd.id !== id && nd.type !== 'note');
    if (conflict) {
      cliLog('warn', `⚠ CONFLITO DE ENDEREÇO IP DETECTADO!`);
      cliLog('warn', `  Host ${n.name}: IP address ${val} is conflicting with ${conflict.name}`);
      cliLog('warn', `  Ambos os dispositivos ficarão inacessíveis na rede.`);
      n.ipConflict = true;
      conflict.ipConflict = true;
    } else {
      // resolve any previous conflict this node had
      if (oldVal) {
        const wasConflict = nodes.find(nd => nd.ip === oldVal && nd.id !== id && nd.type !== 'note');
        if (wasConflict) {
          wasConflict.ipConflict = false;
          cliLog('ok', `  Conflito resolvido para ${wasConflict.name}.`);
        }
      }
      n.ipConflict = false;
    }
  }
  render();
}

function updateIface(nodeId, idx, key, val) {
  const n = getNode(nodeId);
  if (n && n.interfaces[idx]) { n.interfaces[idx][key] = val; }
}

// ══════════════════════════════════════════
//  CLI
// ══════════════════════════════════════════
function cliLog(type, msg) {
  const out = document.getElementById('cli-output');
  if (currentCliTab !== 'terminal' && currentCliTab !== 'events') return;
  const classes = { ok:'cli-ok', err:'cli-err', info:'cli-info', warn:'cli-warn', '':'cli-cmd' };
  const div = document.createElement('div');
  div.className = 'cli-line ' + (classes[type]||'');
  div.innerHTML = msg;
  out.appendChild(div);
  out.scrollTop = out.scrollHeight;
}

function updateCliPrompt(n) {
  document.getElementById('cli-prompt-label').textContent = cliPromptString(n);
}

function cliKeyDown(e) {
  const input = document.getElementById('cli-input');
  if (e.key === 'Enter') {
    const cmd = input.value.trim();
    if (!cmd) return;
    cliHistory.unshift(cmd);
    cliHistIdx = -1;
    input.value = '';
    const n = selected ? getNode(selected) : null;
    const prompt = cliPromptString(n);
    cliLog('', `<span class="cli-prompt">${prompt}</span> <span class="cli-cmd">${cmd}</span>`);
    processCommand(cmd, n);
  } else if (e.key === 'ArrowUp') {
    cliHistIdx = Math.min(cliHistIdx+1, cliHistory.length-1);
    input.value = cliHistory[cliHistIdx] || '';
  } else if (e.key === 'ArrowDown') {
    cliHistIdx = Math.max(cliHistIdx-1, -1);
    input.value = cliHistIdx >= 0 ? cliHistory[cliHistIdx] : '';
  } else if (e.key === 'Tab') {
    e.preventDefault();
    autocomplete(input);
  }
}

const CLI_COMMANDS = ['help','ping','traceroute','show ip','show arp','show version','show interfaces','show vlan brief','show mac address-table','show spanning-tree','show netsim-parity','show running-config','enable','disable','configure terminal','interface','vlan','hostname','ip address','ip route','no ip route','shutdown','no shutdown','switchport mode access','switchport mode trunk','switchport access vlan','description','clear','exit','end','write memory','copy running-config startup-config','do '];

function autocomplete(input) {
  const val = input.value.toLowerCase();
  const match = CLI_COMMANDS.find(c => c.startsWith(val) && c !== val);
  if (match) input.value = match;
}

function showPtRoadmap() {
  cliLog('info','══ NetSim vs Cisco Packet Tracer ══');
  cliLog('warn','Este projeto não pode reproduzir “todas” as funções do Packet Tracer — o PT é um simulador proprietário completo.');
  cliLog('','<b>Já há neste NetSim (parcial)</b>: topologia; links por porta física; IOS-lite (<b>enable</b>, <b>conf t</b>, <b>interface</b>); VLAN access em switches; verificação de VLAN no caminho do ping/traceroute; <b>shutdown</b> por interface.');
  cliLog('','<b>Não disponível aqui</b> (exemplos): PDU modo simulação camada-a-camada; MAC learning / STP / EtherChannel; OSPF/EIGRP/BGP; WLAN avançado; DHCP/DNS/HTTP servidor como no PT; NAT/stateful firewall; modo físico e cabos; multiusuário.');
  cliLog('info','Para estudos formais use o <b>Cisco Packet Tracer</b> oficial junto com este protótipo.');
}

function applyIpToNode(n, newIp, mask, opts = {}) {
  const oldIp = n.ip;
  n.ip = newIp;
  if (mask) n.mask = mask;
  const conflict = nodes.find(nd => nd.ip === newIp && nd.id !== n.id && nd.type !== 'note');
  if (conflict) {
    cliLog('warn', `%IP-4-DUPADDR: Duplicate address ${newIp} on ${n.name}, sourced by ${conflict.name}`);
    n.ipConflict = true;
    conflict.ipConflict = true;
  } else {
    if (oldIp) {
      const wasConflict = nodes.find(nd => nd.ip === oldIp && nd.id !== n.id && nd.type !== 'note');
      if (wasConflict) { wasConflict.ipConflict = false; cliLog('ok', `  Conflito resolvido para ${wasConflict.name}.`); }
    }
    n.ipConflict = false;
    if (!opts.silent) cliLog('ok', 'IP configurado: ' + n.ip + ' ' + (n.mask || mask || ''));
  }
  render(); showProperties(n);
}

function processCommand(cmd, n, execOverride = false) {
  const raw = cmd.trim();
  const lc = raw.toLowerCase();

  if (lc === 'help' || lc === '?') {
    cliLog('info','Fluxo estilo IOS: <b>enable</b> → privilegiado → <b>configure terminal</b> → <b>interface …</b>');
    cliLog('','No modo config use <b>do show …</b> para comandos EXEC (ex.: <b>do show ip interface brief</b>).');
    cliLog('','');
    cliLog('info','Comandos principais:');
    cliLog('','  <b>ping / traceroute</b> — ICMP (EXEC)');
    cliLog('','  <b>show ip | arp | interfaces | vlan brief | running-config</b>');
    cliLog('','  <b>show netsim-parity</b> — Limitações vs Packet Tracer');
    cliLog('','  Switch: <b>vlan ID</b>, <b>switchport access vlan</b>, <b>switchport mode trunk</b>');
    cliLog('','  <b>hostname</b>, <b>ip route</b>, <b>shutdown</b> em interface ou dispositivo (privilegiado)');
    cliLog('','  <b>clear</b>, <b>write memory</b>');
    return;
  }
  if (lc === 'clear') { document.getElementById('cli-output').innerHTML = ''; return; }
  if (lc === 'show version') {
    cliLog('ok','NetSim Pro v1.1 — emulação IOS simplificada');
    cliLog('','Sistema operacional: NetSim IOS 15.1(1)T');
    cliLog('','Uptime: '+Math.floor(Math.random()*48+1)+'h '+Math.floor(Math.random()*60)+'m');
    return;
  }
  if (lc === 'show netsim-parity' || lc === 'show packet-tracer-parity') {
    showPtRoadmap();
    return;
  }

  if (!n) { cliLog('err','⚠ Nenhum dispositivo selecionado. Selecione um dispositivo no canvas.'); return; }

  ensureNodeDefaults(n);
  const st = n.cli;

  if (!execOverride && (st.mode === 'config' || st.mode === 'interface') && lc.startsWith('do ')) {
    processCommand(raw.slice(3).trim(), n, true);
    return;
  }

  const execModes = st.mode === 'user' || st.mode === 'privileged';
  const inCfg = st.mode === 'config' || st.mode === 'interface';
  const canShow = (execModes || execOverride) && (!inCfg || execOverride);

  const pingTracerouteOk = () => {
    if (!execOverride && inCfg) {
      cliLog('err','Saia do modo config ou use <b>do ping</b> / <b>do traceroute</b>.');
      return false;
    }
    if (!execOverride && !execModes) {
      cliLog('err','Modo EXEC necessário.');
      return false;
    }
    return true;
  };

  if (lc.startsWith('ping ')) {
    if (!pingTracerouteOk()) return;
    runPing(n, raw.split(/\s+/)[1]);
    return;
  }
  if (lc.startsWith('traceroute ')) {
    if (!pingTracerouteOk()) return;
    runTraceroute(n, raw.split(/\s+/)[1]);
    return;
  }

  if (lc === 'enable') {
    if (st.mode !== 'user') {
      cliLog('warn','Já está em modo privilegiado.');
      return;
    }
    const tok = raw.split(/\s+/)[1];
    if (tok !== undefined && tok !== '' && tok !== 'cisco') {
      cliLog('err',' % Bad secrets');
      return;
    }
    st.mode = 'privileged';
    updateCliPrompt(n);
    cliLog('ok','Modo privilegiado.');
    return;
  }

  if (lc === 'disable') {
    if (st.mode === 'user') return;
    st.mode = 'user';
    st.iface = null;
    updateCliPrompt(n);
    return;
  }

  if (lc === 'configure terminal' || lc === 'conf t') {
    if (st.mode !== 'privileged') {
      cliLog('err','Precisa estar em modo privilegiado (<b>enable</b>).');
      return;
    }
    st.mode = 'config';
    st.iface = null;
    updateCliPrompt(n);
    cliLog('ok','Enter configuration commands, one per line. End with CNTL/Z.');
    return;
  }

  const ifMatch = raw.match(/^interface\s+(.+)$/i);
  if (ifMatch && st.mode === 'config') {
    const hit = findIfaceByPartial(n, ifMatch[1].trim());
    if (!hit) {
      cliLog('err','Interface inválida neste equipamento.');
      return;
    }
    st.mode = 'interface';
    st.iface = hit.name;
    updateCliPrompt(n);
    return;
  }

  const vlanOnly = raw.match(/^vlan\s+(\d+)\s*$/i);
  if (vlanOnly && st.mode === 'config' && isSwitchNode(n)) {
    const vid = parseInt(vlanOnly[1], 10);
    if (vid < 1 || vid > 4094) {
      cliLog('err','ID VLAN inválido (1–4094).');
      return;
    }
    if (!n.vlans) n.vlans = {};
    if (!n.vlans[vid]) n.vlans[vid] = { name: 'VLAN' + String(vid).padStart(4, '0') };
    cliLog('ok', `VLAN ${vid} configurada.`);
    return;
  }

  if ((lc === 'switchport mode access' || lc === 'switchport mode trunk') && st.mode === 'interface' && isSwitchNode(n)) {
    const iface = getCurrentIfaceContext(n);
    if (!iface) return;
    iface.switchportMode = lc.includes('trunk') ? 'trunk' : 'access';
    cliLog('ok', `switchport mode ${iface.switchportMode}`);
    render(); showProperties(n);
    return;
  }

  const sav = raw.match(/^switchport\s+access\s+vlan\s+(\d+)/i);
  if (sav && st.mode === 'interface' && isSwitchNode(n)) {
    const iface = getCurrentIfaceContext(n);
    if (!iface) return;
    const vid = parseInt(sav[1], 10);
    iface.accessVlan = vid;
    iface.switchportMode = 'access';
    if (!n.vlans) n.vlans = {};
    if (!n.vlans[vid]) n.vlans[vid] = { name: 'VLAN' + String(vid).padStart(4, '0') };
    cliLog('ok', `${iface.name}: access VLAN ${vid}`);
    render(); showProperties(n);
    return;
  }

  const descm = raw.match(/^description\s+(.+)$/i);
  if (descm && st.mode === 'interface') {
    const iface = getCurrentIfaceContext(n);
    if (!iface) return;
    iface.description = descm[1].trim();
    cliLog('ok','Descrição aplicada.');
    return;
  }

  if (lc === 'exit' || lc === 'leave') {
    if (st.mode === 'interface') {
      st.mode = 'config'; st.iface = null;
      updateCliPrompt(n); return;
    }
    if (st.mode === 'config') {
      st.mode = 'privileged'; st.iface = null;
      updateCliPrompt(n); return;
    }
    if (st.mode === 'privileged') {
      st.mode = 'user';
      updateCliPrompt(n); return;
    }
    cliLog('warn','Já está em modo EXEC usuário.');
    return;
  }

  if (lc === 'end') {
    if (st.mode === 'interface' || st.mode === 'config') {
      st.mode = 'privileged'; st.iface = null;
      updateCliPrompt(n);
      cliLog('ok', n.name + '#');
      return;
    }
    return;
  }

  if (lc === 'show ip interface brief' && canShow) {
    cliLog('ok','Interface              IP-Address      OK? Method Status');
    (n.interfaces || []).forEach(iface => {
      const adm = iface.adminDown ? 'administratively down' : 'up';
      const line = `${iface.name.padEnd(22)} ${(iface.ip || n.ip || '').padEnd(15)} YES manual ${adm}`;
      cliLog('ok', line);
    });
    return;
  }

  if (lc === 'show vlan brief' && canShow && isSwitchNode(n)) {
    cliLog('ok','VLAN Name                             Status    Ports');
    const byVlan = {};
    (n.interfaces || []).forEach(iface => {
      if (iface.switchportMode === 'trunk') return;
      const v = iface.accessVlan ?? 1;
      if (!byVlan[v]) byVlan[v] = [];
      byVlan[v].push(iface.name);
    });
    Object.keys(n.vlans || {}).concat(Object.keys(byVlan)).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => +a - +b).forEach(vid => {
      const vn = (n.vlans && n.vlans[vid] && n.vlans[vid].name) || `VLAN${vid}`;
      const ports = (byVlan[vid] || []).join(', ') || '—';
      cliLog('ok', `${String(vid).padEnd(4)} ${vn.padEnd(36)} active    ${ports}`);
    });
    return;
  }

  if (lc === 'show mac address-table' && canShow && isSwitchNode(n)) {
    cliLog('warn','Stub: aprendizado MAC / bridging não são simulados (use Packet Tracer para CAM real).');
    return;
  }

  if ((lc === 'show spanning-tree' || lc === 'show span') && canShow) {
    cliLog('warn','STP não implementado neste NetSim.');
    return;
  }

  if (lc === 'show ip' && canShow) {
    cliLog('ok', `Dispositivo: ${n.name}`);
    cliLog('','IP Address:  ' + (n.ip || '(não configurado)'));
    cliLog('','Subnet Mask: ' + (n.mask || '255.255.255.0'));
    cliLog('','Gateway:     ' + (n.gateway || '(não configurado)'));
    return;
  }

  if (lc === 'show arp' && canShow) {
    if (!n.arp?.length) { cliLog('warn','Tabela ARP vazia.'); return; }
    cliLog('','Protocol  Address          Age   Hardware Addr     Type');
    n.arp.forEach(a => cliLog('ok',`Internet  ${a.ip.padEnd(17)} ${String(a.age||'-').padEnd(6)}${a.mac}  ARPA`));
    return;
  }
  if (lc === 'show interfaces' && canShow) {
    (n.interfaces||[]).forEach(iface => {
      const lineProto = ifaceForwarding(iface) ? 'up' : 'down';
      cliLog('ok',`${iface.name} is ${iface.status==='up'?'up':'down'}, line protocol is ${lineProto}`);
      cliLog('','  Internet address is '+(iface.ip||n.ip||'unassigned'));
      if (isSwitchNode(n)) {
        cliLog('','  Switchport '+iface.switchportMode+(iface.switchportMode==='access'?`, VLAN ${iface.accessVlan}`:' (todas as VLANs em trunk stub)'));
      }
    });
    return;
  }
  if (lc === 'show running-config' && canShow) {
    cliLog('ok','Building configuration...');
    cliLog('','hostname '+n.name);
    if (isSwitchNode(n)) {
      Object.keys(n.vlans||{}).sort((a,b)=>+a-+b).forEach(vid => {
        cliLog('','vlan '+vid);
        const vn = n.vlans[vid]?.name;
        if (vn) cliLog('',' name '+vn);
      });
      (n.interfaces||[]).forEach(iface => {
        cliLog('','interface '+iface.name);
        if (iface.description) cliLog('',' description '+iface.description);
        cliLog('',' switchport mode '+iface.switchportMode);
        if (iface.switchportMode==='access') cliLog('',' switchport access vlan '+iface.accessVlan);
        if (iface.adminDown) cliLog('',' shutdown'); else cliLog('',' no shutdown');
      });
    }
    if (n.ip && !isSwitchNode(n)) cliLog('','ip address '+n.ip+' '+(n.mask||'255.255.255.0'));
    if (n.gateway) cliLog('','ip default-gateway '+n.gateway);
    (n.routing||[]).forEach(r => cliLog('','ip route '+r.network+' '+r.mask+' '+r.nexthop));
    cliLog('','end');
    return;
  }

  if (lc.startsWith('hostname ') && st.mode === 'config') {
    const newName = raw.split(' ').slice(1).join(' ').trim();
    if (newName) { n.name = newName; render(); showProperties(n); updateCliPrompt(n); cliLog('ok','Hostname alterado para: '+newName); }
    return;
  }

  if (lc.startsWith('ip address ') && st.mode === 'interface') {
    const parts = raw.trim().split(/\s+/);
    if (parts.length >= 4) {
      const iface = getCurrentIfaceContext(n);
      if (!iface) { cliLog('err','Entre em uma interface válida primeiro.'); return; }
      const newIp = parts[2], mask = parts[3];
      iface.ip = newIp;
      iface.mask = mask;
      const hostLike = ['pc','laptop','server','printer','camera','sensor','smartphone','firewall'].includes(n.type);
      if (hostLike) applyIpToNode(n, newIp, mask);
      else {
        cliLog('ok', `${iface.name}: ${newIp} ${mask}`);
        render(); showProperties(n);
      }
    } else cliLog('err','Uso: ip address [ip] [máscara]');
    return;
  }

  if (lc.startsWith('ip address ') && st.mode === 'config' && !isSwitchNode(n)) {
    const parts = raw.trim().split(/\s+/);
    if (parts.length >= 4) applyIpToNode(n, parts[2], parts[3]);
    else cliLog('err','Uso: ip address [ip] [máscara]');
    return;
  }

  if (lc.startsWith('ip route ') && st.mode === 'config') {
    const parts = raw.trim().split(/\s+/);
    if (parts.length >= 5) {
      if (!n.routing) n.routing = [];
      n.routing.push({ network: parts[2], mask: parts[3], nexthop: parts[4], metric: parts[5]||'1', prefix: maskToPrefix(parts[3]) });
      showProperties(n);
      cliLog('ok',`Rota adicionada: ${parts[2]}/${maskToPrefix(parts[3])} via ${parts[4]}`);
    } else cliLog('err','Uso: ip route [rede] [máscara] [nexthop] [métrica]');
    return;
  }

  if (lc.startsWith('no ip route ') && st.mode === 'config') {
    const parts = raw.trim().split(/\s+/);
    if (parts.length >= 6) {
      const net = parts[3], mask = parts[4], nexthop = parts[5];
      n.routing = (n.routing||[]).filter(r => !(r.network===net && r.mask===mask && r.nexthop===nexthop));
      showProperties(n); cliLog('ok','Rota removida.');
    } else cliLog('err','Uso: no ip route [rede] [máscara] [nexthop]');
    return;
  }

  if (lc === 'shutdown' && st.mode === 'interface') {
    const iface = getCurrentIfaceContext(n);
    if (!iface) return;
    iface.adminDown = true;
    refreshIfaceLinkStatuses(); render(); showProperties(n);
    cliLog('warn','Interface em shutdown administrativo.');
    return;
  }
  if (lc === 'no shutdown' && st.mode === 'interface') {
    const iface = getCurrentIfaceContext(n);
    if (!iface) return;
    iface.adminDown = false;
    refreshIfaceLinkStatuses(); render(); showProperties(n);
    cliLog('ok','Interface habilitada.');
    return;
  }

  if (lc === 'shutdown' && st.mode === 'privileged') {
    n.active = false; render(); showProperties(n);
    cliLog('warn','Dispositivo desativado (shutdown global).');
    return;
  }
  if (lc === 'no shutdown' && st.mode === 'privileged') {
    n.active = true; render(); showProperties(n);
    cliLog('ok','Dispositivo ativado.');
    return;
  }

  if ((lc === 'write memory' || lc === 'copy running-config startup-config') && (st.mode === 'privileged' || execOverride)) {
    cliLog('ok','Building configuration... [OK]');
    cliLog('ok','Configuration saved.');
    return;
  }

  cliLog('err',`% Comando não reconhecido: "${cmd}". Digite <b>help</b> ou <b>show netsim-parity</b>.`);
}

function maskToPrefix(mask) {
  const parts = mask.split('.').map(Number);
  let bits = 0;
  parts.forEach(p => { while (p) { bits += p&1; p>>=1; } });
  return bits;
}

// ══════════════════════════════════════════
//  PING / TRACEROUTE
// ══════════════════════════════════════════
function runPing(n, dst) {
  if (!dst) { cliLog('err','Uso: ping [ip]'); return; }
  // Check if source has conflict
  if (n.ipConflict) {
    cliLog('warn',`%IP-4-DUPADDR: ${n.name} possui conflito de IP (${n.ip}). Ping indisponível.`);
    return;
  }
  const targets = nodes.filter(nd => nd.ip === dst && nd.active && nd.id !== n.id);
  if (targets.length > 1) {
    cliLog('warn',`%IP-4-DUPADDR: Conflito de endereço IP detectado para ${dst}.`);
    cliLog('warn',`  Destino inacessível — múltiplos hosts com o mesmo IP.`);
    cliLog('','');
    cliLog('info',`Estatísticas: 4 pacotes enviados, 0 recebidos, 100% perdidos`);
    return;
  }
  const target = targets[0];
  if (target?.ipConflict) {
    cliLog('warn',`%IP-4-DUPADDR: Destino ${dst} possui conflito de IP. Inacessível.`);
    cliLog('','');
    cliLog('info',`Estatísticas: 4 pacotes enviados, 0 recebidos, 100% perdidos`);
    return;
  }
  cliLog('info',`Pingando ${dst} a partir de ${n.name}...`);
  const reachable = target && isReachable(n, target);
  if (simMode && target && reachable) {
    simPduQueue.push({ kind:'ICMP Echo', src:n.name, dst:target.name, dstIp:dst });
    cliLog('info','[SIM] PDU ICMP enfileirado — menu Simulação → Próximo Passo.');
  }
  for (let i=1;i<=4;i++) {
    setTimeout(()=>{
      if (reachable) {
        const ms = Math.floor(Math.random()*20+1);
        cliLog('ok',`Resposta de ${dst}: bytes=32 tempo=${ms}ms TTL=128`);
        if (target) {
          animatePingEnvelope(n, target, { subtitle: 'Echo Request' });
          setTimeout(() => animatePingEnvelope(target, n, { subtitle: 'Echo Reply', replyStyle: true }), 500);
        }
      } else {
        cliLog('err',`Tempo limite esgotado: ${dst} inacessível`);
      }
      if (i===4) {
        cliLog('','');
        cliLog('info',`Estatísticas: 4 pacotes enviados, ${reachable?4:0} recebidos, ${reachable?0:100}% perdidos`);
      }
    }, 200 * i);
  }
}

function runTraceroute(n, dst) {
  if (!dst) { cliLog('err','Uso: traceroute [ip]'); return; }
  const target = nodes.find(nd => nd.ip === dst && nd.active !== false);
  if (!target) {
    setTimeout(()=>cliLog('err','* * * Destino inacessível'),300);
    return;
  }
  const hops = findPath(n, target);
  if (!hops.length || !pathVlanOk(hops)) {
    setTimeout(()=>cliLog('err','* * * Destino inacessível (topologia/VLAN)'),300);
    return;
  }
  cliLog('info',`Traceroute para ${dst}:`);
  hops.forEach((hop,i) => {
    setTimeout(()=>{
      const ms = Math.floor(Math.random()*20+1);
      cliLog('ok',` ${String(i+1).padStart(2)}  ${(hop.ip||hop.name).padEnd(18)} ${ms} ms`);
    }, 300*(i+1));
  });
}

function isReachable(src, dst) {
  const path = findPath(src, dst);
  return path.length > 0 && pathVlanOk(path);
}

function findPath(src, dst) {
  const visited = new Set();
  const queue = [[src]];
  while (queue.length) {
    const path = queue.shift();
    const cur = path[path.length-1];
    if (cur.id === dst.id) return path;
    if (visited.has(cur.id)) continue;
    visited.add(cur.id);
    const neighbors = links.filter(l => (l.src===cur.id||l.dst===cur.id) && linkOperational(l));
    neighbors.forEach(lk => {
      const nId = lk.src===cur.id?lk.dst:lk.src;
      const nb = getNode(nId);
      if (nb && nb.active !== false && !visited.has(nId)) queue.push([...path, nb]);
    });
  }
  return [];
}

function animatePingEnvelope(fromNode, toNode, opts = {}) {
  const subtitle = opts.subtitle || 'Echo Request';
  const replyStyle = !!opts.replyStyle;
  let pathNodes = findPath(fromNode, toNode);
  if (!pathNodes.length || !pathVlanOk(pathNodes)) pathNodes = [fromNode, toNode];

  const pts = pathNodes.map(n => ({ x: n.x, y: n.y }));
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    const len = Math.max(Math.hypot(dx, dy), 1);
    segs.push({ from: pts[i], to: pts[i + 1], len });
    total += len;
  }

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', 'ping-envelope-float');

  const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  fo.setAttribute('width', '76');
  fo.setAttribute('height', '44');
  fo.setAttribute('x', '-38');
  fo.setAttribute('y', '-22');

  const wrap = document.createElement('div');
  wrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  const borderCol = replyStyle ? '#00a0d1' : '#00c896';
  wrap.style.cssText =
    `box-sizing:border-box;width:76px;height:44px;background:#111315;border:2px solid ${borderCol};` +
    'border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'font-family:IBM Plex Sans,sans-serif;font-size:10px;color:#e8eaed;line-height:1.15;' +
    'box-shadow:0 4px 12px rgba(0,0,0,.45);pointer-events:none;';
  wrap.innerHTML =
    `<span style="font-weight:600;color:${borderCol}">ICMP</span>` +
    `<span style="font-size:9px;color:#9aa0aa;margin-top:2px">${subtitle}</span>` +
    `<span style="font-size:8px;color:#5a6070;margin-top:1px">ping</span>`;

  fo.appendChild(wrap);
  g.appendChild(fo);

  svg.appendChild(g);

  let elapsed = 0;
  const duration = Math.min(1400, 380 + total * 2.2);

  function sample(distAlong) {
    let d = distAlong;
    let cx = pts[0].x;
    let cy = pts[0].y;
    for (const seg of segs) {
      if (d <= seg.len) {
        const r = seg.len ? d / seg.len : 0;
        cx = seg.from.x + (seg.to.x - seg.from.x) * r;
        cy = seg.from.y + (seg.to.y - seg.from.y) * r;
        break;
      }
      d -= seg.len;
      cx = seg.to.x;
      cy = seg.to.y;
    }
    return { cx, cy };
  }

  const iv = setInterval(() => {
    elapsed += 28;
    const t = Math.min(1, elapsed / duration);
    const dist = t * total;
    const { cx, cy } = sample(dist);
    g.setAttribute('transform', `translate(${cx},${cy})`);
    if (t >= 1) {
      clearInterval(iv);
      setTimeout(() => g.remove(), 120);
    }
  }, 28);
}

function animatePacket(src, dst) {
  animatePingEnvelope(src, dst, { subtitle: 'Echo Request' });
}

// ══════════════════════════════════════════
//  PING MODAL
// ══════════════════════════════════════════
function openPingModal() {
  const sel = document.getElementById('ping-src');
  sel.innerHTML = nodes.filter(n=>n.type!=='note').map(n=>`<option value="${n.id}">${n.name} (${n.ip||'sem IP'})</option>`).join('');
  document.getElementById('ping-modal').classList.add('open');
}

function executePing() {
  const srcId = document.getElementById('ping-src').value;
  const dst = document.getElementById('ping-dst').value.trim();
  const cmd = document.getElementById('ping-cmd').value;
  const out = document.getElementById('ping-output');
  const src = getNode(srcId);
  if (!src || !dst) { out.innerHTML = '<span style="color:var(--accent-red)">Preencha origem e destino.</span>'; return; }

  // IP conflict checks
  if (src.ipConflict) {
    out.innerHTML = `<span style="color:var(--accent-yellow)">%IP-4-DUPADDR: ${src.name} possui conflito de IP (${src.ip}).<br>Ping indisponível enquanto o conflito persistir.</span>`;
    return;
  }
  const targets = nodes.filter(n => n.ip === dst && n.active && n.id !== src.id);
  if (targets.length > 1 || (targets.length === 1 && targets[0].ipConflict)) {
    out.innerHTML = `<span style="color:var(--accent-yellow)">%IP-4-DUPADDR: Conflito de endereço IP detectado para ${dst}.<br>Destino inacessível — múltiplos hosts com o mesmo IP.<br><br>Estatísticas: 4 enviados, 0 recebidos, 100% perdidos</span>`;
    return;
  }

  const target = targets[0];
  const reachable = target && isReachable(src, target);

  if (cmd === 'ping') {
    out.innerHTML = `<span style="color:var(--accent)">Pingando ${dst} a partir de ${src.name}...</span><br>`;
    for (let i=1;i<=4;i++) {
      setTimeout(()=>{
        if (reachable) {
          const ms = Math.floor(Math.random()*20+1);
          out.innerHTML += `<span style="color:var(--accent-green)">Resposta de ${dst}: bytes=32 tempo=${ms}ms TTL=128</span><br>`;
          if (target) {
            animatePingEnvelope(src, target, { subtitle: 'Echo Request' });
            setTimeout(() => animatePingEnvelope(target, src, { subtitle: 'Echo Reply', replyStyle: true }), 500);
          }
        } else {
          out.innerHTML += `<span style="color:var(--accent-red)">Tempo limite esgotado.</span><br>`;
        }
        if (i===4) out.innerHTML += `<br><span style="color:var(--accent)">Estatísticas: 4 enviados, ${reachable?4:0} recebidos, ${reachable?0:100}% perdidos</span>`;
        out.scrollTop = out.scrollHeight;
      }, 300*i);
    }
  } else {
    out.innerHTML = `<span style="color:var(--accent)">Traceroute para ${dst}:</span><br>`;
    const hops = target ? findPath(src, target) : [];
    if (!hops.length || !pathVlanOk(hops)) {
      out.innerHTML += `<span style="color:var(--accent-red)">* * * Destino inacessível (topologia/VLAN)</span>`;
      return;
    }
    hops.forEach((hop,i) => {
      setTimeout(()=>{
        const ms = Math.floor(Math.random()*20+1);
        out.innerHTML += `<span style="color:var(--accent-green)"> ${String(i+1).padStart(2)}  ${(hop.ip||hop.name).padEnd(18)} ${ms} ms</span><br>`;
        out.scrollTop = out.scrollHeight;
      }, 300*(i+1));
    });
  }
}

// ══════════════════════════════════════════
//  UNDO / REDO
// ══════════════════════════════════════════
function pushUndo() {
  undoStack.push(JSON.stringify({ nodes, links }));
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
}

function undoAction() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify({ nodes, links }));
  const state = JSON.parse(undoStack.pop());
  nodes = state.nodes; links = state.links;
  hydrateProject();
  deselect(); render(); updateStatusBar();
  cliLog('info','Ação desfeita.');
}

function redoAction() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify({ nodes, links }));
  const state = JSON.parse(redoStack.pop());
  nodes = state.nodes; links = state.links;
  hydrateProject();
  deselect(); render(); updateStatusBar();
  cliLog('info','Ação refeita.');
}

// ══════════════════════════════════════════
//  ZOOM / VIEW
// ══════════════════════════════════════════
function zoomIn() { viewScale = Math.min(3, viewScale*1.2); render(); }
function zoomOut() { viewScale = Math.max(0.2, viewScale/1.2); render(); }
function fitView() {
  if (!nodes.length) { viewX=0;viewY=0;viewScale=1;render();return; }
  const xs = nodes.map(n=>n.x), ys = nodes.map(n=>n.y);
  const minX=Math.min(...xs)-60, maxX=Math.max(...xs)+60;
  const minY=Math.min(...ys)-60, maxY=Math.max(...ys)+60;
  const W=svg.clientWidth, H=svg.clientHeight;
  viewScale = Math.min(W/(maxX-minX), H/(maxY-minY), 2);
  viewX = -minX*viewScale + (W - (maxX-minX)*viewScale)/2;
  viewY = -minY*viewScale + (H - (maxY-minY)*viewScale)/2;
  render();
}

// ══════════════════════════════════════════
//  AUTO LAYOUT
// ══════════════════════════════════════════
function autoLayout() {
  if (!nodes.length) return;
  pushUndo();
  const W = svg.clientWidth || 800;
  const H = svg.clientHeight || 500;
  const cx = W/2/viewScale - viewX/viewScale;
  const cy = H/2/viewScale - viewY/viewScale;
  const r = Math.min(W,H) * 0.35 / viewScale;
  nodes.forEach((n,i) => {
    const angle = (2*Math.PI*i/nodes.length) - Math.PI/2;
    n.x = cx + r * Math.cos(angle);
    n.y = cy + r * Math.sin(angle);
  });
  render();
  cliLog('ok','Layout automático aplicado.');
}

// ══════════════════════════════════════════
//  PROJECT
// ══════════════════════════════════════════
function newProject() {
  if (!confirm('Criar novo projeto? O projeto atual será perdido.')) return;
  pushUndo(); nodes=[]; links=[]; deselect(); render(); updateStatusBar();
  cliLog('info','Novo projeto criado.');
}

function saveProject() {
  const data = JSON.stringify({ nodes, links, viewX, viewY, viewScale }, null, 2);
  const blob = new Blob([data], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'topologia-netsim.json';
  a.click();
  cliLog('ok','Projeto salvo: topologia-netsim.json');
}

function loadProject() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        nodes = data.nodes||[]; links = data.links||[];
        viewX = data.viewX||0; viewY = data.viewY||0; viewScale = data.viewScale||1;
        hydrateProject();
        deselect(); render(); updateStatusBar();
        cliLog('ok','Projeto carregado com sucesso!');
      } catch { cliLog('err','Erro ao carregar arquivo.'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

function exportTopology() {
  let txt = '=== TOPOLOGIA NETSIM PRO ===\n\n';
  txt += `Dispositivos (${nodes.length}):\n`;
  nodes.filter(n=>n.type!=='note').forEach(n => {
    txt += `  [${DEVICE_META[n.type]?.label||n.type}] ${n.name} — IP: ${n.ip||'N/A'} / GW: ${n.gateway||'N/A'}\n`;
  });
  txt += `\nConexões (${links.length}):\n`;
  links.forEach(l => {
    const a=getNode(l.src), b=getNode(l.dst);
    txt += `  ${a?.name||'?'} ↔ ${b?.name||'?'} [${l.type}]\n`;
  });
  const blob = new Blob([txt], {type:'text/plain'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'topologia.txt'; a.click();
}

// ══════════════════════════════════════════
//  CONTEXT MENU
// ══════════════════════════════════════════
function showCtxMenu(e, id) {
  e.preventDefault(); e.stopPropagation();
  ctxTarget = id;
  const menu = document.getElementById('ctx-menu');
  menu.style.display = 'block';
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
}

function ctxOpenCli() {
  if (!ctxTarget) return;
  select(ctxTarget);
  document.getElementById('cli-input').focus();
}

function ctxProperties() {
  if (!ctxTarget) return;
  select(ctxTarget);
  switchRpTab(document.querySelector('[data-tab="props"]'), 'props');
}

function ctxPingFrom() {
  if (!ctxTarget) return;
  select(ctxTarget);
  openPingModal();
  document.getElementById('ping-src').value = ctxTarget;
}

function ctxRename() {
  if (!ctxTarget) return;
  const n = getNode(ctxTarget);
  if (!n) return;
  const name = prompt('Novo nome:', n.name);
  if (name) { n.name = name; render(); showProperties(n); }
}

function ctxDelete() {
  if (!ctxTarget) return;
  pushUndo();
  const n = getNode(ctxTarget);
  links = links.filter(l => l.src !== ctxTarget && l.dst !== ctxTarget);
  nodes = nodes.filter(nd => nd.id !== ctxTarget);
  if (selected === ctxTarget) deselect();
  cliLog('warn', `Dispositivo ${n?.name||ctxTarget} excluído.`);
  render(); updateStatusBar();
}

// ══════════════════════════════════════════
//  TOOLTIP
// ══════════════════════════════════════════
function showTooltip(e, n) {
  const m = DEVICE_META[n.type];
  const tt = document.getElementById('tooltip');
  tt.innerHTML = `<b>${n.name}</b><br>${m?.label||n.type}${n.ip?'<br>IP: '+n.ip:''}${n.active?'<br><span style="color:#00c896">● Ativo</span>':'<br><span style="color:#e05050">● Inativo</span>'}`;
  tt.style.display = 'block';
  tt.style.left = (e.clientX+12)+'px';
  tt.style.top = (e.clientY+12)+'px';
}

function hideTooltip() { document.getElementById('tooltip').style.display='none'; }

// ══════════════════════════════════════════
//  SIM MODE
// ══════════════════════════════════════════
function toggleSimMode() {
  simMode = !simMode;
  const dot = document.getElementById('sim-dot');
  const txt = document.getElementById('sim-status-txt');
  const btn = document.getElementById('sim-toggle-btn');
  if (simMode) {
    dot.classList.add('red');
    txt.textContent = 'Modo Simulação';
    btn.textContent = '⏸ Simulação';
    btn.className = 'sim-toggle';
    cliLog('warn','Modo Simulação ativado — pacotes serão rastreados passo a passo.');
  } else {
    dot.classList.remove('red');
    txt.textContent = 'Modo Tempo Real';
    btn.textContent = '⏱ Tempo Real';
    btn.className = 'sim-toggle realtime';
    cliLog('info','Modo Tempo Real ativado.');
  }
}

function runSimStep() {
  if (!simPduQueue.length) {
    cliLog('info','[SIM] Fila PDU vazia — ative Modo Simulação e execute um ping, ou aguarde eventos.');
    return;
  }
  const pdu = simPduQueue.shift();
  cliLog('info', `[SIM] PDU: ${pdu.kind} — origem ${pdu.src} → ${pdu.dst} (${pdu.dstIp})`);
}
function clearEventLog() { document.getElementById('cli-output').innerHTML=''; cliLog('info','Log de eventos limpo.'); }

// ══════════════════════════════════════════
//  MISC
// ══════════════════════════════════════════
function updateStatusBar() {
  document.getElementById('sb-devices').textContent = nodes.filter(n=>n.type!=='note').length;
  document.getElementById('sb-links').textContent = links.length;
}

function switchCliTab(el, tab) {
  document.querySelectorAll('.cli-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  currentCliTab = tab;
  if (tab === 'topology') {
    const out = document.getElementById('cli-output');
    out.innerHTML = '';
    cliLog('info','=== TOPOLOGIA ATUAL ===');
    nodes.filter(n=>n.type!=='note').forEach(n=>{
      const m=DEVICE_META[n.type];
      cliLog('ok',`${m?.icon||'?'} ${n.name.padEnd(12)} ${(m?.label||n.type).padEnd(12)} ${(n.ip||'sem IP').padEnd(16)} ${n.active?'🟢':'🔴'}`);
    });
    cliLog('','');
    cliLog('info',`Total: ${nodes.filter(n=>n.type!=='note').length} dispositivos, ${links.length} conexões`);
  }
}

function switchRpTab(el, tab) {
  document.querySelectorAll('.rp-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  ['rp-props','rp-routing','rp-arp'].forEach(id => document.getElementById(id).style.display='none');
  const map = {props:'rp-props',routing:'rp-routing',arp:'rp-arp'};
  document.getElementById(map[tab]).style.display='block';
}

function toggleSection(id) {
  const sec = document.getElementById('section-'+id);
  const arrow = document.getElementById('arrow-'+id);
  if (sec.style.display==='none') { sec.style.display=''; arrow.textContent='▼'; }
  else { sec.style.display='none'; arrow.textContent='▶'; }
}

function filterDevices(q) {
  document.querySelectorAll('.device-item').forEach(item => {
    const label = item.querySelector('.device-label')?.textContent?.toLowerCase()||'';
    item.style.display = label.includes(q.toLowerCase()) ? '' : 'none';
  });
}

function showRoutingTable() {
  const n = selected ? getNode(selected) : null;
  if (!n) { cliLog('err','Selecione um roteador.'); return; }
  switchRpTab(document.querySelector('[data-tab="routing"]'), 'routing');
}

function showArpTable() {
  const n = selected ? getNode(selected) : null;
  if (!n) { cliLog('err','Selecione um dispositivo.'); return; }
  switchRpTab(document.querySelector('[data-tab="arp"]'), 'arp');
}

function selectAll() {
  if (nodes.length) { select(nodes[nodes.length-1].id); }
}

function deleteSelected() {
  if (selected) ctxTarget=selected, ctxDelete();
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function showHelp() { openModal('help-modal'); }
function showAbout() {
  cliLog('info','NetSim Pro v1.1 — protótipo web educacional (não substitui Cisco Packet Tracer).');
}

// Keyboard shortcuts
function globalKeyDown(e) {
  if (e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA') return;
  if (e.key==='s'||e.key==='S') setMode('select');
  else if (e.key==='c'||e.key==='C') setMode('connect');
  else if (e.key==='x'||e.key==='X') setMode('delete');
  else if (e.key==='n'||e.key==='N') addNote();
  else if (e.key==='Delete'||e.key==='Backspace') deleteSelected();
  else if (e.key==='Escape') {
    if (document.getElementById('link-modal').classList.contains('open')) {
      cancelLinkModal();
      return;
    }
    setMode('select'); connectSource=null; render();
  }
  else if (e.ctrlKey&&e.key==='z') { e.preventDefault(); undoAction(); }
  else if (e.ctrlKey&&e.key==='y') { e.preventDefault(); redoAction(); }
  else if (e.ctrlKey&&e.key==='a') { e.preventDefault(); selectAll(); }
  else if (e.ctrlKey&&e.key==='s') { e.preventDefault(); saveProject(); }
  else if (e.ctrlKey&&e.key==='n') { e.preventDefault(); newProject(); }
}

window.addEventListener('resize', render);
