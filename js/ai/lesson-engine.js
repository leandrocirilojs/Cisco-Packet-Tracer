// ══════════════════════════════════════════
//  FRAN-CISCO — LESSON ENGINE
//  Modo Aula de Redes de Computadores
// ══════════════════════════════════════════

const NETWORK_LESSONS = {
  fundamentos: {
    title: 'Fundamentos de Redes',
    topics: ['o que é rede', 'comunicação de dados', 'emissor/receptor/mensagem', 'protocolo', 'latência', 'throughput'],
    lab: 'Monte 2 PCs ligados a um switch e teste comunicação com ping.'
  },
  osi: {
    title: 'Modelo OSI',
    topics: ['7 camadas', 'encapsulamento', 'função de cada camada', 'exemplos de protocolos'],
    lab: 'Explique onde aparecem cabo, MAC, IP, TCP/UDP e aplicação na topologia atual.'
  },
  tcpip: {
    title: 'Arquitetura TCP/IP',
    topics: ['camada de acesso', 'internet', 'transporte', 'aplicação', 'comparação com OSI'],
    lab: 'Use ping para observar ICMP na camada de Internet.'
  },
  ip: {
    title: 'Endereçamento IP e Máscara',
    topics: ['IPv4', 'máscara', 'rede e host', 'gateway', 'sub-rede', 'IP duplicado'],
    lab: 'Configure IPs na mesma rede em dois PCs e teste ping.'
  },
  'switch-router': {
    title: 'Switch e Roteador',
    topics: ['switch camada 2', 'tabela MAC', 'roteador camada 3', 'gateway', 'diferença entre LANs'],
    lab: 'Crie uma LAN com switch e depois use roteador para interligar redes.'
  },
  servicos: {
    title: 'DHCP, DNS, ARP e ICMP',
    topics: ['DHCP entrega IP', 'DNS resolve nomes', 'ARP descobre MAC', 'ICMP testa conectividade'],
    lab: 'Ative um servidor DHCP/DNS e teste ping por IP e por nome.'
  },
  vlan: {
    title: 'VLAN',
    topics: ['segmentação lógica', 'access', 'trunk', 'isolamento', 'inter-VLAN routing'],
    lab: 'Coloque PCs em VLANs diferentes e observe por que o ping falha.'
  },
  seguranca: {
    title: 'Segurança de Redes',
    topics: ['firewall', 'ACL', 'segmentação', 'senhas', 'boas práticas', 'menor privilégio'],
    lab: 'Desenhe uma rede com Internet, firewall, servidor e PCs internos.'
  }
};


function toggleLessonPanel(forceOpen = null) {
  const content = document.getElementById('lesson-content');
  const arrow = document.getElementById('lesson-arrow');
  const hub = document.getElementById('ai-learning-hub');
  if (!content || !arrow) return;

  const shouldOpen = forceOpen === null ? !content.classList.contains('open') : !!forceOpen;
  content.classList.toggle('open', shouldOpen);
  if (hub) hub.classList.toggle('collapsed', !shouldOpen);
  arrow.textContent = shouldOpen ? '▼' : '▶';
}

function startNetworkLesson(key) {
  const lesson = NETWORK_LESSONS[key] || NETWORK_LESSONS.fundamentos;
  toggleAiProfessor(true);
  const prompt = `Modo Aula ativado: ${lesson.title}.

Ensine este tema para um aluno de ADS iniciante, em português simples.
Inclua:
1) explicação rápida;
2) exemplo do dia a dia;
3) relação com o NetSim Pro;
4) mini passo a passo prático;
5) 3 perguntas de revisão.

Tópicos obrigatórios: ${lesson.topics.join(', ')}.
Atividade prática sugerida: ${lesson.lab}.
Use a topologia atual somente como exemplo se ela ajudar.`;
  addAiMessage('user', '📚 Aula: ' + lesson.title);
  netBotSpeak(`📚 Modo Aula iniciado: <b>${lesson.title}</b>.<br>Vou explicar teoria e transformar em prática no simulador.`, 'thinking', 10000);
  askProfessorQuick(prompt);
}

function startLessonQuiz() {
  toggleAiProfessor(true);
  const prompt = `Crie um quiz de Redes de Computadores para aluno iniciante de ADS.
Faça 5 perguntas de múltipla escolha sobre fundamentos, OSI, TCP/IP, IP, switch, roteador, DHCP, DNS, ARP, ICMP e VLAN.
Não entregue todas as respostas imediatamente. Peça para o aluno responder A, B, C ou D e explique depois.`;
  addAiMessage('user', '🧠 Quero um quiz de Redes');
  netBotSpeak('🧠 Vou preparar um quiz para testar seu aprendizado de Redes.', 'thinking');
  askProfessorQuick(prompt);
}

function createGuidedLab() {
  toggleAiProfessor(true);
  const prompt = `Crie um laboratório guiado dentro do NetSim Pro para ensinar Redes de Computadores.
O laboratório deve ter: objetivo, dispositivos necessários, cabos, endereços IP, passos de configuração, teste com ping, erros comuns e critérios de conclusão.
Use nível iniciante e conecte teoria com prática.`;
  addAiMessage('user', '🎯 Criar desafio guiado');
  netBotSpeak('🎯 Vou criar um laboratório guiado com objetivo, passos e correção.', 'thinking');
  askProfessorQuick(prompt);
}

// Expor funções para os botões inline do HTML
window.NETWORK_LESSONS = NETWORK_LESSONS;
window.toggleLessonPanel = toggleLessonPanel;
window.startNetworkLesson = startNetworkLesson;
window.startLessonQuiz = startLessonQuiz;
window.createGuidedLab = createGuidedLab;
