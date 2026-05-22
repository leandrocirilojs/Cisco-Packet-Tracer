// ══════════════════════════════════════════
//  PROFESSOR AI — GROQ
// ══════════════════════════════════════════
let aiProfessorHistory = [];

function toggleAiProfessor(force) {
  const panel = document.getElementById('ai-professor-panel');
  if (!panel) return;
  const open = typeof force === 'boolean' ? force : !panel.classList.contains('open');
  panel.classList.toggle('open', open);
  panel.setAttribute('aria-hidden', String(!open));
  if (open) {
    initAiProfessorDrag();
    loadGroqSettings();
    updateAiStatus();
    setTimeout(() => document.getElementById('ai-input')?.focus(), 150);
  }
}

function loadGroqSettings() {
  const keyEl = document.getElementById('groq-api-key');
  const modelEl = document.getElementById('groq-model');
  const proxyEl = document.getElementById('groq-proxy-url');
  if (keyEl) keyEl.value = localStorage.getItem('netsim_groq_key') || '';
  if (modelEl) modelEl.value = localStorage.getItem('netsim_groq_model') || 'llama-3.1-8b-instant';
  if (proxyEl) proxyEl.value = localStorage.getItem('netsim_groq_proxy') || '';
}

function saveGroqSettings() {
  const key = document.getElementById('groq-api-key')?.value.trim() || '';
  const model = document.getElementById('groq-model')?.value.trim() || 'llama-3.1-8b-instant';
  const proxy = document.getElementById('groq-proxy-url')?.value.trim() || '';
  if (key) localStorage.setItem('netsim_groq_key', key); else localStorage.removeItem('netsim_groq_key');
  localStorage.setItem('netsim_groq_model', model);
  if (proxy) localStorage.setItem('netsim_groq_proxy', proxy); else localStorage.removeItem('netsim_groq_proxy');
  updateAiStatus();
  addAiMessage('bot', 'Configuração salva. Agora posso responder usando a Groq.');
}

function clearGroqSettings() {
  localStorage.removeItem('netsim_groq_key');
  localStorage.removeItem('netsim_groq_model');
  localStorage.removeItem('netsim_groq_proxy');
  loadGroqSettings();
  updateAiStatus();
}

function updateAiStatus(text, state) {
  const el = document.getElementById('ai-status');
  if (!el) return;
  const hasKey = !!(localStorage.getItem('netsim_groq_key') || document.getElementById('groq-api-key')?.value.trim());
  const hasProxy = !!(localStorage.getItem('netsim_groq_proxy') || document.getElementById('groq-proxy-url')?.value.trim());
  el.className = 'ai-status' + (state ? ' ' + state : (hasKey || hasProxy ? ' ready' : ''));
  el.textContent = text || (hasProxy ? 'Groq via backend proxy pronta' : hasKey ? 'Groq pronta para ensinar' : 'Groq: configure sua chave para ativar');
}

function aiInputKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendProfessorMessage();
  }
}

function askProfessorQuick(text) {
  const input = document.getElementById('ai-input');
  if (input) input.value = text;
  sendProfessorMessage();
}

function addAiMessage(role, htmlText) {
  const chat = document.getElementById('ai-chat');
  if (!chat) return;
  const div = document.createElement('div');
  div.className = role === 'user' ? 'ai-msg ai-msg-user' : 'ai-msg ai-msg-bot';
  div.innerHTML = sanitizeAiHtml(formatAiText(htmlText));
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function formatAiText(text) {
  return String(text || '')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>');
}

function sanitizeAiHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  tmp.querySelectorAll('script,iframe,object,embed,link,style').forEach(x => x.remove());
  tmp.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(a => {
      if (/^on/i.test(a.name) || /javascript:/i.test(a.value)) el.removeAttribute(a.name);
    });
  });
  return tmp.innerHTML;
}

function ipToNumAi(ip) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(String(ip || ''))) return null;
  return String(ip).split('.').reduce((acc, oct) => (acc << 8) + (Number(oct) & 255), 0) >>> 0;
}

