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
let nodeCounter = {};
let undoStack = [], redoStack = [];
let simMode = false;
let cliHistory = [], cliHistIdx = -1;
let ctxTarget = null;
let currentCliTab = 'terminal';
let dragDeviceType = null;

const svg = document.getElementById('network-canvas');

const DEVICE_META = {
  // Roteadores
  router:        { label:'Roteador 1941', icon:'🔷', color:'#00a0d1', shape:'diamond', interfaces:['Gi0/0','Gi0/1','Se0/0/0','Se0/0/1'] },
  router2901:    { label:'Roteador 2901', icon:'🔷', color:'#00a0d1', shape:'diamond', interfaces:['Gi0/0','Gi0/1','Gi0/2','Se0/0/0','Se0/0/1'] },
  router2911:    { label:'Roteador 2911', icon:'🔷', color:'#00a0d1', shape:'diamond', interfaces:['Gi0/0','Gi0/1','Gi0/2','Se0/0/0','Se0/0/1'] },
  router4321:    { label:'Roteador 4321', icon:'🔷', color:'#00a0d1', shape:'diamond', interfaces:['Gi0/0/0','Gi0/0/1','Se0/1/0','Se0/1/1'] },
  router4331:    { label:'Roteador 4331', icon:'🔷', color:'#00a0d1', shape:'diamond', interfaces:['Gi0/0/0','Gi0/0/1','Gi0/0/2','Se0/1/0','Se0/1/1'] },
  router3layer:  { label:'Roteador L3', icon:'🔹', color:'#0080b0', shape:'diamond', interfaces:['Gi0/0','Gi0/1','Gi0/2','Gi0/3'] },

  // Switches
  switch:        { label:'Switch 2960', icon:'🔲', color:'#00c896', shape:'rect', interfaces:['Fa0/1','Fa0/2','Fa0/3','Fa0/4','Fa0/5','Fa0/6','Fa0/7','Fa0/8','Gi0/1','Gi0/2'] },
  switch2950:    { label:'Switch 2950', icon:'🔲', color:'#00c896', shape:'rect', interfaces:['Fa0/1','Fa0/2','Fa0/3','Fa0/4','Fa0/5','Fa0/6','Fa0/7','Fa0/8'] },
  switch3560:    { label:'Switch 3560', icon:'◼',  color:'#009070', shape:'rect', interfaces:['Fa0/1','Fa0/2','Fa0/3','Fa0/4','Fa0/5','Fa0/6','Fa0/7','Fa0/8','Gi0/1','Gi0/2'] },
  switch3650:    { label:'Switch 3650', icon:'◼',  color:'#009070', shape:'rect', interfaces:['Gi1/0/1','Gi1/0/2','Gi1/0/3','Gi1/0/4','Gi1/0/5','Gi1/0/6','Gi1/0/7','Gi1/0/8'] },
  switch3layer:  { label:'Switch L3', icon:'◼',  color:'#009070', shape:'rect', interfaces:['Gi0/1','Gi0/2','Gi0/3','Gi0/4','Gi0/5','Gi0/6'] },
  bridge:        { label:'Bridge', icon:'🌉', color:'#00b080', shape:'rect', interfaces:['Fa0/1','Fa0/2'] },
  hub:           { label:'Hub', icon:'🔘', color:'#7aa0a0', shape:'rect', interfaces:['Fa0/1','Fa0/2','Fa0/3','Fa0/4','Fa0/5','Fa0/6'] },

  // Dispositivos finais
  pc:            { label:'PC', icon:'🖥️', color:'#9aa0aa', shape:'rect', interfaces:['Fa0'] },
  laptop:        { label:'Notebook', icon:'💻', color:'#9aa0aa', shape:'rect', interfaces:['Wireless0','Fa0'] },
  tablet:        { label:'Tablet', icon:'📱', color:'#8fa0d0', shape:'circle', interfaces:['Wireless0'] },
  smartphone:    { label:'Smartphone', icon:'📱', color:'#e06080', shape:'circle', interfaces:['Wireless0'] },
  server:        { label:'Servidor', icon:'🗄️', color:'#c090d0', shape:'rect', interfaces:['Fa0','Fa1'] },
  printer:       { label:'Impressora', icon:'🖨', color:'#a0a0a0', shape:'rect', interfaces:['Fa0','Wireless0'] },
  ipphone:       { label:'Telefone IP', icon:'☎️', color:'#b0a070', shape:'rect', interfaces:['Fa0','PC'] },
  tv:            { label:'TV', icon:'📺', color:'#7777aa', shape:'rect', interfaces:['Fa0','Wireless0'] },

  // Wireless
  ap:            { label:'Access Point', icon:'📡', color:'#f0a500', shape:'circle', interfaces:['Fa0','Wireless0','Wireless1'] },
  wap:           { label:'AP Wireless', icon:'📶', color:'#f0a500', shape:'circle', interfaces:['Fa0','Wireless0'] },
  wirelessRouter:{ label:'Roteador Wi‑Fi', icon:'📶', color:'#e0a000', shape:'rect', interfaces:['Internet','Fa0/1','Fa0/2','Fa0/3','Fa0/4','Wireless0'] },
  wlc:           { label:'Controladora WLC', icon:'📡', color:'#d09000', shape:'rect', interfaces:['Gi0','Gi1','Management'] },

  // WAN / Segurança
  cloud:         { label:'Cloud', icon:'☁️', color:'#5080b0', shape:'cloud', interfaces:['Se0','Se1','Fa0','Fa1'] },
  internet:      { label:'Internet', icon:'🌐', color:'#4070a0', shape:'cloud', interfaces:['Fa0','Fa1','Se0'] },
  modem:         { label:'Modem DSL/Cable', icon:'📟', color:'#80a080', shape:'rect', interfaces:['DSL0','Cable0','Fa0'] },
  firewall:      { label:'Firewall ASA', icon:'🛡️', color:'#e05050', shape:'rect', interfaces:['Gi0/0 (outside)','Gi0/1 (inside)','Gi0/2 (dmz)'] },
  asa:           { label:'ASA 5505', icon:'🛡️', color:'#e05050', shape:'rect', interfaces:['Eth0/0','Eth0/1','Eth0/2','Eth0/3','Eth0/4','Eth0/5'] },

  // IoT / Smart Home
  homeGateway:   { label:'Home Gateway', icon:'🏠', color:'#80b080', shape:'rect', interfaces:['Internet','LAN1','LAN2','Wireless0'] },
  camera:        { label:'Câmera IP', icon:'📷', color:'#708090', shape:'circle', interfaces:['Fa0','Wireless0'] },
  webcam:        { label:'Webcam', icon:'🎥', color:'#708090', shape:'circle', interfaces:['Wireless0'] },
  sensor:        { label:'Sensor', icon:'🌡️', color:'#80b080', shape:'circle', interfaces:['Wireless0'] },
  smokeDetector: { label:'Detector Fumaça', icon:'🚨', color:'#d08040', shape:'circle', interfaces:['Wireless0'] },
  motionSensor:  { label:'Sensor Movimento', icon:'👁️', color:'#80b080', shape:'circle', interfaces:['Wireless0'] },
  smartLight:    { label:'Lâmpada Smart', icon:'💡', color:'#f5d020', shape:'circle', interfaces:['Wireless0'] },
  fan:           { label:'Ventilador', icon:'🌀', color:'#70a0c0', shape:'circle', interfaces:['Wireless0'] },
  door:          { label:'Porta Smart', icon:'🚪', color:'#b08050', shape:'rect', interfaces:['Wireless0'] },
  siren:         { label:'Sirene', icon:'🔊', color:'#e06060', shape:'circle', interfaces:['Wireless0'] },
  thermostat:    { label:'Termostato', icon:'🌡️', color:'#80b080', shape:'rect', interfaces:['Wireless0'] },
  mcu:           { label:'MCU', icon:'🔧', color:'#9090d0', shape:'rect', interfaces:['D0','D1','D2','A0','A1','Wireless0'] },
  sbc:           { label:'SBC', icon:'🧩', color:'#9090d0', shape:'rect', interfaces:['Eth0','USB0','GPIO0','GPIO1','Wireless0'] },

  // Industrial / energia
  plc:           { label:'PLC', icon:'🏭', color:'#a08060', shape:'rect', interfaces:['Eth0','Serial0','I/O0','I/O1'] },
  actuator:      { label:'Atuador', icon:'⚙️', color:'#909090', shape:'circle', interfaces:['Wireless0','I/O0'] },
  meter:         { label:'Medidor Energia', icon:'⚡', color:'#e0c050', shape:'rect', interfaces:['Fa0','Wireless0'] }
};

