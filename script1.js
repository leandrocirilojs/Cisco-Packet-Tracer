
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

// ══════════════════════════════════════════
//  INICIALIZAÇÃO
// ══════════════════════════════════════════
window.onload = () => {
  render();
  updateStatusBar();
  cliLog('info','NetSim Pro v1.0 — Simulador de Redes');
  cliLog('info','Digite <b>help</b> para ver os comandos disponíveis.');
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
    const lw = lk.type === 'fiber' ? 2.5 : lk.type === 'serial' ? 1.5 : 2;
    const dash = lk.type === 'serial' ? '6,3' : lk.type === 'wireless' ? '4,4' : '';
    const col = lk.active ? '#00c896' : '#4a5260';
    html += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${col}" stroke-width="${lw}" stroke-dasharray="${dash}" opacity="0.8" data-link="${lk.id}"/>`;
    // midpoint label
    const mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
    if (lk.label) html += `<text x="${mx}" y="${my-6}" text-anchor="middle" fill="#5a6070" font-size="9" font-family="IBM Plex Mono">${lk.label}</text>`;
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

  document.getElementById('sb-devices').textContent = nodes.length;
  document.getElementById('sb-links').textContent = links.length;
  document.getElementById('zoom-display').textContent = Math.round(viewScale*100)+'%';
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
function addLink(srcId, dstId) {
  if (srcId === dstId) return;
  if (links.find(l => (l.src===srcId&&l.dst===dstId)||(l.src===dstId&&l.dst===srcId))) {
    cliLog('warn', 'Conexão já existe entre esses dispositivos.');
    return;
  }
  pushUndo();
  const ltype = getLinkType(srcId, dstId);
  const id = 'l' + Date.now();
  links.push({ id, src: srcId, dst: dstId, type: ltype, active: true, label: '' });
  // Update interface status
  const a = getNode(srcId), b = getNode(dstId);
  if (a && a.interfaces[0]) a.interfaces[0].status = 'up';
  if (b && b.interfaces[0]) b.interfaces[0].status = 'up';
  cliLog('ok', `Conexão estabelecida: ${a?.name} ↔ ${b?.name} [${ltype}]`);
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
      addLink(connectSource.id, id);
      connectSource = null;
      setMode('select');
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
    html += `
      <div class="iface-row">
        <div class="iface-name">${iface.name}</div>
        <div><input class="prop-input" style="width:100%;margin-top:4px" value="${iface.ip||''}" placeholder="IP da interface" onchange="updateIface('${n.id}',${i},'ip',this.value)"></div>
        <div class="iface-status ${iface.status==='up'?'status-up':'status-down'}">${iface.status==='up'?'🟢 Up':'🔴 Down'}</div>
      </div>
    `;
  });
  // Connected links
  const myLinks = links.filter(l => l.src===n.id||l.dst===n.id);
  if (myLinks.length) {
    html += `<div class="rp-section-title">Conexões (${myLinks.length})</div>`;
    myLinks.forEach(lk => {
      const peer = getNode(lk.src===n.id?lk.dst:lk.src);
      html += `<div class="iface-row"><div class="iface-name">${peer?.name||'?'}</div><div class="iface-ip">${lk.type} — ${lk.active?'<span class="status-up">🟢 Ativo</span>':'<span class="status-down">🔴 Inativo</span>'}</div></div>`;
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

let cliIfaceCtx = null; // current interface context: { nodeId, ifaceIndex, ifaceName }

function updateCliPrompt(n) {
  const label = n ? `${n.name}#` : 'NetSim#';
  document.getElementById('cli-prompt-label').textContent = label;
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
    let prompt = n ? n.name+'#' : 'NetSim#';
    if (cliIfaceCtx && cliIfaceCtx.nodeId === n?.id) {
      prompt = `${n.name}(config-if)#`;
    }
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

const CLI_COMMANDS = ['help','ping','traceroute','show ip','show arp','show version','show interfaces','show running-config','enable','configure terminal','hostname','ip address','ip route','no ip route','shutdown','no shutdown','clear','exit','end','write memory','copy running-config startup-config'];

function autocomplete(input) {
  const val = input.value.toLowerCase();
  const match = CLI_COMMANDS.find(c => c.startsWith(val) && c !== val);
  if (match) input.value = match;
}

function processCommand(cmd, n) {
  const c = cmd.trim().toLowerCase();
  if (c === 'help' || c === '?') {
    cliLog('info','Comandos disponíveis:');
    cliLog('','  <b>ping [ip]</b> — Testar conectividade ICMP');
    cliLog('','  <b>traceroute [ip]</b> — Rastrear rota');
    cliLog('','  <b>show ip</b> — Mostrar configuração IP');
    cliLog('','  <b>show arp</b> — Tabela ARP');
    cliLog('','  <b>show interfaces</b> — Status das interfaces');
    cliLog('','  <b>show running-config</b> — Configuração atual');
    cliLog('','  <b>show version</b> — Versão do sistema');
    cliLog('','  <b>hostname [nome]</b> — Renomear dispositivo');
    cliLog('','  <b>ip address [ip] [máscara]</b> — Configurar IP');
    cliLog('','  <b>interface [Fa0/0|Fa0/1|Se0/0]</b> — Entrar em contexto de interface');
    cliLog('','  <b>ip route [rede] [máscara] [nexthop]</b> — Rota estática');
    cliLog('','  <b>shutdown / no shutdown</b> — Desativar/ativar interface');
    cliLog('','  <b>clear</b> — Limpar terminal');
    cliLog('','  <b>write memory</b> — Salvar configuração');
    return;
  }
  if (c === 'clear') { document.getElementById('cli-output').innerHTML = ''; return; }
  if (c === 'show version') {
    cliLog('ok','NetSim Pro v1.0 — Cisco IOS Emulator');
    cliLog('','Sistema operacional: NetSim IOS 15.1(1)T');
    cliLog('','Uptime: '+Math.floor(Math.random()*48+1)+'h '+Math.floor(Math.random()*60)+'m');
    return;
  }
  if (!n) { cliLog('err','⚠ Nenhum dispositivo selecionado. Selecione um dispositivo no canvas.'); return; }

  if (c === 'show ip') {
    cliLog('ok',`Dispositivo: ${n.name}`);
    cliLog('','IP Address:  '+(n.ip||'(não configurado)'));
    cliLog('','Subnet Mask: '+(n.mask||'255.255.255.0'));
    cliLog('','Gateway:     '+(n.gateway||'(não configurado)'));
    if (n.ip && n.mask) {
      const netAddr = getNetworkAddr(n.ip, n.mask);
      const prefix = maskToPrefix(n.mask);
      const netStr = [(netAddr>>>24)&255,(netAddr>>>16)&255,(netAddr>>>8)&255,netAddr&255].join('.');
      cliLog('','Network:     '+netStr+'/'+prefix);
    }
    if (n.gateway) {
      const gwNode = nodes.find(nd => nd.ip === n.gateway);
      cliLog('','Gateway via: '+(gwNode ? gwNode.name : '(não encontrado na topologia)'));
    }
    return;
  }
  if (c === 'show ip route') {
    cliLog('ok',`Tabela de Roteamento — ${n.name}:`);
    if (n.ip) {
      const prefix = maskToPrefix(n.mask||'255.255.255.0');
      const netAddr = getNetworkAddr(n.ip, n.mask||'255.255.255.0');
      const netStr = [(netAddr>>>24)&255,(netAddr>>>16)&255,(netAddr>>>8)&255,netAddr&255].join('.');
      cliLog('ok',`C    ${netStr}/${prefix} is directly connected`);
    }
    if (n.routing?.length) {
      n.routing.forEach(r => cliLog('ok',`S    ${r.network}/${r.prefix} [${r.metric}/0] via ${r.nexthop}`));
    } else if (n.type !== 'router' && n.type !== 'router3layer') {
      if (n.gateway) cliLog('ok',`S*   0.0.0.0/0 via ${n.gateway} (default gateway)`);
    }
    if (!n.ip && !n.routing?.length) cliLog('warn','Nenhuma rota configurada.');
    return;
  }
  if (c === 'show arp') {
    if (!n.arp?.length) { cliLog('warn','Tabela ARP vazia.'); return; }
    cliLog('','Protocol  Address          Age   Hardware Addr     Type');
    n.arp.forEach(a => cliLog('ok',`Internet  ${a.ip.padEnd(17)} ${String(a.age||'-').padEnd(6)}${a.mac}  ARPA`));
    return;
  }
  if (c === 'show interfaces') {
    if (!n.interfaces?.length) { cliLog('warn','Nenhuma interface disponível.'); return; }
    n.interfaces.forEach(iface => {
      const st = iface.status === 'up' ? 'up' : 'down';
      cliLog(st==='up'?'ok':'warn',`${iface.name} is ${st}, line protocol is ${st}`);
      cliLog('',`  Internet address is ${iface.ip || 'unassigned'}${iface.ip&&iface.mask?' /'+maskToPrefix(iface.mask):''}`);
      cliLog('',`  MTU 1500 bytes, BW 100000 Kbit`);
    });
    return;
  }
  if (c === 'show running-config') {
    cliLog('ok','Building configuration...');
    cliLog('','hostname '+n.name);
    if (n.ip) cliLog('','ip address '+n.ip+' '+(n.mask||'255.255.255.0'));
    if (n.gateway) cliLog('','ip default-gateway '+n.gateway);
    (n.routing||[]).forEach(r => cliLog('','ip route '+r.network+' '+r.mask+' '+r.nexthop));
    cliLog('','end');
    return;
  }
  if (c.startsWith('hostname ')) {
    const newName = cmd.split(' ').slice(1).join(' ').trim();
    if (newName) { n.name = newName; render(); showProperties(n); updateCliPrompt(n); cliLog('ok','Hostname alterado para: '+newName); }
    return;
  }
  if (c.startsWith('ip address ')) {
    const parts = cmd.split(' ');
    if (parts.length >= 4) {
      const newIp = parts[2];
      const newMask = parts[3];
      // If inside interface context, configure that interface's IP
      if (cliIfaceCtx && cliIfaceCtx.nodeId === n.id) {
        const iface = n.interfaces[cliIfaceCtx.ifaceIndex];
        iface.ip = newIp;
        iface.mask = newMask;
        iface.status = 'up';
        // Also update router's main IP if it's the first interface
        if (cliIfaceCtx.ifaceIndex === 0 && !n.ip) { n.ip = newIp; n.mask = newMask; }
        cliLog('ok', `IP ${newIp} ${newMask} configurado em ${iface.name}.`);
        render(); showProperties(n);
        return;
      }
      // No interface context — configure device main IP
      const oldIp = n.ip;
      n.ip = newIp; n.mask = newMask;
      const conflict = nodes.find(nd => nd.ip === newIp && nd.id !== n.id && nd.type !== 'note');
      if (conflict) {
        cliLog('warn', `%IP-4-DUPADDR: Duplicate address ${newIp} on ${n.name}, sourced by ${conflict.name}`);
        cliLog('warn', `  Ambos os dispositivos ficarão inacessíveis na rede.`);
        n.ipConflict = true;
        conflict.ipConflict = true;
      } else {
        if (oldIp) {
          const wasConflict = nodes.find(nd => nd.ip === oldIp && nd.id !== n.id && nd.type !== 'note');
          if (wasConflict) { wasConflict.ipConflict = false; cliLog('ok',`  Conflito resolvido para ${wasConflict.name}.`); }
        }
        n.ipConflict = false;
        cliLog('ok','IP configurado: '+n.ip+' '+n.mask);
      }
      render(); showProperties(n);
    } else cliLog('err','Uso: ip address [ip] [máscara]');
    return;
  }
  if (c.startsWith('ip route ')) {
    const parts = cmd.split(' ');
    if (parts.length >= 5) {
      if (!n.routing) n.routing = [];
      n.routing.push({ network: parts[2], mask: parts[3], nexthop: parts[4], metric: parts[5]||'1', prefix: maskToPrefix(parts[3]) });
      showProperties(n);
      cliLog('ok',`Rota adicionada: ${parts[2]}/${maskToPrefix(parts[3])} via ${parts[4]}`);
    } else cliLog('err','Uso: ip route [rede] [máscara] [nexthop] [métrica]');
    return;
  }
  if (c.startsWith('no ip route ')) {
    const parts = cmd.split(' ');
    if (parts.length >= 5) {
      n.routing = (n.routing||[]).filter(r => !(r.network===parts[3]&&r.nexthop===parts[4]));
      showProperties(n); cliLog('ok','Rota removida.');
    }
    return;
  }
  if (c === 'shutdown') {
    if (cliIfaceCtx && cliIfaceCtx.nodeId === n.id) {
      n.interfaces[cliIfaceCtx.ifaceIndex].status = 'down';
      cliLog('warn',`Interface ${cliIfaceCtx.ifaceName} desativada.`);
    } else {
      n.active = false;
      cliLog('warn','Interface desativada (shutdown).');
    }
    render(); showProperties(n); return;
  }
  if (c === 'no shutdown') {
    if (cliIfaceCtx && cliIfaceCtx.nodeId === n.id) {
      n.interfaces[cliIfaceCtx.ifaceIndex].status = 'up';
      cliLog('ok',`Interface ${cliIfaceCtx.ifaceName} ativada.`);
    } else {
      n.active = true;
      cliLog('ok','Interface ativada (no shutdown).');
    }
    render(); showProperties(n); return;
  }
  if (c === 'write memory' || c === 'copy running-config startup-config') {
    cliLog('ok','Building configuration... [OK]');
    cliLog('ok','Configuration saved.');
    return;
  }
  if (c === 'enable') { cliLog('ok','Enter Password: '); setTimeout(()=>cliLog('ok',n.name+'#'),300); return; }
  if (c === 'configure terminal' || c === 'conf t') {
    cliIfaceCtx = null;
    cliLog('ok','Enter configuration commands, one per line. End with CNTL/Z.');
    cliLog('ok',n.name+'(config)#');
    return;
  }
  if (c === 'exit') {
    if (cliIfaceCtx && cliIfaceCtx.nodeId === n.id) {
      cliIfaceCtx = null;
      cliLog('ok', n.name+'(config)#');
    } else {
      cliLog('ok', n.name+'#');
    }
    return;
  }
  if (c === 'end' || c === '^z') {
    cliIfaceCtx = null;
    cliLog('ok', n.name+'#');
    return;
  }
  // interface Fa0/0 | Fa0/1 | Se0/0 ...
  if (c.startsWith('interface ')) {
    const ifName = cmd.split(' ').slice(1).join(' ').trim();
    if (!n.interfaces?.length) { cliLog('err','Este dispositivo não possui interfaces configuráveis.'); return; }
    // Match by name (case-insensitive, also allow short forms: fa0/0, f0/0, s0/0)
    const normalize = s => s.toLowerCase().replace(/fastethernet/,'fa').replace(/gigabitethernet/,'gi').replace(/serial/,'se').replace(/ethernet/,'et');
    const ifIdx = n.interfaces.findIndex(i => normalize(i.name) === normalize(ifName));
    if (ifIdx === -1) {
      cliLog('err', `% Interface ${ifName} não encontrada em ${n.name}.`);
      cliLog('info', 'Interfaces disponíveis: ' + n.interfaces.map(i=>i.name).join(', '));
      return;
    }
    cliIfaceCtx = { nodeId: n.id, ifaceIndex: ifIdx, ifaceName: n.interfaces[ifIdx].name };
    cliLog('ok', `${n.name}(config-if)# [${n.interfaces[ifIdx].name}]`);
    return;
  }
  if (c.startsWith('ping ')) { runPing(n, cmd.split(' ')[1]); return; }
  if (c.startsWith('traceroute ')) { runTraceroute(n, cmd.split(' ')[1]); return; }

  cliLog('err',`% Comando não reconhecido: "${cmd}". Digite <b>help</b> para ajuda.`);
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
  const result = routePacket(n, dst);
  const reachable = result.reachable;
  const target = nodes.find(nd => nd.ip === dst && nd.active !== false);
  for (let i=1;i<=4;i++) {
    setTimeout(()=>{
      if (reachable) {
        const ms = Math.floor(Math.random()*20+1);
        cliLog('ok',`Resposta de ${dst}: bytes=32 tempo=${ms}ms TTL=128`);
        if (target) animatePacket(n, target);
      } else {
        cliLog('err',`Tempo limite esgotado: ${dst} inacessível`);
      }
      if (i===4) {
        cliLog('','');
        cliLog('info',`Estatísticas: 4 pacotes enviados, ${reachable?4:0} recebidos, ${reachable?0:100}% perdidos`);
        if (!reachable) cliLog('warn', `Motivo: ${result.reason}`);
        if (reachable) showProperties(n); // refresh ARP table
      }
    }, 200 * i);
  }
}

function runTraceroute(n, dst) {
  if (!dst) { cliLog('err','Uso: traceroute [ip]'); return; }
  cliLog('info',`Traceroute para ${dst}:`);
  const result = routePacket(n, dst);
  if (!result.reachable || !result.path.length) {
    setTimeout(()=>{
      cliLog('err','* * * Destino inacessível');
      if (result.reason) cliLog('warn', `Motivo: ${result.reason}`);
    }, 300);
    return;
  }
  const hops = result.path;
  const startTTL = 128;
  hops.forEach((hop, i) => {
    setTimeout(() => {
      const ms = Math.floor(Math.random() * 20 + 1);
      const ttl = startTTL - i;
      cliLog('ok', ` ${String(i+1).padStart(2)}  ${(hop.ip || hop.name).padEnd(18)} ${ms} ms  TTL=${ttl}  [${hop.name}]`);
    }, 300 * (i + 1));
  });
}

// ══════════════════════════════════════════
//  NETWORK ENGINE — Subnet-aware routing
// ══════════════════════════════════════════

function ipToInt(ip) {
  if (!ip) return 0;
  return ip.split('.').reduce((acc, oct) => (acc << 8) | parseInt(oct), 0) >>> 0;
}

function maskToInt(mask) {
  if (!mask) return 0xFFFFFF00;
  if (mask.includes('.')) return ipToInt(mask);
  // CIDR prefix
  const bits = parseInt(mask);
  return bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0;
}

function sameSubnet(ip1, mask1, ip2) {
  if (!ip1 || !ip2) return false;
  const m = maskToInt(mask1 || '255.255.255.0');
  return (ipToInt(ip1) & m) === (ipToInt(ip2) & m);
}

function getNetworkAddr(ip, mask) {
  if (!ip) return null;
  const m = maskToInt(mask || '255.255.255.0');
  return (ipToInt(ip) & m) >>> 0;
}

// Physical BFS — ignores IP, just follows links (used internally)
function findPhysicalPath(src, dst) {
  const visited = new Set();
  const queue = [[src]];
  while (queue.length) {
    const path = queue.shift();
    const cur = path[path.length - 1];
    if (cur.id === dst.id) return path;
    if (visited.has(cur.id)) continue;
    visited.add(cur.id);
    links.filter(l => (l.src === cur.id || l.dst === cur.id) && l.active).forEach(lk => {
      const nId = lk.src === cur.id ? lk.dst : lk.src;
      const nb = getNode(nId);
      if (nb && nb.active !== false && !visited.has(nId)) queue.push([...path, nb]);
    });
  }
  return [];
}

// Returns the router physically connected to this node (via switch or direct)
function findConnectedRouter(node) {
  const visited = new Set([node.id]);
  const queue = [node];
  while (queue.length) {
    const cur = queue.shift();
    const neighbors = links
      .filter(l => (l.src === cur.id || l.dst === cur.id) && l.active)
      .map(l => getNode(l.src === cur.id ? l.dst : l.src))
      .filter(n => n && n.active !== false && !visited.has(n.id));
    for (const nb of neighbors) {
      visited.add(nb.id);
      if (nb.type === 'router' || nb.type === 'router3layer') return nb;
      // allow traversal through switches only
      if (nb.type === 'switch' || nb.type === 'switch3layer') queue.push(nb);
    }
  }
  return null;
}

// Find router that has an interface on the given subnet
function findRouterForSubnet(networkAddr, mask, excludeId) {
  return nodes.find(n => {
    if (n.type !== 'router' && n.type !== 'router3layer') return false;
    if (n.id === excludeId) return false;
    if (n.active === false) return false;
    // Check main IP
    if (n.ip && getNetworkAddr(n.ip, mask) === networkAddr) return true;
    // Check interfaces
    return (n.interfaces || []).some(ifc => ifc.ip && getNetworkAddr(ifc.ip, mask) === networkAddr);
  });
}

// Core routing decision:
// Returns { reachable: bool, path: [...nodes], reason: string }
function routePacket(src, dstIp) {
  if (!src.ip || !dstIp) return { reachable: false, path: [], reason: 'IP não configurado na origem.' };

  const dstNode = nodes.find(n => n.ip === dstIp && n.active !== false && n.type !== 'note' && !n.ipConflict);
  if (!dstNode) return { reachable: false, path: [], reason: `Host ${dstIp} não encontrado ou inativo.` };
  if (dstNode.ipConflict) return { reachable: false, path: [], reason: `Conflito de IP em ${dstIp}.` };

  const srcMask = src.mask || '255.255.255.0';
  const dstMask = dstNode.mask || '255.255.255.0';

  // Same subnet — direct delivery
  if (sameSubnet(src.ip, srcMask, dstIp)) {
    const physPath = findPhysicalPath(src, dstNode);
    if (physPath.length > 0) {
      updateArp(src, dstNode);
      return { reachable: true, path: physPath, reason: 'Entrega direta (mesma sub-rede).' };
    }
    return { reachable: false, path: [], reason: 'Sem caminho físico na sub-rede.' };
  }

  // Different subnet — need gateway
  if (!src.gateway) {
    return { reachable: false, path: [], reason: `Gateway não configurado em ${src.name}. Configure o default gateway.` };
  }

  // Find the gateway node
  const gwNode = nodes.find(n => n.ip === src.gateway && n.active !== false);
  if (!gwNode) {
    return { reachable: false, path: [], reason: `Gateway ${src.gateway} não encontrado na rede.` };
  }
  if (gwNode.type !== 'router' && gwNode.type !== 'router3layer') {
    return { reachable: false, path: [], reason: `Gateway ${src.gateway} não é um roteador.` };
  }

  // Physical path to gateway
  const pathToGw = findPhysicalPath(src, gwNode);
  if (!pathToGw.length) {
    return { reachable: false, path: [], reason: `Sem caminho físico até o gateway ${src.gateway}.` };
  }

  // Router checks its routing table or directly connected interfaces
  const dstNetAddr = getNetworkAddr(dstIp, dstMask);

  // Check if router has direct interface on dst subnet
  const routerHasDirectRoute = (gwNode.ip && getNetworkAddr(gwNode.ip, dstMask) === dstNetAddr) ||
    (gwNode.interfaces || []).some(ifc => ifc.ip && ifc.status !== 'down' && getNetworkAddr(ifc.ip, dstMask) === dstNetAddr);

  // Check static routes on router
  let routeFound = routerHasDirectRoute;
  if (!routeFound && gwNode.routing?.length) {
    routeFound = gwNode.routing.some(r => {
      const rNet = getNetworkAddr(r.network, r.mask);
      const rMask = maskToInt(r.mask);
      return (ipToInt(dstIp) & rMask) >>> 0 === rNet;
    });
  }

  if (!routeFound) {
    return {
      reachable: false, path: [],
      reason: `Roteador ${gwNode.name} não possui rota para a rede ${dstIp}. Configure: ip route [rede] [máscara] [nexthop]`
    };
  }

  // Physical path from router to destination
  const pathFromGw = findPhysicalPath(gwNode, dstNode);
  if (!pathFromGw.length) {
    return { reachable: false, path: [], reason: `Sem caminho físico do roteador até ${dstIp}.` };
  }

  // Check dst gateway matches router IP on that subnet
  if (dstNode.gateway && dstNode.gateway !== gwNode.ip) {
    // dst has a different gateway — find it
    const dstGwNode = nodes.find(n => n.ip === dstNode.gateway && n.active !== false);
    if (!dstGwNode) {
      return { reachable: false, path: [], reason: `Gateway do destino (${dstNode.gateway}) não encontrado.` };
    }
  }

  // Full path: src → ... → router → ... → dst (deduplicate)
  const fullPath = [...pathToGw, ...pathFromGw.slice(1)];
  updateArp(src, gwNode);
  updateArp(gwNode, dstNode);
  return { reachable: true, path: fullPath, reason: 'Roteamento via ' + gwNode.name };
}

function updateArp(node, peer) {
  if (!node.ip || !peer.ip) return;
  if (!node.arp) node.arp = [];
  const existing = node.arp.find(a => a.ip === peer.ip);
  const mac = peer.mac || ('AA:BB:' + peer.id.slice(-4).toUpperCase().match(/.{1,2}/g)?.join(':') || '00:00');
  if (!existing) node.arp.push({ ip: peer.ip, mac });
}

function isReachable(src, dst) {
  return routePacket(src, dst.ip).reachable;
}

function findPath(src, dst) {
  return routePacket(src, dst.ip).path;
}

function animatePacket(src, dst) {
  const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
  circle.setAttribute('cx', src.x);
  circle.setAttribute('cy', src.y);
  circle.setAttribute('r', '5');
  circle.setAttribute('fill', '#00c896');
  circle.setAttribute('opacity', '1');
  svg.appendChild(circle);
  const steps = 20;
  let step = 0;
  const dx = (dst.x - src.x)/steps, dy = (dst.y - src.y)/steps;
  const iv = setInterval(()=>{
    step++;
    circle.setAttribute('cx', src.x + dx*step);
    circle.setAttribute('cy', src.y + dy*step);
    circle.setAttribute('opacity', 1 - step/steps);
    if (step >= steps) { clearInterval(iv); circle.remove(); }
  }, 25);
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

  const result = routePacket(src, dst);
  const reachable = result.reachable;
  const target = nodes.find(n => n.ip === dst && n.active !== false);

  if (cmd === 'ping') {
    out.innerHTML = `<span style="color:var(--accent)">Pingando ${dst} a partir de ${src.name}...</span><br>`;
    for (let i=1;i<=4;i++) {
      setTimeout(()=>{
        if (reachable) {
          const ms = Math.floor(Math.random()*20+1);
          out.innerHTML += `<span style="color:var(--accent-green)">Resposta de ${dst}: bytes=32 tempo=${ms}ms TTL=128</span><br>`;
          if (target) animatePacket(src, target);
        } else {
          out.innerHTML += `<span style="color:var(--accent-red)">Tempo limite esgotado.</span><br>`;
        }
        if (i===4) {
          out.innerHTML += `<br><span style="color:var(--accent)">Estatísticas: 4 enviados, ${reachable?4:0} recebidos, ${reachable?0:100}% perdidos</span>`;
          if (!reachable) out.innerHTML += `<br><span style="color:var(--accent-yellow)">Motivo: ${result.reason}</span>`;
          if (reachable) showProperties(src);
        }
        out.scrollTop = out.scrollHeight;
      }, 300*i);
    }
  } else {
    out.innerHTML = `<span style="color:var(--accent)">Traceroute para ${dst}:</span><br>`;
    if (!result.reachable || !result.path.length) {
      out.innerHTML += `<span style="color:var(--accent-red)">* * * Destino inacessível</span>`;
      if (result.reason) out.innerHTML += `<br><span style="color:var(--accent-yellow)">Motivo: ${result.reason}</span>`;
      return;
    }
    result.path.forEach((hop, i) => {
      setTimeout(() => {
        const ms = Math.floor(Math.random() * 20 + 1);
        const ttl = 128 - i;
        out.innerHTML += `<span style="color:var(--accent-green)"> ${String(i+1).padStart(2)}  ${(hop.ip||hop.name).padEnd(18)} ${ms} ms  TTL=${ttl}  [${hop.name}]</span><br>`;
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
  deselect(); render(); updateStatusBar();
  cliLog('info','Ação desfeita.');
}

function redoAction() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify({ nodes, links }));
  const state = JSON.parse(redoStack.pop());
  nodes = state.nodes; links = state.links;
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

function runSimStep() { cliLog('info','[SIM] Próximo passo de simulação...'); }
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
function showAbout() { cliLog('info','NetSim Pro v1.0 — Simulador de Redes Cisco — Desenvolvido com ❤️'); }

// Keyboard shortcuts
function globalKeyDown(e) {
  if (e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA') return;
  if (e.key==='s'||e.key==='S') setMode('select');
  else if (e.key==='c'||e.key==='C') setMode('connect');
  else if (e.key==='x'||e.key==='X') setMode('delete');
  else if (e.key==='n'||e.key==='N') addNote();
  else if (e.key==='Delete'||e.key==='Backspace') deleteSelected();
  else if (e.key==='Escape') { setMode('select'); connectSource=null; render(); }
  else if (e.ctrlKey&&e.key==='z') { e.preventDefault(); undoAction(); }
  else if (e.ctrlKey&&e.key==='y') { e.preventDefault(); redoAction(); }
  else if (e.ctrlKey&&e.key==='a') { e.preventDefault(); selectAll(); }
  else if (e.ctrlKey&&e.key==='s') { e.preventDefault(); saveProject(); }
  else if (e.ctrlKey&&e.key==='n') { e.preventDefault(); newProject(); }
}

window.addEventListener('resize', render);
</script>
</body>
</html>

    transition: all .1s; position: relative;
  }
  .tb-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
  .tb-btn.active { background: var(--accent); color: #fff; }
  .tb-btn[title]:hover::after {
    content: attr(title); position: absolute; bottom: -28px; left: 50%; transform: translateX(-50%);
    background: #000; color: #fff; padding: 3px 8px; border-radius: 3px; white-space: nowrap;
    font-size: 11px; z-index: 999; pointer-events: none;
  }
  .zoom-display { color: var(--text-secondary); font-size: 11px; font-family: 'IBM Plex Mono', monospace; padding: 0 8px; min-width: 44px; text-align: center; }
  .mode-indicator { margin-left: auto; display: flex; align-items: center; gap: 8px; padding-right: 8px; }
  .mode-badge { padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; }
  .mode-badge.select { background: rgba(0,160,209,.15); color: var(--accent); border: 1px solid rgba(0,160,209,.3); }
  .mode-badge.connect { background: rgba(0,200,150,.15); color: var(--accent-green); border: 1px solid rgba(0,200,150,.3); }
  .mode-badge.delete { background: rgba(224,80,80,.15); color: var(--accent-red); border: 1px solid rgba(224,80,80,.3); }
  .mode-badge.note { background: rgba(240,165,0,.15); color: var(--accent-orange); border: 1px solid rgba(240,165,0,.3); }

  /* ─── MAIN LAYOUT ─── */
  #main { display: flex; height: calc(100vh - 28px - var(--toolbar-h) - var(--statusbar-h)); }

  /* ─── LEFT SIDEBAR ─── */
  #sidebar {
    width: var(--sidebar-w); background: var(--bg-panel); border-right: 1px solid var(--border);
    display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0;
  }
  .sidebar-section { border-bottom: 1px solid var(--border); }
  .sidebar-header {
    padding: 7px 10px; font-size: 10px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 1px; color: var(--text-dim); display: flex; align-items: center;
    justify-content: space-between; cursor: pointer; user-select: none;
  }
  .sidebar-header:hover { color: var(--text-secondary); }
  .device-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; padding: 4px; }
  .device-item {
    padding: 8px 4px; display: flex; flex-direction: column; align-items: center; gap: 4px;
    cursor: grab; border-radius: 4px; transition: background .15s; user-select: none;
  }
  .device-item:hover { background: var(--bg-hover); }
  .device-item:active { cursor: grabbing; }
  .device-icon { font-size: 22px; line-height: 1; }
  .device-label { font-size: 10px; color: var(--text-secondary); text-align: center; }
  .search-box {
    padding: 6px 8px; display: flex; align-items: center; gap: 6px;
    border-bottom: 1px solid var(--border);
  }
  .search-box input {
    flex: 1; background: var(--bg-item); border: 1px solid var(--border); border-radius: 3px;
    padding: 4px 8px; color: var(--text-primary); font-size: 12px; outline: none;
  }
  .search-box input:focus { border-color: var(--accent); }

  /* ─── CANVAS AREA ─── */
  #canvas-wrap { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
  #canvas-container { flex: 1; overflow: hidden; position: relative; background: var(--bg-canvas); }
  #network-canvas {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    cursor: default;
  }
  .canvas-grid {
    position: absolute; inset: 0; pointer-events: none;
    background-image: radial-gradient(circle, rgba(255,255,255,.04) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  /* ─── RIGHT PANEL ─── */
  #right-panel {
    width: var(--rightpanel-w); background: var(--bg-panel); border-left: 1px solid var(--border);
    display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0;
  }
  .rp-tab-bar { display: flex; border-bottom: 1px solid var(--border); }
  .rp-tab { flex: 1; padding: 8px 4px; text-align: center; font-size: 11px; cursor: pointer; color: var(--text-dim); border-bottom: 2px solid transparent; transition: all .15s; }
  .rp-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .rp-tab:hover:not(.active) { color: var(--text-secondary); }
  .rp-content { flex: 1; overflow-y: auto; padding: 10px; }
  .rp-content::-webkit-scrollbar { width: 4px; }
  .rp-content::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
  .prop-row { display: flex; align-items: center; margin-bottom: 8px; gap: 6px; }
  .prop-label { color: var(--text-dim); font-size: 11px; min-width: 80px; }
  .prop-value { color: var(--text-primary); font-size: 12px; font-family: 'IBM Plex Mono', monospace; }
  .prop-input {
    flex: 1; background: var(--bg-item); border: 1px solid var(--border); border-radius: 3px;
    padding: 4px 7px; color: var(--text-primary); font-size: 12px; outline: none;
    font-family: 'IBM Plex Mono', monospace;
  }
  .prop-input:focus { border-color: var(--accent); }
  .rp-section-title { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--text-dim); margin: 10px 0 6px; }
  .iface-row { background: var(--bg-item); border-radius: 4px; padding: 6px 8px; margin-bottom: 4px; }
  .iface-name { font-size: 11px; font-family: 'IBM Plex Mono', monospace; color: var(--accent); }
  .iface-ip { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
  .iface-status { font-size: 10px; margin-top: 2px; }
  .status-up { color: var(--accent-green); }
  .status-down { color: var(--accent-red); }
  .btn-apply { background: var(--accent); color: #fff; border: none; border-radius: 3px; padding: 6px 14px; cursor: pointer; font-size: 12px; font-family: 'IBM Plex Sans', sans-serif; margin-top: 6px; width: 100%; }
  .btn-apply:hover { background: #0090c0; }
  .empty-state { color: var(--text-dim); font-size: 12px; text-align: center; padding: 30px 10px; line-height: 1.8; }

  /* ─── BOTTOM CLI ─── */
  #bottom-panel { height: var(--bottombar-h); border-top: 1px solid var(--border); display: flex; flex-direction: column; background: var(--bg-dark); }
  .cli-tabs { display: flex; background: var(--bg-panel); border-bottom: 1px solid var(--border); }
  .cli-tab { padding: 5px 14px; font-size: 11px; cursor: pointer; color: var(--text-dim); border-bottom: 2px solid transparent; }
  .cli-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .cli-tab:hover:not(.active) { color: var(--text-secondary); }
  #cli-output {
    flex: 1; overflow-y: auto; padding: 8px 12px; font-family: 'IBM Plex Mono', monospace;
    font-size: 12px; line-height: 1.6; color: #b8c0cc;
  }
  #cli-output::-webkit-scrollbar { width: 4px; }
  #cli-output::-webkit-scrollbar-thumb { background: var(--border); }
  .cli-line { padding: 1px 0; }
  .cli-prompt { color: var(--accent-green); }
  .cli-cmd { color: #fff; }
  .cli-ok { color: var(--accent-green); }
  .cli-err { color: var(--accent-red); }
  .cli-info { color: var(--accent); }
  .cli-warn { color: var(--accent-orange); }
  .cli-input-row { display: flex; align-items: center; gap: 8px; padding: 4px 12px; border-top: 1px solid var(--border); background: var(--bg-panel); }
  .cli-prompt-label { color: var(--accent-green); font-family: 'IBM Plex Mono', monospace; font-size: 12px; white-space: nowrap; }
  #cli-input {
    flex: 1; background: transparent; border: none; outline: none; color: #fff;
    font-family: 'IBM Plex Mono', monospace; font-size: 12px; caret-color: var(--accent-green);
  }

  /* ─── STATUS BAR ─── */
  #statusbar {
    height: var(--statusbar-h); background: #111315; border-top: 1px solid var(--border);
    display: flex; align-items: center; padding: 0 12px; gap: 20px; font-size: 11px;
    color: var(--text-dim); user-select: none;
  }
  .sb-item { display: flex; align-items: center; gap: 5px; }
  .sb-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-green); }
  .sb-dot.red { background: var(--accent-red); }
  .sb-right { margin-left: auto; display: flex; gap: 16px; }
  .sim-toggle { padding: 2px 10px; border-radius: 3px; background: rgba(0,160,209,.15); color: var(--accent); border: 1px solid rgba(0,160,209,.3); cursor: pointer; font-size: 11px; }
  .sim-toggle:hover { background: rgba(0,160,209,.25); }
  .sim-toggle.realtime { background: rgba(0,200,150,.15); color: var(--accent-green); border-color: rgba(0,200,150,.3); }

  /* ─── DEVICE NODES (SVG rendered) ─── */
  .node-label { font-family: 'IBM Plex Sans', sans-serif; font-size: 12px; fill: #e8eaed; }
  .node-sublabel { font-family: 'IBM Plex Mono', monospace; font-size: 10px; fill: #9aa0aa; }
  .node-selected rect, .node-selected ellipse { filter: drop-shadow(0 0 6px rgba(0,160,209,.8)); }

  /* ─── CONTEXT MENU ─── */
  #ctx-menu {
    display: none; position: fixed; background: var(--bg-panel); border: 1px solid var(--border);
    border-radius: 4px; z-index: 9999; min-width: 160px; box-shadow: 0 8px 24px rgba(0,0,0,.5);
  }
  .ctx-item { padding: 8px 14px; cursor: pointer; font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 8px; }
  .ctx-item:hover { background: var(--bg-hover); color: var(--text-primary); }
  .ctx-sep { border-top: 1px solid var(--border); margin: 3px 0; }
  .ctx-danger { color: var(--accent-red) !important; }

  /* ─── MODAL ─── */
  .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 10000; align-items: center; justify-content: center; }
  .modal-overlay.open { display: flex; }
  .modal { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 6px; width: 500px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,.7); }
  .modal-header { padding: 14px 18px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
  .modal-title { font-weight: 600; color: var(--text-primary); }
  .modal-close { cursor: pointer; color: var(--text-dim); font-size: 18px; line-height: 1; padding: 2px; }
  .modal-close:hover { color: var(--text-primary); }
  .modal-body { padding: 18px; overflow-y: auto; flex: 1; }
  .modal-footer { padding: 12px 18px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; }
  .btn { padding: 6px 16px; border-radius: 3px; cursor: pointer; font-size: 12px; border: 1px solid var(--border); font-family: 'IBM Plex Sans', sans-serif; }
  .btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .btn-primary:hover { background: #0090c0; }
  .btn-secondary { background: transparent; color: var(--text-secondary); }
  .btn-secondary:hover { background: var(--bg-hover); color: var(--text-primary); }

  /* ─── PING ANIMATION ─── */
  @keyframes packetAnim { 0% { r: 4; opacity: 1; } 100% { r: 0; opacity: 0; } }
  .packet { animation: packetAnim 0.5s linear; }

  /* ─── TOOLTIP ─── */
  #tooltip {
    display: none; position: fixed; background: rgba(17,19,21,.95); color: var(--text-primary);
    border: 1px solid var(--border); border-radius: 4px; padding: 6px 10px; font-size: 11px;
    pointer-events: none; z-index: 9998; line-height: 1.6; max-width: 200px;
    font-family: 'IBM Plex Mono', monospace;
  }

  /* scrollbar global */
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
</style>
</head>
<body>

<!-- MENU BAR -->
<div id="menubar">
  <div class="menu-logo">🌐 <span>NetSim</span> Pro</div>
  <div class="menu-items">
    <div class="menu-item">Arquivo
      <div class="dropdown">
        <div class="dd-item" onclick="newProject()">Novo Projeto <span class="dd-shortcut">Ctrl+N</span></div>
        <div class="dd-item" onclick="saveProject()">Salvar <span class="dd-shortcut">Ctrl+S</span></div>
        <div class="dd-item" onclick="loadProject()">Abrir <span class="dd-shortcut">Ctrl+O</span></div>
        <div class="dd-sep"></div>
        <div class="dd-item" onclick="exportTopology()">Exportar Topologia</div>
      </div>
    </div>
    <div class="menu-item">Editar
      <div class="dropdown">
        <div class="dd-item" onclick="undoAction()">Desfazer <span class="dd-shortcut">Ctrl+Z</span></div>
        <div class="dd-item" onclick="redoAction()">Refazer <span class="dd-shortcut">Ctrl+Y</span></div>
        <div class="dd-sep"></div>
        <div class="dd-item" onclick="selectAll()">Selecionar Tudo <span class="dd-shortcut">Ctrl+A</span></div>
        <div class="dd-item" onclick="deleteSelected()">Excluir Selecionado <span class="dd-shortcut">Del</span></div>
      </div>
    </div>
    <div class="menu-item">Ferramentas
      <div class="dropdown">
        <div class="dd-item" onclick="openPingModal()">Ping / Traceroute</div>
        <div class="dd-item" onclick="showRoutingTable()">Tabela de Roteamento</div>
        <div class="dd-item" onclick="showArpTable()">Tabela ARP</div>
        <div class="dd-sep"></div>
        <div class="dd-item" onclick="autoLayout()">Auto Layout</div>
        <div class="dd-item" onclick="addNote()">Adicionar Nota</div>
      </div>
    </div>
    <div class="menu-item">Simulação
      <div class="dropdown">
        <div class="dd-item" onclick="toggleSimMode()">Modo Simulação</div>
        <div class="dd-item" onclick="runSimStep()">Próximo Passo</div>
        <div class="dd-sep"></div>
        <div class="dd-item" onclick="clearEventLog()">Limpar Log de Eventos</div>
      </div>
    </div>
    <div class="menu-item">Ajuda
      <div class="dropdown">
        <div class="dd-item" onclick="showHelp()">Guia Rápido</div>
        <div class="dd-item" onclick="showAbout()">Sobre o NetSim Pro</div>
      </div>
    </div>
  </div>
</div>

<!-- TOOLBAR -->
<div id="toolbar">
  <div class="tb-group">
    <div class="tb-btn" title="Novo" onclick="newProject()">📄</div>
    <div class="tb-btn" title="Salvar" onclick="saveProject()">💾</div>
    <div class="tb-btn" title="Abrir" onclick="loadProject()">📂</div>
  </div>
  <div class="tb-group">
    <div class="tb-btn" title="Desfazer" onclick="undoAction()">↩</div>
    <div class="tb-btn" title="Refazer" onclick="redoAction()">↪</div>
  </div>
  <div class="tb-group">
    <div class="tb-btn active" id="btn-select" title="Selecionar (S)" onclick="setMode('select')">↖</div>
    <div class="tb-btn" id="btn-connect" title="Conectar (C)" onclick="setMode('connect')">🔗</div>
    <div class="tb-btn" id="btn-delete" title="Excluir (X)" onclick="setMode('delete')">🗑</div>
    <div class="tb-btn" id="btn-note" title="Nota de Texto (N)" onclick="setMode('note')">📝</div>
  </div>
  <div class="tb-group">
    <div class="tb-btn" title="Zoom +" onclick="zoomIn()">🔍</div>
    <div class="zoom-display" id="zoom-display">100%</div>
    <div class="tb-btn" title="Zoom -" onclick="zoomOut()">🔎</div>
    <div class="tb-btn" title="Fit na tela" onclick="fitView()">⊡</div>
  </div>
  <div class="tb-group">
    <div class="tb-btn" title="Ping" onclick="openPingModal()">📡</div>
    <div class="tb-btn" title="Auto Layout" onclick="autoLayout()">⊞</div>
  </div>
  <div class="mode-indicator">
    <div class="mode-badge select" id="mode-badge">SELECIONAR</div>
  </div>
</div>

<!-- MAIN -->
<div id="main">

  <!-- SIDEBAR -->
  <div id="sidebar">
    <div class="search-box">
      <span style="color:var(--text-dim)">🔍</span>
      <input type="text" placeholder="Buscar dispositivo..." id="device-search" oninput="filterDevices(this.value)">
    </div>
    <div style="flex:1;overflow-y:auto;">
      <div class="sidebar-section">
        <div class="sidebar-header" onclick="toggleSection('routers')">📡 Roteadores <span id="arrow-routers">▼</span></div>
        <div class="device-grid" id="section-routers">
          <div class="device-item" draggable="true" ondragstart="startDrag(event,'router')" ondblclick="addDeviceCenter('router')">
            <div class="device-icon">🔷</div><div class="device-label">Roteador</div>
          </div>
          <div class="device-item" draggable="true" ondragstart="startDrag(event,'router3layer')" ondblclick="addDeviceCenter('router3layer')">
            <div class="device-icon">🔹</div><div class="device-label">Roteador L3</div>
          </div>
        </div>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-header" onclick="toggleSection('switches')">⚡ Switches <span id="arrow-switches">▼</span></div>
        <div class="device-grid" id="section-switches">
          <div class="device-item" draggable="true" ondragstart="startDrag(event,'switch')" ondblclick="addDeviceCenter('switch')">
            <div class="device-icon">🔲</div><div class="device-label">Switch L2</div>
          </div>
          <div class="device-item" draggable="true" ondragstart="startDrag(event,'switch3layer')" ondblclick="addDeviceCenter('switch3layer')">
            <div class="device-icon">◼</div><div class="device-label">Switch L3</div>
          </div>
        </div>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-header" onclick="toggleSection('endpoints')">💻 Dispositivos Finais <span id="arrow-endpoints">▼</span></div>
        <div class="device-grid" id="section-endpoints">
          <div class="device-item" draggable="true" ondragstart="startDrag(event,'pc')" ondblclick="addDeviceCenter('pc')">
            <div class="device-icon">🖥️</div><div class="device-label">PC</div>
          </div>
          <div class="device-item" draggable="true" ondragstart="startDrag(event,'laptop')" ondblclick="addDeviceCenter('laptop')">
            <div class="device-icon">💻</div><div class="device-label">Notebook</div>
          </div>
          <div class="device-item" draggable="true" ondragstart="startDrag(event,'server')" ondblclick="addDeviceCenter('server')">
            <div class="device-icon">🖨️</div><div class="device-label">Servidor</div>
          </div>
          <div class="device-item" draggable="true" ondragstart="startDrag(event,'printer')" ondblclick="addDeviceCenter('printer')">
            <div class="device-icon">🖨</div><div class="device-label">Impressora</div>
          </div>
        </div>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-header" onclick="toggleSection('wireless')">📶 Sem Fio <span id="arrow-wireless">▼</span></div>
        <div class="device-grid" id="section-wireless">
          <div class="device-item" draggable="true" ondragstart="startDrag(event,'ap')" ondblclick="addDeviceCenter('ap')">
            <div class="device-icon">📡</div><div class="device-label">Access Point</div>
          </div>
          <div class="device-item" draggable="true" ondragstart="startDrag(event,'smartphone')" ondblclick="addDeviceCenter('smartphone')">
            <div class="device-icon">📱</div><div class="device-label">Smartphone</div>
          </div>
        </div>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-header" onclick="toggleSection('wan')">🌐 WAN / Internet <span id="arrow-wan">▼</span></div>
        <div class="device-grid" id="section-wan">
          <div class="device-item" draggable="true" ondragstart="startDrag(event,'cloud')" ondblclick="addDeviceCenter('cloud')">
            <div class="device-icon">☁️</div><div class="device-label">Cloud</div>
          </div>
          <div class="device-item" draggable="true" ondragstart="startDrag(event,'internet')" ondblclick="addDeviceCenter('internet')">
            <div class="device-icon">🌐</div><div class="device-label">Internet</div>
          </div>
          <div class="device-item" draggable="true" ondragstart="startDrag(event,'modem')" ondblclick="addDeviceCenter('modem')">
            <div class="device-icon">📟</div><div class="device-label">Modem</div>
          </div>
          <div class="device-item" draggable="true" ondragstart="startDrag(event,'firewall')" ondblclick="addDeviceCenter('firewall')">
            <div class="device-icon">🛡️</div><div class="device-label">Firewall</div>
          </div>
        </div>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-header" onclick="toggleSection('iot')">🔌 IoT <span id="arrow-iot">▼</span></div>
        <div class="device-grid" id="section-iot">
          <div class="device-item" draggable="true" ondragstart="startDrag(event,'camera')" ondblclick="addDeviceCenter('camera')">
            <div class="device-icon">📷</div><div class="device-label">Câmera IP</div>
          </div>
          <div class="device-item" draggable="true" ondragstart="startDrag(event,'sensor')" ondblclick="addDeviceCenter('sensor')">
            <div class="device-icon">🌡️</div><div class="device-label">Sensor</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- CANVAS -->
  <div id="canvas-wrap">
    <div id="canvas-container"
      ondragover="event.preventDefault()"
      ondrop="onDrop(event)"
      onmousedown="canvasMouseDown(event)"
      onmousemove="canvasMouseMove(event)"
      onmouseup="canvasMouseUp(event)"
      onwheel="onWheel(event)"
      oncontextmenu="event.preventDefault()">
      <div class="canvas-grid"></div>
      <svg id="network-canvas" xmlns="http://www.w3.org/2000/svg"></svg>
    </div>

    <!-- BOTTOM CLI -->
    <div id="bottom-panel">
      <div class="cli-tabs">
        <div class="cli-tab active" onclick="switchCliTab(this,'terminal')">Terminal / CLI</div>
        <div class="cli-tab" onclick="switchCliTab(this,'events')">Log de Eventos</div>
        <div class="cli-tab" onclick="switchCliTab(this,'topology')">Info da Topologia</div>
      </div>
      <div id="cli-output"></div>
      <div class="cli-input-row">
        <div class="cli-prompt-label" id="cli-prompt-label">NetSim#</div>
        <input type="text" id="cli-input" placeholder="Digite um comando (help para ajuda)..." autocomplete="off" onkeydown="cliKeyDown(event)">
      </div>
    </div>
  </div>

  <!-- RIGHT PANEL -->
  <div id="right-panel">
    <div class="rp-tab-bar">
      <div class="rp-tab active" onclick="switchRpTab(this,'props')" data-tab="props">Propriedades</div>
      <div class="rp-tab" onclick="switchRpTab(this,'routing')" data-tab="routing">Rotas</div>
      <div class="rp-tab" onclick="switchRpTab(this,'arp')" data-tab="arp">ARP</div>
    </div>
    <div class="rp-content" id="rp-props">
      <div class="empty-state">Selecione um dispositivo<br>para ver suas propriedades</div>
    </div>
    <div class="rp-content" id="rp-routing" style="display:none">
      <div class="empty-state">Selecione um roteador<br>para ver a tabela de rotas</div>
    </div>
    <div class="rp-content" id="rp-arp" style="display:none">
      <div class="empty-state">Selecione um dispositivo<br>para ver a tabela ARP</div>
    </div>
  </div>
</div>

<!-- STATUS BAR -->
<div id="statusbar">
  <div class="sb-item"><div class="sb-dot" id="sim-dot"></div><span id="sim-status-txt">Modo Tempo Real</span></div>
  <div class="sb-item">Dispositivos: <b id="sb-devices">0</b></div>
  <div class="sb-item">Conexões: <b id="sb-links">0</b></div>
  <div class="sb-item" id="sb-selected" style="display:none">Selecionado: <b id="sb-sel-name">-</b></div>
  <div class="sb-right">
    <span id="sb-coords" style="font-family:'IBM Plex Mono',monospace;">x:0 y:0</span>
    <div class="sim-toggle realtime" id="sim-toggle-btn" onclick="toggleSimMode()">⏱ Tempo Real</div>
  </div>
</div>

<!-- CONTEXT MENU -->
<div id="ctx-menu">
  <div class="ctx-item" onclick="ctxOpenCli()">💻 Abrir CLI</div>
  <div class="ctx-item" onclick="ctxProperties()">⚙️ Propriedades</div>
  <div class="ctx-item" onclick="ctxPingFrom()">📡 Ping a partir daqui</div>
  <div class="ctx-sep"></div>
  <div class="ctx-item" onclick="ctxRename()">✏️ Renomear</div>
  <div class="ctx-sep"></div>
  <div class="ctx-item ctx-danger" onclick="ctxDelete()">🗑 Excluir</div>
</div>

<!-- TOOLTIP -->
<div id="tooltip"></div>

<!-- PING MODAL -->
<div class="modal-overlay" id="ping-modal">
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title">📡 Ping / Traceroute</div>
      <div class="modal-close" onclick="closeModal('ping-modal')">✕</div>
    </div>
    <div class="modal-body">
      <div class="prop-row">
        <div class="prop-label">Origem:</div>
        <select class="prop-input" id="ping-src" style="flex:1"></select>
      </div>
      <div class="prop-row">
        <div class="prop-label">Destino IP:</div>
        <input class="prop-input" type="text" id="ping-dst" placeholder="ex: 192.168.1.1">
      </div>
      <div class="prop-row">
        <div class="prop-label">Comando:</div>
        <select class="prop-input" id="ping-cmd" style="flex:1">
          <option value="ping">Ping (ICMP)</option>
          <option value="traceroute">Traceroute</option>
        </select>
      </div>
      <div style="margin-top:10px;background:var(--bg-dark);border-radius:4px;padding:10px;font-family:'IBM Plex Mono',monospace;font-size:12px;min-height:80px;max-height:180px;overflow-y:auto;color:#b8c0cc;" id="ping-output">Clique em Executar para começar...</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal('ping-modal')">Fechar</button>
      <button class="btn btn-primary" onclick="executePing()">Executar</button>
    </div>
  </div>
</div>

<!-- HELP MODAL -->
<div class="modal-overlay" id="help-modal">
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title">📖 Guia Rápido — NetSim Pro</div>
      <div class="modal-close" onclick="closeModal('help-modal')">✕</div>
    </div>
    <div class="modal-body" style="font-size:12px;line-height:1.8;color:var(--text-secondary)">
      <b style="color:var(--text-primary)">Adicionar Dispositivos</b><br>
      • Arraste da barra lateral para o canvas<br>
      • Ou dê duplo clique no dispositivo<br><br>
      <b style="color:var(--text-primary)">Conectar Dispositivos</b><br>
      • Pressione <kbd style="background:var(--bg-item);padding:1px 5px;border-radius:2px;color:#fff">C</kbd> ou clique em 🔗<br>
      • Clique no primeiro dispositivo, depois no segundo<br><br>
      <b style="color:var(--text-primary)">CLI / Terminal</b><br>
      • Selecione um dispositivo e use o terminal abaixo<br>
      • Comandos: <code style="color:var(--accent)">help, ping, show ip, show arp, enable, config, hostname</code><br><br>
      <b style="color:var(--text-primary)">Atalhos de Teclado</b><br>
      • <kbd style="background:var(--bg-item);padding:1px 5px;border-radius:2px;color:#fff">S</kbd> Modo Selecionar &nbsp; <kbd style="background:var(--bg-item);padding:1px 5px;border-radius:2px;color:#fff">C</kbd> Conectar &nbsp; <kbd style="background:var(--bg-item);padding:1px 5px;border-radius:2px;color:#fff">X</kbd> Excluir<br>
      • <kbd style="background:var(--bg-item);padding:1px 5px;border-radius:2px;color:#fff">Del</kbd> Excluir selecionado &nbsp; <kbd style="background:var(--bg-item);padding:1px 5px;border-radius:2px;color:#fff">Esc</kbd> Cancelar<br>
      • <kbd style="background:var(--bg-item);padding:1px 5px;border-radius:2px;color:#fff">Ctrl+Z</kbd> Desfazer &nbsp; <kbd style="background:var(--bg-item);padding:1px 5px;border-radius:2px;color:#fff">Ctrl+A</kbd> Selecionar tudo<br>
      • Scroll do mouse: Zoom in/out<br>
      • Arraste canvas vazio: Mover visão
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" onclick="closeModal('help-modal')">Entendido</button>
    </div>
  </div>
</div>