function maskToNumAi(mask) {
  return ipToNumAi(mask || '255.255.255.0');
}

function sameSubnetAi(ipA, maskA, ipB, maskB) {
  const a = ipToNumAi(ipA), b = ipToNumAi(ipB);
  const ma = maskToNumAi(maskA), mb = maskToNumAi(maskB || maskA);
  if (a === null || b === null || ma === null || mb === null) return false;
  const m = ma & mb;
  return (a & m) === (b & m);
}

function describeNodeForAi(n) {
  ensureNodeDefaults(n);
  return {
    id: n.id,
    nome: n.name,
    tipo: n.type,
    ip: n.ip || '',
    mascara: n.mask || '',
    gateway: n.gateway || '',
    mac: n.mac || '',
    ativo: n.active !== false,
    selecionado: selected === n.id,
    interfaces: (n.interfaces || []).map(i => ({
      nome: i.name,
      status: i.status || 'down',
      adminDown: !!i.adminDown,
      ip: i.ip || '',
      mascara: i.mask || '',
      modoSwitchport: i.switchportMode || '',
      vlanAccess: i.accessVlan ?? '',
      vlansPermitidas: i.allowedVlans || ''
    })),
    vlans: isSwitchNode(n) ? (n.vlans || { 1: { name: 'default' } }) : undefined,
    tabelaMac: isSwitchNode(n) ? (n.macTable || []) : undefined,
    tabelaArp: n.arp || [],
    rotas: n.routing || [],
    ospf: n.ospf || undefined,
    servicos: n.services || {},
    dhcpPool: n.dhcpPool || undefined,
    dnsRecords: n.dnsRecords || undefined
  };
}

function describeLinkForAi(l) {
  const a = getNode(l.src), b = getNode(l.dst);
  return {
    id: l.id,
    origem: a?.name || l.src,
    tipoOrigem: a?.type || '',
    portaOrigem: l.srcIface || '',
    destino: b?.name || l.dst,
    tipoDestino: b?.type || '',
    portaDestino: l.dstIface || '',
    cabo: l.cableType || l.type || 'ethernet',
    ativo: l.active !== false,
    operacional: linkOperational(l)
  };
}