Object.keys(DEVICE_META).forEach(k => { if (nodeCounter[k] === undefined) nodeCounter[k] = 0; });

const DEVICE_PREFIX = {
  router:'R', router2901:'R2901', router2911:'R2911', router4321:'R4321', router4331:'R4331', router3layer:'RL3',
  switch:'SW2960', switch2950:'SW2950', switch3560:'SW3560', switch3650:'SW3650', switch3layer:'SWL3', bridge:'BR', hub:'HUB',
  pc:'PC', laptop:'NB', tablet:'TAB', smartphone:'PHONE', server:'SRV', printer:'PRT', ipphone:'IPPHONE', tv:'TV',
  ap:'AP', wap:'WAP', wirelessRouter:'WIFI', wlc:'WLC', cloud:'CLOUD', internet:'NET', modem:'MODEM', firewall:'FW', asa:'ASA',
  homeGateway:'HOME', camera:'CAM', webcam:'WEBCAM', sensor:'SENS', smokeDetector:'SMOKE', motionSensor:'MOTION', smartLight:'LIGHT', fan:'FAN', door:'DOOR', siren:'SIREN', thermostat:'THERMO', mcu:'MCU', sbc:'SBC',
  plc:'PLC', actuator:'ACT', meter:'METER'
};


// ══════════════════════════════════════════
//  CAMADA 2/3 BÁSICA: MAC, ARP, ICMP, DHCP, DNS
// ══════════════════════════════════════════
function makeMac(seed = '') {
  let h = 0;
  String(seed || (Date.now()+Math.random())).split('').forEach(ch => { h = ((h << 5) - h + ch.charCodeAt(0)) >>> 0; });
  const bytes = [0x02, (h>>24)&255, (h>>16)&255, (h>>8)&255, h&255, Math.floor(Math.random()*255)];
  return bytes.map(b => b.toString(16).padStart(2,'0')).join(':').toUpperCase();
}

function arpLearn(a, b) {
  if (!a || !b || !a.ip || !b.ip) return;
  a.arp = a.arp || [];
  const old = a.arp.find(x => x.ip === b.ip);
  if (old) { old.mac = b.mac; old.age = 0; return; }
  a.arp.push({ ip: b.ip, mac: b.mac || makeMac(b.id), age: 0 });
}

function learnMacAlongPath(path) {
  if (!path || path.length < 2) return;
  for (let i = 1; i < path.length - 1; i++) {
    const sw = path[i];
    if (!isSwitchNode(sw)) continue;
    sw.macTable = sw.macTable || [];
    const prev = path[i-1], next = path[i+1];
    const lkPrev = getLinkBetween(prev.id, sw.id);
    const lkNext = getLinkBetween(sw.id, next.id);
    const inPort = lkPrev ? ifaceNameOnNode(lkPrev, sw.id) : '?';
    const outPort = lkNext ? ifaceNameOnNode(lkNext, sw.id) : '?';
    const vlanIn = lkPrev ? (vlanAtSwitchPort(sw, prev.id, lkPrev) || 1) : 1;
    const vlanOut = lkNext ? (vlanAtSwitchPort(sw, next.id, lkNext) || 1) : 1;
    upsertMac(sw, prev.mac, inPort, vlanIn, 'DYNAMIC');
    upsertMac(sw, next.mac, outPort, vlanOut, 'DYNAMIC');
  }
}

function upsertMac(sw, mac, port, vlan = 1, type = 'DYNAMIC') {
  if (!sw || !mac) return;
  sw.macTable = sw.macTable || [];
  const hit = sw.macTable.find(x => x.mac === mac && x.vlan === vlan);
  if (hit) { hit.port = port; hit.age = 0; hit.type = type; return; }
  sw.macTable.push({ vlan, mac, type, port, age: 0 });
}

function findReachableService(src, serviceName) {
  return nodes.find(nd => nd.active !== false && nd.services && nd.services[serviceName] && nd.id !== src.id && isReachable(src, nd));
}

function nextDhcpIp(server) {
  server.dhcpPool = server.dhcpPool || { network:'192.168.1.0', mask:'255.255.255.0', gateway:server.ip || '192.168.1.1', dns:server.ip || '192.168.1.10', start:100, end:199, leases:{} };
  const pool = server.dhcpPool;
  pool.leases = pool.leases || {};
  const prefix = pool.network.split('.').slice(0,3).join('.');
  for (let i = Number(pool.start)||100; i <= (Number(pool.end)||199); i++) {
    const ip = `${prefix}.${i}`;
    if (!Object.values(pool.leases).includes(ip) && !nodes.some(n => n.ip === ip)) return ip;
  }
  return null;
}

function requestDhcp(client) {
  const server = findReachableService(client, 'dhcp');
  if (!server) { cliLog('err','DHCP falhou: nenhum servidor DHCP ativo e alcançável.'); return; }
  const ip = nextDhcpIp(server);
  if (!ip) { cliLog('err','DHCP falhou: pool sem endereços livres.'); return; }
  server.dhcpPool.leases[client.mac] = ip;
  applyIpToNode(client, ip, server.dhcpPool.mask || '255.255.255.0', { silent:true });
  client.gateway = server.dhcpPool.gateway || server.ip || '';
  client.dns = server.dhcpPool.dns || server.ip || '';
  arpLearn(client, server); arpLearn(server, client);
  learnMacAlongPath(findPath(client, server));
  cliLog('ok',`DHCP ACK: ${client.name} recebeu ${ip}/${maskToPrefix(client.mask)} gateway ${client.gateway || '-'} DNS ${client.dns || '-'}`);
}

function resolveNameForNode(client, name) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) return name;
  const server = findReachableService(client, 'dns');
  if (!server) return null;
  server.dnsRecords = server.dnsRecords || { 'server.local': server.ip || '192.168.1.10', 'www.local': server.ip || '192.168.1.10' };
  return server.dnsRecords[name.toLowerCase()] || null;
}

function showDhcpBindings(n) {
  if (!n.services?.dhcp || !n.dhcpPool) { cliLog('warn','Este dispositivo não possui DHCP ativo.'); return; }
  cliLog('ok','IP address        Client-ID/MAC            Type');
  Object.entries(n.dhcpPool.leases || {}).forEach(([mac, ip]) => cliLog('ok',`${ip.padEnd(17)} ${mac.padEnd(24)} automatic`));
}

function showDnsRecords(n) {
  if (!n.services?.dns) { cliLog('warn','Este dispositivo não possui DNS ativo.'); return; }
  n.dnsRecords = n.dnsRecords || { 'server.local': n.ip || '192.168.1.10', 'www.local': n.ip || '192.168.1.10' };
  cliLog('ok','Name                         Address');
  Object.entries(n.dnsRecords).forEach(([name, ip]) => cliLog('ok',`${name.padEnd(28)} ${ip}`));
}

function isSwitchNode(n) {
  return n && ['switch','switch2950','switch3560','switch3650','switch3layer','bridge'].includes(n.type);
}

