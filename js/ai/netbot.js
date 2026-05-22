// ══════════════════════════════════════════
//  NETBOT — ASSISTENTE ANIMADO EDUCACIONAL
// ══════════════════════════════════════════
let netBotLastSpeakAt = 0;
let netBotMutedUntil = 0;

function netBotSpeak(message, mood = 'happy', duration = 9000) {
  const bot = document.getElementById('netbot');
  const bubble = document.getElementById('netbot-bubble');
  if (!bot || !bubble) return;
  if (Date.now() < netBotMutedUntil) return;
  bot.classList.remove('hidden', 'thinking', 'success', 'warn', 'error');
  bot.classList.add(mood);
  const safeFormat = (typeof formatAiText === 'function') ? formatAiText(message) : String(message);
  bubble.innerHTML = (typeof sanitizeAiHtml === 'function') ? sanitizeAiHtml(safeFormat) : safeFormat;
  netBotLastSpeakAt = Date.now();
  if (duration) {
    clearTimeout(netBotSpeak._t);
    netBotSpeak._t = setTimeout(() => {
      if (Date.now() - netBotLastSpeakAt >= duration - 250) bot.classList.remove('thinking', 'success', 'warn', 'error');
    }, duration);
  }
}

function netBotToggleMenu() {
  document.getElementById('netbot-actions')?.classList.toggle('open');
}

function netBotHide() {
  document.getElementById('netbot')?.classList.add('hidden');
  document.getElementById('netbot-mini')?.classList.add('show');
  netBotMutedUntil = Date.now() + 2500;
}

function netBotShow() {
  document.getElementById('netbot')?.classList.remove('hidden');
  document.getElementById('netbot-mini')?.classList.remove('show');
  netBotSpeak('Voltei! Quer que eu explique a topologia ou crie um desafio?', 'happy');
}

function netBotDeviceConcept(type) {
  const map = {
    router: 'Roteadores trabalham na camada 3 e conectam redes diferentes.',
    router2901: 'Roteadores fazem roteamento entre sub-redes e podem usar rotas estáticas ou dinâmicas.',
    router2911: 'Roteadores fazem roteamento entre sub-redes e podem usar rotas estáticas ou dinâmicas.',
    router4321: 'Roteadores conectam redes diferentes e são importantes para gateway padrão.',
    router4331: 'Roteadores conectam redes diferentes e são importantes para gateway padrão.',
    switch: 'Switches trabalham principalmente na camada 2 e aprendem endereços MAC.',
    switch2950: 'Switches encaminham quadros usando a tabela MAC.',
    switch3560: 'Switch L3 pode atuar com VLANs e roteamento entre redes.',
    switch3650: 'Switch L3 pode atuar com VLANs e roteamento entre redes.',
    pc: 'PCs precisam de IP, máscara e, para sair da rede local, gateway padrão.',
    laptop: 'Notebooks podem usar cabo ou Wi‑Fi. Confira IP, máscara e gateway.',
    server: 'Servidores podem oferecer HTTP, DNS e DHCP para a rede.',
    ap: 'Access Point conecta dispositivos sem fio à rede cabeada.',
    wap: 'Access Point conecta dispositivos sem fio à rede cabeada.',
    wirelessRouter: 'Roteador Wi‑Fi combina roteamento, switch e rede sem fio.',
    firewall: 'Firewall controla o tráfego permitido ou bloqueado entre redes.',
    asa: 'ASA é um firewall usado para segurança e controle de tráfego.',
    hub: 'Hub repete sinais para todos; é mais simples que um switch.'
  };
  return map[type] || 'Esse dispositivo faz parte da topologia. Configure IP, portas e conexões para testar comunicação.';
}

function netBotOnDeviceAdded(n) {
  if (!n || n.type === 'note') return;
  netBotSpeak(`✅ Você adicionou <b>${n.name}</b>.<br>${netBotDeviceConcept(n.type)}<br><br>Próximo passo: conecte com cabo ou configure IP.`, 'success');
}

function netBotOnLinkAdded(a, b, cableLabel) {
  if (!a || !b) return;
  netBotSpeak(`🔗 Conexão criada: <b>${a.name}</b> ↔ <b>${b.name}</b> usando ${cableLabel}.<br>Agora teste conectividade com ping ou veja se as interfaces ficaram up.`, 'success');
}

function netBotOnPingResult(src, target, dst, reachable) {
  if (reachable) {
    netBotSpeak(`🎉 Ping funcionou! ${src?.name || 'Origem'} alcançou ${target?.name || dst}.<br>Isso indica que IP, link e caminho básico estão corretos.`, 'success');
  } else {
    netBotSpeak(`⚠️ Ping falhou para ${dst}. Verifique nesta ordem: cabo/link, IP e máscara, gateway, VLAN e rotas.<br>Clique em <b>Analisar</b> que eu peço ajuda ao Professor AI.`, 'warn', 12000);
  }
}

function netBotExplainCurrent() {
  toggleAiProfessor(true);
  askProfessorQuick('Explique a rede atual de forma didática, como aula de Redes de Computadores. Fale o papel de cada dispositivo e os conceitos envolvidos.');
  netBotSpeak('📚 Vou pedir ao Professor AI para transformar sua topologia em uma aula de Redes.', 'thinking');
}

function netBotAnalyzeCurrent() {
  toggleAiProfessor(true);
  askProfessorQuick('Analise a topologia atual, encontre erros e me diga o primeiro ajuste prático que devo fazer.');
  netBotSpeak('🔍 Estou analisando sua rede com o Professor AI.', 'thinking');
}

function netBotCreateChallenge() {
  toggleAiProfessor(true);
  askProfessorQuick('Crie um desafio prático baseado no nível atual da minha topologia. Inclua objetivo, passos e critério de sucesso.');
  netBotSpeak('🎯 Vou gerar um desafio prático para você treinar redes.', 'thinking');
}