function findTopologyIssuesForAi() {
  const issues = [];
  const deviceNodes = nodes.filter(n => n.type !== 'note');

  if (!deviceNodes.length) {
    issues.push({ severidade: 'info', categoria: 'topologia', mensagem: 'A topologia ainda não possui dispositivos.' });
    return issues;
  }

  if (!links.length) {
    issues.push({ severidade: 'aviso', categoria: 'conexões', mensagem: 'Nenhum cabo/link foi criado. Os dispositivos não conseguirão se comunicar.' });
  }

  const ipMap = new Map();
  deviceNodes.forEach(n => {
    ensureNodeDefaults(n);
    if (n.active === false) issues.push({ severidade: 'erro', categoria: 'dispositivo', dispositivo: n.name, mensagem: `${n.name} está desligado/inativo.` });
    if (n.ip) {
      if (!ipMap.has(n.ip)) ipMap.set(n.ip, []);
      ipMap.get(n.ip).push(n.name);
    }
    if (['pc','laptop','tablet','smartphone','server','printer','ipphone','tv'].includes(n.type)) {
      const hasConnection = links.some(l => l.active !== false && (l.src === n.id || l.dst === n.id));
      if (!hasConnection) issues.push({ severidade: 'aviso', categoria: 'conexão', dispositivo: n.name, mensagem: `${n.name} não possui link ativo.` });
      if (!n.ip) issues.push({ severidade: 'aviso', categoria: 'endereçamento', dispositivo: n.name, mensagem: `${n.name} não possui endereço IP.` });
      if (n.ip && n.gateway && !sameSubnetAi(n.ip, n.mask, n.gateway, n.mask)) {
        issues.push({ severidade: 'erro', categoria: 'gateway', dispositivo: n.name, mensagem: `Gateway ${n.gateway} parece estar fora da sub-rede de ${n.name} (${n.ip}/${maskToPrefix(n.mask || '255.255.255.0')}).` });
      }
    }
    (n.interfaces || []).forEach(i => {
      if (i.adminDown) issues.push({ severidade: 'aviso', categoria: 'interface', dispositivo: n.name, interface: i.name, mensagem: `Interface ${i.name} de ${n.name} está administrativamente desligada.` });
    });
  });

  ipMap.forEach((names, ip) => {
    if (names.length > 1) issues.push({ severidade: 'erro', categoria: 'ip duplicado', mensagem: `IP duplicado ${ip} em: ${names.join(', ')}.` });
  });

  links.forEach(l => {
    const a = getNode(l.src), b = getNode(l.dst);
    if (!a || !b) return;
    if (l.active === false || !linkOperational(l)) {
      issues.push({ severidade: 'erro', categoria: 'link', mensagem: `Link ${a.name} ↔ ${b.name} está inativo ou com interface down.` });
    }
    if ((l.cableType || l.type) === 'wireless') {
      const okWireless = ['ap','wap','wirelessRouter','wlc','tablet','smartphone','laptop','printer','tv','homeGateway','camera','webcam','sensor','smokeDetector','motionSensor','smartLight','fan','door','siren','thermostat','mcu','sbc'].includes(a.type) || ['ap','wap','wirelessRouter','wlc','tablet','smartphone','laptop','printer','tv','homeGateway','camera','webcam','sensor','smokeDetector','motionSensor','smartLight','fan','door','siren','thermostat','mcu','sbc'].includes(b.type);
      if (!okWireless) issues.push({ severidade: 'aviso', categoria: 'cabo', mensagem: `Link wireless entre ${a.name} e ${b.name} pode ser incompatível.` });
    }
  });

  const dhcpClients = deviceNodes.filter(n => ['pc','laptop','tablet','smartphone','printer','ipphone','tv'].includes(n.type) && !n.ip);
  const dhcpServers = deviceNodes.filter(n => n.services?.dhcp && n.active !== false);
  if (dhcpClients.length && !dhcpServers.length) {
    issues.push({ severidade: 'aviso', categoria: 'dhcp', mensagem: `Há clientes sem IP (${dhcpClients.map(n => n.name).join(', ')}), mas nenhum servidor DHCP ativo foi encontrado.` });
  }

  const servers = deviceNodes.filter(n => n.type === 'server');
  servers.forEach(s => {
    if (s.services?.dns && !s.ip) issues.push({ severidade: 'aviso', categoria: 'dns', dispositivo: s.name, mensagem: `${s.name} tem DNS ativo, mas não possui IP.` });
    if (s.services?.dhcp && !s.ip) issues.push({ severidade: 'aviso', categoria: 'dhcp', dispositivo: s.name, mensagem: `${s.name} tem DHCP ativo, mas não possui IP.` });
  });

  return issues.slice(0, 25);
}

function buildTopologyContextForAi() {
  hydrateProject();
  const safeNodes = nodes.filter(n => n.type !== 'note').map(describeNodeForAi);
  const safeLinks = links.map(describeLinkForAi);
  const selectedNode = selected ? getNode(selected) : null;
  const issues = findTopologyIssuesForAi();
  const simQueue = Array.isArray(simPduQueue) ? simPduQueue.slice(0, 10).map(p => ({
    tipo: p.type || p.kind || 'PDU',
    origem: getNode(p.src)?.name || p.src || '',
    destino: getNode(p.dst)?.name || p.dst || '',
    etapa: p.step || p.stage || ''
  })) : [];

  return {
    resumo: `${safeNodes.length} dispositivos, ${safeLinks.length} conexões, ${issues.length} alerta(s) detectado(s)`,
    selecionado: selectedNode ? describeNodeForAi(selectedNode) : null,
    dispositivos: safeNodes,
    conexoes: safeLinks,
    diagnosticoAutomatico: issues,
    modoSimulacao: simMode,
    filaDePdus: simQueue,
    instrucoesAoTutor: [
      'Use obrigatoriamente o contexto da topologia atual.',
      'Quando houver diagnosticoAutomatico, explique os alertas em linguagem simples.',
      'Se o aluno pedir ping, verifique IP, gateway, VLAN, link, ARP e rotas.',
      'Não invente dispositivos, cabos ou IPs que não estejam no contexto.',
      'Dê um próximo passo executável dentro do NetSim Pro.'
    ]
  };
}