function ensureNodeDefaults(n) {
  if (!n || n.type === 'note') return;
  if (!n.mac) n.mac = makeMac(n.id || n.name || n.type);
  if (!n.arp) n.arp = [];
  if (isSwitchNode(n) && !n.macTable) n.macTable = [];
  if (!n.cli) n.cli = { mode: 'user', iface: null };
  if (!['user', 'privileged', 'config', 'interface'].includes(n.cli.mode)) n.cli.mode = 'user';
  if (isSwitchNode(n)) {
    if (!n.vlans || typeof n.vlans !== 'object') n.vlans = { 1: { name: 'default' } };
    if (!n.vlans[1]) n.vlans[1] = { name: 'default' };
  }
  if (['server','pc','laptop','tablet','smartphone','printer','ipphone','tv'].includes(n.type) && !n.services) {
    n.services = { http:false, dns:false, dhcp:false };
    if (n.type === 'server') {
      n.dnsRecords = n.dnsRecords || { 'server.local': n.ip || '', 'www.local': n.ip || '' };
      n.dhcpPool = n.dhcpPool || { network:'192.168.1.0', mask:'255.255.255.0', gateway:'192.168.1.1', dns:n.ip || '', start:100, end:199, leases:{} };
    }
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
let deskModalNodeId = null;
let deskActiveTab = 'config';

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
  setTimeout(() => netBotSpeak('👋 Olá! Eu sou o NetBot. Adicione um dispositivo ou conecte cabos que eu vou explicar o que está acontecendo.', 'happy'), 700);
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
    g.addEventListener('dblclick', e => nodeDblClick(e, n.id));
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
  const prefix = DEVICE_PREFIX[type] || type.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'DEV';
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
  if (['server','pc','laptop','tablet','smartphone','printer','ipphone','tv'].includes(type)) {
    n.services = { http:false, dns:false, dhcp:false };
    if (n.type === 'server') {
      n.dnsRecords = n.dnsRecords || { 'server.local': n.ip || '', 'www.local': n.ip || '' };
      n.dhcpPool = n.dhcpPool || { network:'192.168.1.0', mask:'255.255.255.0', gateway:'192.168.1.1', dns:n.ip || '', start:100, end:199, leases:{} };
    }
  }
  pushUndo();
  nodes.push(n);
  ensureNodeDefaults(n);
  render();
  updateStatusBar();
  select(id);
  netBotOnDeviceAdded(n);
  return id;
}

function autoIP(type, n) {
  if (['cloud','internet','modem'].includes(type)) return '';
  const base = {
    router:'10.0', router2901:'10.0', router2911:'10.0', router4321:'10.0', router4331:'10.0', router3layer:'10.1',
    switch:'', switch2950:'', switch3560:'', switch3650:'', switch3layer:'', bridge:'', hub:'',
    pc:'192.168.1', laptop:'192.168.1', tablet:'192.168.1', smartphone:'192.168.1', server:'192.168.2', printer:'192.168.3', ipphone:'192.168.4', tv:'192.168.5',
    ap:'192.168.0', wap:'192.168.0', wirelessRouter:'192.168.0', wlc:'192.168.0', firewall:'172.16.0', asa:'172.16.0',
    homeGateway:'192.168.0', camera:'192.168.10', webcam:'192.168.10', sensor:'192.168.20', smokeDetector:'192.168.20', motionSensor:'192.168.20', smartLight:'192.168.20', fan:'192.168.20', door:'192.168.20', siren:'192.168.20', thermostat:'192.168.20', mcu:'192.168.30', sbc:'192.168.30', plc:'10.10.0', actuator:'10.10.1', meter:'10.10.2'
  };
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
  netBotOnLinkAdded(a, b, cableLabel);
  render();
  updateStatusBar();
  if (selected) showProperties(getNode(selected));
}

function getLinkType(src, dst) {
  const a = getNode(src), b = getNode(dst);
  const wireless = ['ap','wap','wirelessRouter','homeGateway','smartphone','tablet','laptop','printer','camera','webcam','sensor','smokeDetector','motionSensor','smartLight','fan','door','siren','thermostat','mcu','sbc','meter'];
  if (wireless.includes(a?.type) || wireless.includes(b?.type)) return 'wireless';
  const serial = ['router','router2901','router2911','router4321','router4331','router3layer','modem','cloud','internet'];
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
function nodeDblClick(e, id) {
  e.preventDefault();
  e.stopPropagation();
  const n = getNode(id);
  if (!n || n.type === 'note') return;
  if (!DEVICE_META[n.type]) return;
  if (mode === 'connect') {
    connectSource = null;
    closeModal('link-modal');
    pendingLinkPair = null;
  }
  openDeviceDesk(id);
}

function nodeMouseDown(e, id) {
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
function appendCliLine(out, type, msg) {
  if (!out) return;
  const classes = { ok:'cli-ok', err:'cli-err', info:'cli-info', warn:'cli-warn', '':'cli-cmd' };
  const div = document.createElement('div');
  div.className = 'cli-line ' + (classes[type]||'');
  div.innerHTML = msg;
  out.appendChild(div);
  out.scrollTop = out.scrollHeight;
}

function cliLog(type, msg) {
  const mainOut = document.getElementById('cli-output');
  if (currentCliTab === 'terminal' || currentCliTab === 'events') {
    appendCliLine(mainOut, type, msg);
  }
  const deskModal = document.getElementById('device-desk-modal');
  const deskOut = document.getElementById('desk-cli-output');
  if (deskModal?.classList.contains('open') && deskOut) {
    appendCliLine(deskOut, type, msg);
  }
}

function updateCliPrompt(n) {
  document.getElementById('cli-prompt-label').textContent = cliPromptString(n);
  const dp = document.getElementById('desk-cli-prompt');
  if (dp && n && deskModalNodeId && n.id === deskModalNodeId) {
    dp.textContent = cliPromptString(n);
  }
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

const CLI_COMMANDS = ['help','ping','traceroute','show ip','show arp','show version','show interfaces','show vlan brief','show mac address-table','show dhcp binding','show dns','ipconfig /dhcp','dhcp','nslookup','dns record','show spanning-tree','show netsim-parity','show running-config','enable','disable','configure terminal','interface','vlan','hostname','ip address','ip route','no ip route','shutdown','no shutdown','switchport mode access','switchport mode trunk','switchport access vlan','description','clear','exit','end','write memory','copy running-config startup-config','do '];

function autocomplete(input) {
  const val = input.value.toLowerCase();
  const match = CLI_COMMANDS.find(c => c.startsWith(val) && c !== val);
  if (match) input.value = match;
}

function showPtRoadmap() {
  cliLog('info','══ NetSim vs Cisco Packet Tracer ══');
  cliLog('warn','Este projeto não pode reproduzir “todas” as funções do Packet Tracer — o PT é um simulador proprietário completo.');
  cliLog('','<b>Já há neste NetSim (parcial)</b>: topologia; links por porta física; IOS-lite (<b>enable</b>, <b>conf t</b>, <b>interface</b>); VLAN access em switches; ARP; ICMP/ping; DHCP básico; DNS básico; tabela MAC dinâmica; verificação de VLAN no caminho do ping/traceroute; <b>shutdown</b> por interface.');
  cliLog('','<b>Não disponível aqui</b> (exemplos): PDU modo simulação camada-a-camada avançado; STP / EtherChannel; OSPF/EIGRP/BGP; WLAN avançado; HTTP completo como no PT; NAT/stateful firewall; modo físico e cabos; multiusuário.');
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
    cliLog('','  <b>ipconfig /dhcp</b> ou <b>dhcp</b> — solicita IP ao servidor DHCP');
    cliLog('','  <b>nslookup nome</b> — consulta DNS');
    cliLog('','  <b>show ip | arp | interfaces | vlan brief | running-config</b>');
    cliLog('','  <b>show netsim-parity</b> — Limitações vs Packet Tracer');
    cliLog('','  Switch: <b>vlan ID</b>, <b>switchport access vlan</b>, <b>switchport mode trunk</b>');
    cliLog('','  <b>hostname</b>, <b>ip route</b>, <b>shutdown</b> em interface ou dispositivo (privilegiado)');
    cliLog('','  <b>clear</b>, <b>write memory</b>');
    return;
  }
  if (lc === 'clear') {
    document.getElementById('cli-output').innerHTML = '';
    const dmo = document.getElementById('desk-cli-output');
    if (document.getElementById('device-desk-modal')?.classList.contains('open') && dmo) dmo.innerHTML = '';
    return;
  }
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

  if ((lc === 'ipconfig /dhcp' || lc === 'dhcp' || lc === 'renew dhcp') && pingTracerouteOk()) {
    requestDhcp(n);
    return;
  }
  if ((lc.startsWith('nslookup ') || lc.startsWith('dns lookup ')) && pingTracerouteOk()) {
    const name = raw.split(/\s+/).slice(lc.startsWith('dns lookup ') ? 2 : 1).join(' ').trim().toLowerCase();
    if (!name) { cliLog('err','Uso: nslookup [nome]'); return; }
    const ip = resolveNameForNode(n, name);
    if (ip) cliLog('ok',`Servidor DNS respondeu: ${name} = ${ip}`);
    else cliLog('err',`DNS falhou: nome não encontrado ou servidor DNS inalcançável (${name}).`);
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


  const dnsRec = raw.match(/^dns\s+record\s+(\S+)\s+(\d+\.\d+\.\d+\.\d+)$/i);
  if (dnsRec && st.mode === 'config') {
    n.services = n.services || { http:false, dns:false, dhcp:false };
    n.services.dns = true;
    n.dnsRecords = n.dnsRecords || {};
    n.dnsRecords[dnsRec[1].toLowerCase()] = dnsRec[2];
    cliLog('ok',`DNS: ${dnsRec[1].toLowerCase()} → ${dnsRec[2]}`);
    return;
  }

  const dhcpPool = raw.match(/^dhcp\s+pool\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+)\s+(\d+)$/i);
  if (dhcpPool && st.mode === 'config') {
    n.services = n.services || { http:false, dns:false, dhcp:false };
    n.services.dhcp = true;
    n.dhcpPool = { network:dhcpPool[1], mask:dhcpPool[2], gateway:dhcpPool[3], dns:dhcpPool[4], start:Number(dhcpPool[5]), end:Number(dhcpPool[6]), leases:{} };
    cliLog('ok',`DHCP pool ativo: ${dhcpPool[1]}/${maskToPrefix(dhcpPool[2])} .${dhcpPool[5]}-.${dhcpPool[6]}`);
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
    n.macTable = n.macTable || [];
    if (!n.macTable.length) { cliLog('warn','Tabela MAC vazia. Execute ping/DHCP entre hosts passando por este switch.'); return; }
    cliLog('ok','          Mac Address Table');
    cliLog('','Vlan    Mac Address       Type        Ports');
    n.macTable.forEach(e => cliLog('ok',`${String(e.vlan).padEnd(7)} ${String(e.mac).padEnd(17)} ${String(e.type||'DYNAMIC').padEnd(11)} ${e.port}`));
    return;
  }
  if (lc === 'show dhcp binding' && canShow) { showDhcpBindings(n); return; }
  if (lc === 'show dns' && canShow) { showDnsRecords(n); return; }

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
    if (n.services?.dns && n.dnsRecords) Object.entries(n.dnsRecords).forEach(([name, ip]) => cliLog('', 'dns record '+name+' '+ip));
    if (n.services?.dhcp && n.dhcpPool) cliLog('', `dhcp pool ${n.dhcpPool.network} ${n.dhcpPool.mask} ${n.dhcpPool.gateway} ${n.dhcpPool.dns} ${n.dhcpPool.start} ${n.dhcpPool.end}`);
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
  if (!dst) { cliLog('err','Uso: ping [ip ou nome DNS]'); return; }
  const originalDst = dst;
  const resolved = resolveNameForNode(n, dst);
  if (resolved) {
    cliLog('info',`DNS: ${originalDst} resolvido para ${resolved}`);
    dst = resolved;
  } else if (!/^\d+\.\d+\.\d+\.\d+$/.test(dst)) {
    cliLog('err',`DNS falhou: não foi possível resolver ${originalDst}.`);
    return;
  }
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
  if (reachable && target) {
    arpLearn(n, target); arpLearn(target, n);
    learnMacAlongPath(findPath(n, target));
    showProperties(n);
  }
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
//  DISPOSITIVO — janela estilo Packet Tracer
// ══════════════════════════════════════════

function escDesk(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function escDeskAttr(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function refreshDeskAllPanels(n) {
  if (!n || deskModalNodeId !== n.id) return;
  refreshDeskConfig(n);
  refreshDeskRoutes(n);
  refreshDeskArp(n);
  refreshDeskPhysical(n);
  refreshDeskServices(n);
}

function refreshDeskConfig(n) {
  ensureNodeDefaults(n);
  const el = document.getElementById('desk-panel-config');
  if (!el) return;
  const m = DEVICE_META[n.type];
  const showHostTcp = m && !['cloud','internet','switch','switch3layer'].includes(n.type);

  let html = '';

  const hasConflict = !!(n.ip && nodes.filter(nd => nd.ip === n.ip && nd.id !== n.id && nd.type !== 'note').length);
  if (n.ipConflict || hasConflict) {
    html += `<div class="desk-warn-banner">⚠ <b>Conflito de IP</b> — Este endereço está duplicado; tráfego pode falhar.</div>`;
  }

  html += `<div class="desk-section-title">Identificação</div>
    <div class="desk-prop-row"><span class="desk-prop-label">Nome</span><input class="desk-input" id="desk-gui-name" type="text" value="${escDeskAttr(n.name)}"></div>
    <div class="desk-prop-row desk-prop-checkbox"><label><input type="checkbox" id="desk-gui-active" ${n.active !== false ? 'checked' : ''}> Dispositivo ativo</label></div>`;

  if (showHostTcp) {
    html += `<div class="desk-section-title">TCP/IP (host)</div>
      <div class="desk-prop-row"><span class="desk-prop-label">IP</span><input class="desk-input" id="desk-gui-host-ip" placeholder="192.168.1.10" value="${escDeskAttr(n.ip||'')}"></div>
      <div class="desk-prop-row"><span class="desk-prop-label">Máscara</span><input class="desk-input" id="desk-gui-host-mask" value="${escDeskAttr(n.mask||'255.255.255.0')}"></div>
      <div class="desk-prop-row"><span class="desk-prop-label">Gateway</span><input class="desk-input" id="desk-gui-host-gw" placeholder="192.168.1.254" value="${escDeskAttr(n.gateway||'')}"></div>`;
  }

  if (isSwitchNode(n) && n.vlans) {
    const ids = Object.keys(n.vlans).map(Number).filter(x => !isNaN(x)).sort((a,b)=>a-b);
    html += `<div class="desk-section-title">VLANs</div>`;
    if (ids.length) {
      html += `<table class="desk-table desk-vlan-table"><thead><tr><th>ID</th><th>Nome</th></tr></thead><tbody>`;
      ids.forEach(vid => {
        const vn = n.vlans[vid]?.name ?? '';
        html += `<tr><td>${vid}</td><td>${escDesk(vn)}</td></tr>`;
      });
      html += `</tbody></table>`;
    }
    html += `<div class="desk-inline-add">
      <span class="desk-prop-label">Nova VLAN ID</span>
      <input class="desk-input desk-input-sm" id="desk-new-vlan-id" type="number" min="1" max="4094" placeholder="10">
      <button type="button" class="btn btn-secondary desk-inline-btn" onclick="deskAddVlanGui()">Adicionar</button>
    </div>`;
  }

  html += `<div class="desk-section-title">Interfaces</div>`;
  (n.interfaces || []).forEach((iface, i) => {
    const admChk = iface.adminDown ? 'checked' : '';
    html += `<div class="desk-iface-card">
      <div class="desk-iface-title">${escDesk(iface.name)}</div>`;
    if (isSwitchNode(n)) {
      const mode = iface.switchportMode === 'trunk' ? 'trunk' : 'access';
      html += `<div class="desk-prop-row desk-prop-tight"><span class="desk-prop-label">Modo</span>
        <select class="desk-input" id="desk-gui-if-${i}-mode">
          <option value="access"${mode === 'access' ? ' selected' : ''}>access</option>
          <option value="trunk"${mode === 'trunk' ? ' selected' : ''}>trunk</option>
        </select></div>`;
      html += `<div class="desk-prop-row desk-prop-tight" id="desk-gui-if-${i}-vlan-row" style="display:${mode === 'access' ? 'flex' : 'none'}"><span class="desk-prop-label">VLAN access</span>
        <input class="desk-input desk-input-sm" id="desk-gui-if-${i}-vlan" type="number" min="1" max="4094" value="${iface.accessVlan ?? 1}"></div>`;
    }
    html += `<div class="desk-prop-row"><span class="desk-prop-label">IP</span><input class="desk-input" id="desk-gui-if-${i}-ip" placeholder="opcional / L3" value="${escDeskAttr(iface.ip||'')}"></div>
      <div class="desk-prop-row"><span class="desk-prop-label">Máscara</span><input class="desk-input" id="desk-gui-if-${i}-mask" value="${escDeskAttr(iface.mask||'255.255.255.0')}"></div>
      <div class="desk-prop-row"><span class="desk-prop-label">Descrição</span><input class="desk-input" id="desk-gui-if-${i}-desc" placeholder="—" value="${escDeskAttr(iface.description||'')}"></div>
      <div class="desk-prop-row desk-prop-checkbox"><label><input type="checkbox" id="desk-gui-if-${i}-down" ${admChk}> Shutdown administrativo</label></div>`;
    if (!isSwitchNode(n)) {
      html += `<div class="desk-iface-hint">${iface.status === 'up' ? '🟢 Up' : '🔴 Down'} (ligação física)</div>`;
    }
    html += `</div>`;
  });

  html += `<div class="desk-config-actions"><button type="button" class="btn btn-primary" onclick="applyDeskGuiConfig()">Aplicar configuração</button></div>`;
  el.innerHTML = html;

  if (isSwitchNode(n)) {
    (n.interfaces || []).forEach((iface, i) => {
      const sel = document.getElementById(`desk-gui-if-${i}-mode`);
      const row = document.getElementById(`desk-gui-if-${i}-vlan-row`);
      if (sel && row) {
        sel.onchange = () => { row.style.display = sel.value === 'access' ? 'flex' : 'none'; };
      }
    });
  }
}

function refreshDeskRoutes(n) {
  const el = document.getElementById('desk-panel-routes');
  if (!el) return;
  ensureNodeDefaults(n);
  let html = `<div class="desk-section-title">Rotas estáticas</div>`;
  if (n.routing?.length) {
    html += `<table class="desk-table"><thead><tr><th>Rede</th><th>Next-hop</th><th>Mét.</th><th></th></tr></thead><tbody>`;
    n.routing.forEach((r, idx) => {
      html += `<tr><td>${escDesk(r.network)}/${escDesk(String(r.prefix))}</td><td>${escDesk(r.nexthop)}</td><td>${escDesk(String(r.metric))}</td>` +
        `<td><button type="button" class="btn btn-secondary desk-row-btn" onclick="deskRemoveStaticRoute(${idx})">Remover</button></td></tr>`;
    });
    html += `</tbody></table>`;
  } else {
    html += `<p class="desk-muted">Nenhuma rota estática. Equivalente CLI: <code>ip route &lt;rede&gt; &lt;máscara&gt; &lt;nexthop&gt;</code></p>`;
  }
  html += `<div class="desk-inline-add desk-routes-add">
    <input class="desk-input" id="desk-rt-net" placeholder="rede">
    <input class="desk-input" id="desk-rt-mask" placeholder="máscara">
    <input class="desk-input" id="desk-rt-nh" placeholder="nexthop">
    <input class="desk-input desk-input-sm" id="desk-rt-met" placeholder="métrica" value="1">
    <button type="button" class="btn btn-primary desk-inline-btn" onclick="deskAddStaticRoute()">Adicionar</button>
  </div>`;
  el.innerHTML = html;
}

function refreshDeskArp(n) {
  const el = document.getElementById('desk-panel-arp');
  if (!el) return;
  let html = `<div class="desk-section-title">Tabela ARP</div>`;
  if (n.arp?.length) {
    html += `<table class="desk-table"><thead><tr><th>Endereço</th><th>MAC</th></tr></thead><tbody>`;
    n.arp.forEach(a => {
      html += `<tr><td>${escDesk(a.ip)}</td><td>${escDesk(a.mac)}</td></tr>`;
    });
    html += `</tbody></table>`;
  } else {
    html += `<p class="desk-muted">Vazia — execute pings para popular.</p>`;
  }
  el.innerHTML = html;
}

function refreshDeskPhysical(n) {
  const el = document.getElementById('desk-panel-physical');
  if (!el) return;
  ensureNodeDefaults(n);
  let html = `<div class="desk-section-title">Interfaces físicas</div>`;
  (n.interfaces || []).forEach(iface => {
    const adm = iface.adminDown ? ' · 🔒 Admin down' : '';
    html += `<div class="desk-phys-row"><span class="desk-phys-name">${escDesk(iface.name)}</span>
      <span class="desk-phys-st">${iface.status === 'up' ? '🟢 Up' : '🔴 Down'}${adm}</span></div>`;
  });
  const myLinks = links.filter(l => l.src === n.id || l.dst === n.id);
  if (myLinks.length) {
    html += `<div class="desk-section-title">Cabos (${myLinks.length})</div>`;
    myLinks.forEach(lk => {
      const peer = getNode(lk.src === n.id ? lk.dst : lk.src);
      const myIF = lk.src === n.id ? lk.srcIface : lk.dstIface;
      const ct = ({ ethernet:'Ethernet', crossover:'Crossover', fiber:'Fibra', serial:'Serial', wireless:'Wireless' })[lk.type] || lk.type;
      html += `<div class="desk-phys-row"><span>${escDesk(peer?.name || '?')} <span class="desk-muted-small">(${escDesk(ct)})</span></span>` +
        `<span class="desk-muted-small">porta ${escDesk(myIF || '?')}</span></div>`;
    });
  }
  el.innerHTML = html;
}

function refreshDeskServices(n) {
  const el = document.getElementById('desk-panel-services');
  if (!el) return;
  if (!['server','pc','laptop','tablet','smartphone','printer','ipphone','tv'].includes(n.type)) {
    el.innerHTML = `<p class="desk-muted">Sem serviços neste tipo de equipamento.</p>`;
    return;
  }
  ensureNodeDefaults(n);
  const s = n.services || { http:false, dns:false, dhcp:false };
  el.innerHTML = `
    <div class="desk-section-title">Serviços (marcações — simulação limitada)</div>
    <div class="desk-svc-grid">
      <label class="desk-svc-opt"><input type="checkbox" id="desk-svc-http" ${s.http ? 'checked' : ''}> HTTP</label>
      <label class="desk-svc-opt"><input type="checkbox" id="desk-svc-dns" ${s.dns ? 'checked' : ''}> DNS</label>
      <label class="desk-svc-opt"><input type="checkbox" id="desk-svc-dhcp" ${s.dhcp ? 'checked' : ''}> DHCP</label>
    </div>
    <button type="button" class="btn btn-primary desk-svc-btn" onclick="applyDeskServices()">Aplicar serviços</button>
  `;
}

function openDeviceDesk(id) {
  const n = getNode(id);
  if (!n || n.type === 'note' || !DEVICE_META[n.type]) return;
  deskModalNodeId = id;
  deskActiveTab = 'config';
  select(id);
  ensureNodeDefaults(n);
  const m = DEVICE_META[n.type];
  document.getElementById('desk-device-icon').textContent = m.icon;
  document.getElementById('desk-device-title').textContent = n.name;
  document.getElementById('desk-device-sub').textContent = `${m.label} · ${n.type}`;

  const showRt = ['router','router2901','router2911','router4321','router4331','router3layer','switch3560','switch3650','switch3layer','firewall','asa'].includes(n.type);
  document.getElementById('desk-tab-routes').classList.toggle('desk-tab-hide', !showRt);

  const showSvc = ['server','pc','laptop'].includes(n.type);
  document.getElementById('desk-tab-services').classList.toggle('desk-tab-hide', !showSvc);

  const dout = document.getElementById('desk-cli-output');
  if (dout) dout.innerHTML = '';
  const inp = document.getElementById('desk-cli-input');
  if (inp) inp.value = '';

  refreshDeskAllPanels(n);
  document.getElementById('desk-cli-prompt').textContent = cliPromptString(n);
  document.getElementById('device-desk-modal').classList.add('open');
  switchDeskTab('config');
}

function closeDeviceDesk() {
  deskModalNodeId = null;
  deskActiveTab = 'config';
  closeModal('device-desk-modal');
}

function switchDeskTab(tab) {
  deskActiveTab = tab;
  document.querySelectorAll('#device-desk-modal .desk-tab').forEach(t => {
    if (t.classList.contains('desk-tab-hide')) return;
    t.classList.toggle('active', (t.dataset.deskTab === tab));
  });
  document.querySelectorAll('#device-desk-modal .desk-panel').forEach(p => {
    p.style.display = p.dataset.deskPanel === tab ? 'block' : 'none';
  });
  const n = deskModalNodeId ? getNode(deskModalNodeId) : null;
  if (tab === 'cli' && n) {
    document.getElementById('desk-cli-prompt').textContent = cliPromptString(n);
    setTimeout(() => document.getElementById('desk-cli-input')?.focus(), 80);
  }
}

function deskAddVlanGui() {
  const n = getNode(deskModalNodeId);
  const raw = document.getElementById('desk-new-vlan-id')?.value;
  const vid = parseInt(raw, 10);
  if (!n || !isSwitchNode(n) || isNaN(vid) || vid < 1 || vid > 4094) return;
  pushUndo();
  if (!n.vlans) n.vlans = { 1: { name: 'default' } };
  if (!n.vlans[vid]) n.vlans[vid] = { name: 'VLAN' + String(vid).padStart(4, '0') };
  document.getElementById('desk-new-vlan-id').value = '';
  render();
  refreshDeskAllPanels(getNode(deskModalNodeId));
}

function deskAddStaticRoute() {
  const n = getNode(deskModalNodeId);
  const net = document.getElementById('desk-rt-net')?.value.trim();
  const mask = document.getElementById('desk-rt-mask')?.value.trim();
  const nh = document.getElementById('desk-rt-nh')?.value.trim();
  const metric = document.getElementById('desk-rt-met')?.value.trim() || '1';
  if (!n || !net || !mask || !nh) return;
  pushUndo();
  if (!n.routing) n.routing = [];
  n.routing.push({ network: net, mask, nexthop: nh, metric, prefix: maskToPrefix(mask) });
  document.getElementById('desk-rt-net').value = '';
  document.getElementById('desk-rt-mask').value = '';
  document.getElementById('desk-rt-nh').value = '';
  document.getElementById('desk-rt-met').value = '1';
  render(); showProperties(n);
  refreshDeskAllPanels(n);
}

function deskRemoveStaticRoute(idx) {
  const n = getNode(deskModalNodeId);
  if (!n?.routing || idx < 0 || idx >= n.routing.length) return;
  pushUndo();
  n.routing.splice(idx, 1);
  render(); showProperties(n);
  refreshDeskAllPanels(n);
}

function applyDeskServices() {
  const n = getNode(deskModalNodeId);
  if (!n || !['server','pc','laptop'].includes(n.type)) return;
  pushUndo();
  ensureNodeDefaults(n);
  n.services = n.services || { http:false, dns:false, dhcp:false };
  n.services.http = !!document.getElementById('desk-svc-http')?.checked;
  n.services.dns = !!document.getElementById('desk-svc-dns')?.checked;
  n.services.dhcp = !!document.getElementById('desk-svc-dhcp')?.checked;
  render(); showProperties(n);
  refreshDeskServices(n);
}

function applyDeskGuiConfig() {
  const n = getNode(deskModalNodeId);
  if (!n) return;
  pushUndo();

  const nameEl = document.getElementById('desk-gui-name');
  if (nameEl?.value.trim()) n.name = nameEl.value.trim();

  const actEl = document.getElementById('desk-gui-active');
  if (actEl) n.active = actEl.checked;

  if (document.getElementById('desk-gui-host-ip')) {
    n.mask = document.getElementById('desk-gui-host-mask')?.value.trim() || '255.255.255.0';
    n.gateway = document.getElementById('desk-gui-host-gw')?.value.trim() || '';
    updateProp(n.id, 'ip', document.getElementById('desk-gui-host-ip').value.trim());
  }

  (n.interfaces || []).forEach((iface, i) => {
    const ipEl = document.getElementById(`desk-gui-if-${i}-ip`);
    if (ipEl) iface.ip = ipEl.value.trim();
    const mk = document.getElementById(`desk-gui-if-${i}-mask`);
    if (mk) iface.mask = mk.value.trim() || '255.255.255.0';
    const desc = document.getElementById(`desk-gui-if-${i}-desc`);
    if (desc) iface.description = desc.value.trim();
    const ad = document.getElementById(`desk-gui-if-${i}-down`);
    if (ad) iface.adminDown = !!ad.checked;
    const modeSel = document.getElementById(`desk-gui-if-${i}-mode`);
    if (modeSel && isSwitchNode(n)) {
      iface.switchportMode = modeSel.value === 'trunk' ? 'trunk' : 'access';
      if (iface.switchportMode === 'access') {
        const vEl = document.getElementById(`desk-gui-if-${i}-vlan`);
        const v = parseInt(vEl?.value, 10);
        if (!isNaN(v) && v >= 1 && v <= 4094) {
          iface.accessVlan = v;
          if (!n.vlans) n.vlans = { 1: { name: 'default' } };
          if (!n.vlans[v]) n.vlans[v] = { name: 'VLAN' + String(v).padStart(4, '0') };
        }
      }
    }
  });

  render();
  showProperties(getNode(deskModalNodeId));
  refreshDeskAllPanels(getNode(deskModalNodeId));
}

function deskCliKeyDown(e) {
  const input = document.getElementById('desk-cli-input');
  const n = getNode(deskModalNodeId);
  if (!n) return;

  if (e.key === 'Escape') {
    closeDeviceDesk();
    e.preventDefault();
    return;
  }

  if (e.key === 'Enter') {
    const cmd = input.value.trim();
    if (!cmd) return;
    cliHistory.unshift(cmd);
    cliHistIdx = -1;
    input.value = '';
    const prompt = cliPromptString(n);
    cliLog('', `<span class="cli-prompt">${escDesk(prompt)}</span> <span class="cli-cmd">${escDesk(cmd)}</span>`);
    processCommand(cmd, n);
    updateCliPrompt(n);
    refreshDeskAllPanels(getNode(deskModalNodeId));
    return;
  }
  if (e.key === 'ArrowUp') {
    cliHistIdx = Math.min(cliHistIdx + 1, cliHistory.length - 1);
    input.value = cliHistory[cliHistIdx] || '';
    e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    cliHistIdx = Math.max(cliHistIdx - 1, -1);
    input.value = cliHistIdx >= 0 ? cliHistory[cliHistIdx] : '';
    e.preventDefault();
  } else if (e.key === 'Tab') {
    e.preventDefault();
    autocomplete(input);
  }
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
        if (i===4) {
          out.innerHTML += `<br><span style="color:var(--accent)">Estatísticas: 4 enviados, ${reachable?4:0} recebidos, ${reachable?0:100}% perdidos</span>`;
          netBotOnPingResult(src, target, dst, reachable);
        }
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
  openDeviceDesk(ctxTarget);
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
  if (e.key === 'Escape') {
    if (document.getElementById('device-desk-modal')?.classList.contains('open')) {
      closeDeviceDesk();
      e.preventDefault();
      return;
    }
    if (document.getElementById('link-modal')?.classList.contains('open')) {
      cancelLinkModal();
      e.preventDefault();
      return;
    }
    if (document.getElementById('ping-modal')?.classList.contains('open')) {
      closeModal('ping-modal');
      e.preventDefault();
      return;
    }
    if (document.getElementById('help-modal')?.classList.contains('open')) {
      closeModal('help-modal');
      e.preventDefault();
      return;
    }
    setMode('select'); connectSource = null; render();
    return;
  }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 's' || e.key === 'S') setMode('select');
  else if (e.key === 'c' || e.key === 'C') setMode('connect');
  else if (e.key === 'x' || e.key === 'X') setMode('delete');
  else if (e.key === 'n' || e.key === 'N') addNote();
  else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
  else if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undoAction(); }
  else if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redoAction(); }
  else if (e.ctrlKey && e.key === 'a') { e.preventDefault(); selectAll(); }
  else if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveProject(); }
  else if (e.ctrlKey && e.key === 'n') { e.preventDefault(); newProject(); }
}

window.addEventListener('resize', render);
// ══════════════════════════════════════════
//  NETSIM PRO v4 — ENGINE AVANÇADA EDUCACIONAL
//  Packet engine, ARP completo, ICMP roteado, VLAN trunk,
//  routing estático/OSPF simplificado e modo simulação visual.
// ══════════════════════════════════════════
(function(){
  const ADV_VERSION = 'v4 Packet Engine';
  const oldProcessCommand = processCommand;
  const oldShowPtRoadmap = showPtRoadmap;

  function ipToInt(ip){ return String(ip||'').split('.').reduce((a,b)=>(a<<8)+(parseInt(b,10)||0),0)>>>0; }
  function intToIp(n){ return [24,16,8,0].map(s => (n>>>s)&255).join('.'); }
  function netOf(ip, mask){ return intToIp(ipToInt(ip) & ipToInt(mask||'255.255.255.0')); }
  function sameSubnet(a,b,mask){ return !!a && !!b && netOf(a,mask||'255.255.255.0') === netOf(b,mask||'255.255.255.0'); }
  function isRouterLike(n){ return n && ['router','router2901','router2911','router4321','router4331','router3layer','switch3560','switch3650','switch3layer','firewall','asa'].includes(n.type); }
  function connectedNetworks(n){
    const nets = [];
    if (n.ip && n.mask) nets.push({ network:netOf(n.ip,n.mask), mask:n.mask, prefix:maskToPrefix(n.mask), source:'C', via:'connected', iface:'host' });
    (n.interfaces||[]).forEach(iface=>{
      if (iface.ip) nets.push({ network:netOf(iface.ip, iface.mask||'255.255.255.0'), mask:iface.mask||'255.255.255.0', prefix:maskToPrefix(iface.mask||'255.255.255.0'), source:'C', via:'connected', iface:iface.name });
    });
    return nets;
  }
  function routeMatchesIp(route, ip){ return netOf(ip, route.mask||prefixToMask(route.prefix||24)) === route.network; }
  function prefixToMask(prefix){ let n = prefix===0 ? 0 : (0xffffffff << (32-prefix))>>>0; return intToIp(n); }
  function bestRoute(n, dstIp){
    const routes = [...connectedNetworks(n), ...(n.routing||[])];
    let best = null;
    routes.forEach(r=>{
      const rr = { ...r, mask:r.mask || prefixToMask(r.prefix||24), prefix:r.prefix || maskToPrefix(r.mask || '255.255.255.0') };
      if (routeMatchesIp(rr, dstIp) && (!best || rr.prefix > best.prefix)) best = rr;
    });
    return best;
  }
  function hostGatewayNode(host){
    if (!host.gateway) return null;
    return nodes.find(n => n.active !== false && (n.ip === host.gateway || (n.interfaces||[]).some(i=>i.ip===host.gateway)));
  }
  function l2Path(a,b){ const p = findPath(a,b); return (p.length && pathVlanOk(p)) ? p : []; }
  function findRoutedPath(src, dst){
    if (!src || !dst) return [];
    if (sameSubnet(src.ip, dst.ip, src.mask) || !src.gateway) return l2Path(src,dst);
    const gw = hostGatewayNode(src);
    if (!gw) return [];
    const first = l2Path(src, gw);
    if (!first.length) return [];
    if (sameSubnet(gw.ip, dst.ip, gw.mask) || connectedNetworks(gw).some(r=>routeMatchesIp(r,dst.ip))) {
      const last = l2Path(gw, dst);
      if (!last.length) return [];
      return first.concat(last.slice(1));
    }
    // Busca por roteadores que tenham rota até o destino. É uma aproximação educacional.
    const routerQueue = [[gw]];
    const seen = new Set();
    while (routerQueue.length) {
      const rpath = routerQueue.shift();
      const cur = rpath[rpath.length-1];
      if (seen.has(cur.id)) continue; seen.add(cur.id);
      if (bestRoute(cur, dst.ip)) {
        const tail = l2Path(cur, dst);
        if (tail.length) return first.concat(rpath.slice(1)).concat(tail.slice(1));
      }
      links.filter(l=> (l.src===cur.id||l.dst===cur.id) && linkOperational(l)).forEach(l=>{
        const nb = getNode(l.src===cur.id?l.dst:l.src);
        if (isRouterLike(nb) && !seen.has(nb.id)) routerQueue.push([...rpath, nb]);
      });
    }
    return [];
  }
  function vlanForHop(sw, prev, lk){
    const v = vlanAtSwitchPort(sw, prev.id, lk);
    return v === null ? 'trunk' : v;
  }
  function learnMacReal(path){
    if (!path || path.length < 2) return;
    for (let i=1; i<path.length-1; i++) {
      const sw = path[i];
      if (!isSwitchNode(sw)) continue;
      const prev = path[i-1], next = path[i+1];
      const inLink = getLinkBetween(prev.id, sw.id);
      const outLink = getLinkBetween(next.id, sw.id);
      if (inLink) upsertMac(sw, prev.mac, ifaceNameOnNode(inLink, sw.id), vlanForHop(sw, prev, inLink)==='trunk'?1:vlanForHop(sw, prev, inLink), 'DYNAMIC');
      if (outLink) upsertMac(sw, next.mac, ifaceNameOnNode(outLink, sw.id), vlanForHop(sw, next, outLink)==='trunk'?1:vlanForHop(sw, next, outLink), 'DYNAMIC');
    }
  }
  function newPdu(proto, src, dst, path, info){
    return { id:'pdu'+Date.now()+Math.random().toString(36).slice(2,5), proto, src:src.name, dst:dst.name, srcId:src.id, dstId:dst.id, path:(path||[]).map(n=>n.id), hop:0, info:info||{}, created:new Date().toLocaleTimeString() };
  }
  function enqueuePacket(proto, src, dst, path, info){
    const pdu = newPdu(proto, src, dst, path, info);
    simPduQueue.push(pdu);
    cliLog('info', `[SIM] ${proto} enfileirado: ${src.name} → ${dst.name} (${(path||[]).map(n=>n.name).join(' → ')})`);
    return pdu;
  }
  function enqueueArpExchange(src,dst,path){
    enqueuePacket('ARP Request', src, dst, path, { op:'who-has', targetIp:dst.ip, broadcast:true, osi:'L2 broadcast' });
    enqueuePacket('ARP Reply', dst, src, [...path].reverse(), { op:'is-at', targetIp:src.ip, mac:dst.mac, osi:'L2 unicast' });
  }
  function enqueueIcmpExchange(src,dst,path){
    enqueuePacket('ICMP Echo Request', src, dst, path, { type:8, code:0, ttl:64, osi:'L3 IP + ICMP' });
    enqueuePacket('ICMP Echo Reply', dst, src, [...path].reverse(), { type:0, code:0, ttl:64, osi:'L3 IP + ICMP' });
  }

  runPing = function(n, dst){
    if (!dst) { cliLog('err','Uso: ping [ip ou nome DNS]'); return; }
    const originalDst = dst;
    const resolved = resolveNameForNode(n, dst);
    if (resolved) { cliLog('info',`DNS: ${originalDst} resolvido para ${resolved}`); dst = resolved; }
    else if (!/^\d+\.\d+\.\d+\.\d+$/.test(dst)) { cliLog('err',`DNS falhou: não foi possível resolver ${originalDst}.`); return; }
    if (n.ipConflict) { cliLog('warn',`%IP-4-DUPADDR: ${n.name} possui conflito de IP (${n.ip}). Ping indisponível.`); return; }
    const targets = nodes.filter(nd => nd.ip === dst && nd.active !== false && nd.id !== n.id);
    if (targets.length !== 1) { cliLog('err', targets.length ? `%IP-4-DUPADDR: destino duplicado ${dst}` : `Destino ${dst} não encontrado.`); return; }
    const target = targets[0];
    const path = findRoutedPath(n, target);
    const reachable = path.length > 0 && pathVlanOk(path);
    cliLog('info',`Pingando ${dst} a partir de ${n.name}...`);
    if (reachable) {
      arpLearn(n,target); arpLearn(target,n); learnMacReal(path);
      if (simMode) { enqueueArpExchange(n,target,path); enqueueIcmpExchange(n,target,path); }
      showProperties(n);
    }
    for (let i=1;i<=4;i++) setTimeout(()=>{
      if (reachable) {
        const ms = Math.floor(Math.random()*18+1);
        cliLog('ok',`Resposta de ${dst}: bytes=32 tempo=${ms}ms TTL=${64-Math.max(0,path.filter(isRouterLike).length)}`);
        animatePingEnvelope(n,target,{ subtitle:'ICMP Echo' });
      } else cliLog('err',`Tempo limite esgotado: ${dst} inacessível (verifique VLAN/trunk/gateway/rotas).`);
      if (i===4) cliLog('info',`Estatísticas: 4 enviados, ${reachable?4:0} recebidos, ${reachable?0:100}% perdidos`);
    },180*i);
  };

  isReachable = function(src,dst){ const p = findRoutedPath(src,dst); return p.length > 0 && pathVlanOk(p); };

  runTraceroute = function(n,dst){
    const target = nodes.find(nd=>nd.ip===dst && nd.active!==false);
    if (!target) { cliLog('err','Destino não encontrado.'); return; }
    const path = findRoutedPath(n,target);
    if (!path.length) { cliLog('err','* * * Destino inacessível (gateway/rotas/VLAN)'); return; }
    cliLog('info',`Traceroute para ${dst}:`);
    path.forEach((hop,i)=>setTimeout(()=>cliLog('ok',`${String(i+1).padStart(2)}  ${(hop.ip||hop.name).padEnd(18)} ${Math.floor(Math.random()*16+1)} ms`),220*(i+1)));
  };

  runSimStep = function(){
    if (!simPduQueue.length) { cliLog('info','[SIM] Fila PDU vazia — ative Modo Simulação e execute um ping.'); return; }
    const pdu = simPduQueue[0];
    const pathNodes = (pdu.path||[]).map(getNode).filter(Boolean);
    if (!pathNodes.length) { simPduQueue.shift(); return; }
    const cur = pathNodes[pdu.hop];
    const next = pathNodes[pdu.hop+1];
    cliLog('info', `[SIM] ${pdu.proto} | OSI: ${pdu.info?.osi||'L2/L3'} | passo ${pdu.hop+1}/${pathNodes.length}`);
    cliLog('', `      ${cur?.name||'?'}${next ? ' → '+next.name : ' chegou ao destino'} ${pdu.info?.targetIp ? '| alvo '+pdu.info.targetIp : ''}`);
    if (cur && next) animatePingEnvelope(cur,next,{ subtitle:pdu.proto.replace('ICMP ','') });
    pdu.hop++;
    if (pdu.hop >= pathNodes.length-1) {
      cliLog('ok', `[SIM] ${pdu.proto} concluído: ${pdu.src} → ${pdu.dst}`);
      simPduQueue.shift();
    }
  };

  function runOspfCalculation(){
    const ospfRouters = nodes.filter(n=>isRouterLike(n) && n.ospf?.enabled && n.active!==false);
    ospfRouters.forEach(r=>{ r.ospf.neighbors = []; });
    for (let i=0;i<ospfRouters.length;i++) for (let j=i+1;j<ospfRouters.length;j++) {
      const a=ospfRouters[i], b=ospfRouters[j];
      const p=l2Path(a,b);
      if (p.length) { a.ospf.neighbors.push(b.name); b.ospf.neighbors.push(a.name); }
    }
    ospfRouters.forEach(r=>{
      const learned = [];
      ospfRouters.forEach(o=>{
        if (o.id===r.id) return;
        const path=l2Path(r,o);
        if (!path.length) return;
        connectedNetworks(o).forEach(cn=>{
          if (!connectedNetworks(r).some(x=>x.network===cn.network && x.mask===cn.mask)) {
            learned.push({ network:cn.network, mask:cn.mask, prefix:cn.prefix, nexthop:o.ip || (o.interfaces||[]).find(i=>i.ip)?.ip || o.name, metric:String(path.length), source:'O' });
          }
        });
      });
      r.routing = (r.routing||[]).filter(x=>x.source!=='O').concat(learned);
    });
  }

  function showIpRoute(n){
    runOspfCalculation();
    cliLog('ok','Codes: C - connected, S - static, O - OSPF');
    connectedNetworks(n).forEach(r=>cliLog('ok',`C    ${r.network}/${r.prefix} is directly connected, ${r.iface}`));
    (n.routing||[]).forEach(r=>cliLog('ok',`${(r.source||'S').padEnd(4)} ${r.network}/${r.prefix||maskToPrefix(r.mask)} [${r.metric||1}] via ${r.nexthop}`));
  }
  function showOspfNeighbor(n){
    runOspfCalculation();
    if (!n.ospf?.enabled) { cliLog('warn','OSPF não está ativo neste equipamento.'); return; }
    cliLog('ok','Neighbor ID        State      Interface');
    (n.ospf.neighbors||[]).forEach(nb=>cliLog('ok',`${nb.padEnd(18)} FULL/DR    auto`));
    if (!n.ospf.neighbors?.length) cliLog('warn','Nenhum vizinho OSPF encontrado.');
  }

  processCommand = function(cmd,n,execOverride=false){
    const raw = cmd.trim(); const lc = raw.toLowerCase();
    if (lc === 'show packet-engine' || lc === 'show simulation queue') {
      cliLog('info',`NetSim ${ADV_VERSION}`);
      cliLog('ok',`PDUs na fila: ${simPduQueue.length}`);
      simPduQueue.forEach((p,i)=>cliLog('',`${i+1}. ${p.proto} ${p.src} → ${p.dst} hop ${p.hop+1}/${p.path.length}`));
      return;
    }
    if (lc === 'show ip route' && n) { showIpRoute(n); return; }
    if (lc === 'show ip ospf neighbor' && n) { showOspfNeighbor(n); return; }
    if (lc === 'clear arp' && n) { n.arp=[]; cliLog('ok','Tabela ARP limpa.'); showProperties(n); return; }
    if (lc === 'clear mac address-table' && n && isSwitchNode(n)) { n.macTable=[]; cliLog('ok','Tabela MAC limpa.'); showProperties(n); return; }
    if (n) ensureNodeDefaults(n);
    if (n && (n.cli?.mode === 'config') && /^router\s+ospf\s+\d+/i.test(raw) && isRouterLike(n)) {
      const pid = raw.split(/\s+/)[2];
      n.ospf = n.ospf || {}; n.ospf.enabled = true; n.ospf.processId = pid; n.ospf.networks = n.ospf.networks || [];
      n.cli.mode = 'ospf'; updateCliPromptAdvanced(n); cliLog('ok',`OSPF processo ${pid} ativado.`); return;
    }
    if (n && n.cli?.mode === 'ospf') {
      if (/^network\s+/i.test(raw)) {
        const p=raw.split(/\s+/); n.ospf.networks.push({ network:p[1], wildcard:p[2]||'0.0.0.255', area:p[p.length-1]||'0' });
        runOspfCalculation(); cliLog('ok',`OSPF network ${p[1]} area ${p[p.length-1]||'0'} configurado.`); return;
      }
      if (lc==='exit') { n.cli.mode='config'; updateCliPrompt(n); return; }
      if (lc==='end') { n.cli.mode='privileged'; updateCliPrompt(n); return; }
    }
    oldProcessCommand(cmd,n,execOverride);
  };

  function updateCliPromptAdvanced(n){
    if (n?.cli?.mode === 'ospf') {
      const p = n.name + '(config-router)#';
      document.getElementById('cli-prompt-label').textContent = p;
      const dp = document.getElementById('desk-cli-prompt'); if (dp) dp.textContent = p;
    } else updateCliPrompt(n);
  }
  const oldCliPromptString = cliPromptString;
  cliPromptString = function(n){ return n?.cli?.mode === 'ospf' ? n.name+'(config-router)#' : oldCliPromptString(n); };

  showPtRoadmap = function(){
    oldShowPtRoadmap();
    cliLog('info','══ Avanços v4 adicionados ══');
    cliLog('ok','Engine de pacotes com fila PDU, ARP Request/Reply, ICMP Echo Request/Reply, MAC learning por caminho, VLAN access/trunk, roteamento por gateway/rotas e OSPF educacional.');
    cliLog('','Comandos: <b>show packet-engine</b>, <b>show simulation queue</b>, <b>show ip route</b>, <b>router ospf 1</b>, <b>network 192.168.1.0 0.0.0.255 area 0</b>, <b>show ip ospf neighbor</b>.');
  };

  const oldHelp = showHelp;
  if (typeof showHelp === 'function') {
    showHelp = function(){
      oldHelp();
      cliLog('info','v4: use <b>show packet-engine</b>, <b>show ip route</b>, <b>router ospf 1</b> e o Modo Simulação para ver ARP/ICMP passo a passo.');
    };
  }
})();

// ══════════════════════════════════════════
//  JANELAS / MODAIS DRAG AND DROP
// ══════════════════════════════════════════
function makeModalDraggable(overlayId, storageKey) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  const modal = overlay.querySelector('.modal');
  const header = overlay.querySelector('.modal-header');
  if (!modal || !header || modal.dataset.dragReady === '1') return;

  modal.dataset.dragReady = '1';
  overlay.classList.add('windowed-modal');
  modal.classList.add('draggable-modal');

  const key = storageKey || `netsim_window_pos_${overlayId}`;
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  function clamp(left, top) {
    const margin = 12;
    const rect = modal.getBoundingClientRect();
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    return {
      left: Math.min(Math.max(margin, left), maxLeft),
      top: Math.min(Math.max(margin, top), maxTop)
    };
  }

  function centerIfNeeded() {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      const pos = clamp(saved.left, saved.top);
      modal.style.left = pos.left + 'px';
      modal.style.top = pos.top + 'px';
      modal.style.transform = 'none';
      return;
    }
    const rect = modal.getBoundingClientRect();
    modal.style.left = Math.max(12, (window.innerWidth - rect.width) / 2) + 'px';
    modal.style.top = Math.max(12, (window.innerHeight - rect.height) / 2) + 'px';
    modal.style.transform = 'none';
  }

  const observer = new MutationObserver(() => {
    if (overlay.classList.contains('open')) requestAnimationFrame(centerIfNeeded);
  });
  observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });

  header.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.modal-close, button, input, select, textarea')) return;
    if (!overlay.classList.contains('open')) return;
    centerIfNeeded();
    dragging = true;
    modal.classList.add('dragging');
    const rect = modal.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    header.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });

  header.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const pos = clamp(e.clientX - offsetX, e.clientY - offsetY);
    modal.style.left = pos.left + 'px';
    modal.style.top = pos.top + 'px';
    modal.style.transform = 'none';
  });

  function stopDrag(e) {
    if (!dragging) return;
    dragging = false;
    modal.classList.remove('dragging');
    const rect = modal.getBoundingClientRect();
    localStorage.setItem(key, JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));
    try { header.releasePointerCapture?.(e.pointerId); } catch (_) {}
  }

  header.addEventListener('pointerup', stopDrag);
  header.addEventListener('pointercancel', stopDrag);

  header.addEventListener('dblclick', (e) => {
    if (e.target.closest('.modal-close, button, input, select, textarea')) return;
    localStorage.removeItem(key);
    centerIfNeeded();
  });

  window.addEventListener('resize', () => {
    if (!overlay.classList.contains('open')) return;
    const rect = modal.getBoundingClientRect();
    const pos = clamp(rect.left, rect.top);
    modal.style.left = pos.left + 'px';
    modal.style.top = pos.top + 'px';
  });
}

function initDraggableModals() {
  ['ping-modal', 'link-modal', 'desk-modal', 'help-modal'].forEach(id => makeModalDraggable(id));
}

document.addEventListener('DOMContentLoaded', initDraggableModals);
window.addEventListener('load', initDraggableModals);