function professorSystemPrompt() {
  return `Você é o Professor AI do NetSim Pro, um simulador educacional de redes parecido com o Cisco Packet Tracer.
Responda sempre em português do Brasil, com tom de professor paciente e motivador.
O aluno se chama Leandro.
Você recebe um JSON chamado Contexto atual do simulador NetSim Pro. Ele contém dispositivos, links, interfaces, IPs, VLANs, rotas, ARP, MAC table, serviços, modo simulação, fila de PDUs e diagnosticoAutomatico.
Você também é professor teórico da disciplina Redes de Computadores. Quando o aluno pedir aula, ensine o conceito mesmo que a topologia esteja vazia, conectando teoria com prática no NetSim Pro.
Use obrigatoriamente esse contexto para responder. Não invente dispositivos, IPs, links, VLANs ou serviços.
Se existir diagnosticoAutomatico, priorize esses alertas na resposta.
Quando o aluno perguntar por falha de ping, verifique nesta ordem: dispositivo ligado, cabo/link operacional, IP/máscara, IP duplicado, gateway, VLAN/trunk, ARP/MAC, rotas e serviços.
Quando sugerir comandos, use estilo Cisco IOS quando fizer sentido.
Formato desejado:
1) O que observei na sua rede;
2) Possível problema ou conceito;
3) Próximo passo prático no NetSim Pro;
4) Confirmação curta para o aluno testar.
Se a topologia estiver vazia, peça para adicionar dispositivos e cabos.
Não fale que é um modelo de IA. Aja como tutor dentro do simulador.`;
}

async function sendProfessorMessage() {
  const input = document.getElementById('ai-input');
  const question = input?.value.trim();
  if (!question) return;
  input.value = '';
  addAiMessage('user', question);
  updateAiStatus('Professor AI analisando a topologia...', 'loading');

  try {
    const answer = await callGroqProfessor(question);
    aiProfessorHistory.push({ role: 'user', content: question });
    aiProfessorHistory.push({ role: 'assistant', content: answer });
    aiProfessorHistory = aiProfessorHistory.slice(-10);
    addAiMessage('bot', answer);
    netBotSpeak('📘 Respondi no painel Professor AI. Teste o próximo passo no simulador que eu acompanho você.', 'success', 8000);
    updateAiStatus('Groq pronta para ensinar', 'ready');
  } catch (err) {
    console.error(err);
    addAiMessage('bot', `Não consegui chamar a Groq agora. Verifique a API Key, o modelo ou use um backend proxy.\n\nErro: ${err.message || err}`);
    updateAiStatus('Erro na conexão com a Groq', '');
  }
}

async function callGroqProfessor(question) {
  const apiKey = (document.getElementById('groq-api-key')?.value.trim() || localStorage.getItem('netsim_groq_key') || '').trim();
  const model = (document.getElementById('groq-model')?.value.trim() || localStorage.getItem('netsim_groq_model') || 'llama-3.1-8b-instant').trim();
  const proxyUrl = (document.getElementById('groq-proxy-url')?.value.trim() || localStorage.getItem('netsim_groq_proxy') || '').trim();
  const topology = buildTopologyContextForAi();
  const messages = [
    { role: 'system', content: professorSystemPrompt() },
    ...aiProfessorHistory.slice(-6),
    { role: 'user', content: `Contexto atual do simulador NetSim Pro:\n${JSON.stringify(topology, null, 2)}\n\nPergunta atual do aluno:\n${question}` }
  ];

  if (proxyUrl) {
    const res = await fetch(proxyUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0.35, max_tokens: 400 })
    });
    if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
    const data = await res.json();
    return data.answer || data.choices?.[0]?.message?.content || data.content || 'Sem resposta do proxy.';
  }

  if (!apiKey) throw new Error('API Key da Groq não configurada. Abra “Configurar Groq” no painel.');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.35, max_tokens: 700 })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Groq HTTP ${res.status}: ${t.slice(0, 180)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'A Groq respondeu, mas não veio conteúdo.';
}



// Drag and Drop do painel Professor AI
let aiProfessorDragReady = false;
let aiProfessorDragging = false;
let aiProfessorDragOffsetX = 0;
let aiProfessorDragOffsetY = 0;

function initAiProfessorDrag() {
  if (aiProfessorDragReady) return;
  const panel = document.getElementById('ai-professor-panel');
  const handle = document.getElementById('ai-professor-drag-handle');
  if (!panel || !handle) return;
  aiProfessorDragReady = true;

  const saved = JSON.parse(localStorage.getItem('netsim_ai_panel_pos') || 'null');
  if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
    panel.style.left = saved.left + 'px';
    panel.style.top = saved.top + 'px';
    panel.style.right = 'auto';
  }

  function clampPanel(left, top) {
    const margin = 8;
    const rect = panel.getBoundingClientRect();
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    return {
      left: Math.min(Math.max(margin, left), maxLeft),
      top: Math.min(Math.max(margin, top), maxTop)
    };
  }

  function movePanel(clientX, clientY) {
    const pos = clampPanel(clientX - aiProfessorDragOffsetX, clientY - aiProfessorDragOffsetY);
    panel.style.left = pos.left + 'px';
    panel.style.top = pos.top + 'px';
    panel.style.right = 'auto';
    panel.style.transform = panel.classList.contains('open') ? 'translateX(0)' : '';
  }

  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.ai-professor-close')) return;
    aiProfessorDragging = true;
    panel.classList.add('dragging');
    const rect = panel.getBoundingClientRect();
    aiProfessorDragOffsetX = e.clientX - rect.left;
    aiProfessorDragOffsetY = e.clientY - rect.top;
    handle.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });

  handle.addEventListener('pointermove', (e) => {
    if (!aiProfessorDragging) return;
    movePanel(e.clientX, e.clientY);
  });

  function finishDrag(e) {
    if (!aiProfessorDragging) return;
    aiProfessorDragging = false;
    panel.classList.remove('dragging');
    const rect = panel.getBoundingClientRect();
    localStorage.setItem('netsim_ai_panel_pos', JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));
    try { handle.releasePointerCapture?.(e.pointerId); } catch (_) {}
  }

  handle.addEventListener('pointerup', finishDrag);
  handle.addEventListener('pointercancel', finishDrag);

  handle.addEventListener('dblclick', () => {
    localStorage.removeItem('netsim_ai_panel_pos');
    panel.style.left = '';
    panel.style.top = '';
    panel.style.right = '18px';
    panel.style.transform = panel.classList.contains('open') ? 'translateX(0)' : '';
  });

  window.addEventListener('resize', () => {
    if (!panel.classList.contains('open')) return;
    const rect = panel.getBoundingClientRect();
    const pos = clampPanel(rect.left, rect.top);
    panel.style.left = pos.left + 'px';
    panel.style.top = pos.top + 'px';
    panel.style.right = 'auto';
  });
}

// Atalho: tecla A abre/fecha o Professor AI quando não estiver digitando.
document.addEventListener('keydown', (e) => {
  const tag = (document.activeElement?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  if (e.key.toLowerCase() === 'a') toggleAiProfessor();
});
