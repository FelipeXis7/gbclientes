const STORAGE_KEY = 'goianos_barbearia_estado_v1';
const SESSAO_KEY = 'goianos_barbearia_sessao_v1';
const SUPABASE_URL = 'https://zgnfymjjdjhctpttfmbs.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_4Da89vFCOCrqmk7JxcmX2Q_xa1XmJWb';
const SUPABASE_ESTADO_ID = 'principal';
const supabaseGb = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) || null;
let supabaseCarregado = false;
let salvamentoSupabaseTimer = null;
let avaliacaoPendente = null;
let fluxoAvaliacaoAtual = { tipo: 'criar', avaliacaoId: null };
let planoPendente = { planoInicial: 'combo' };

const PLANOS_GB = [
    {
        id: 'combo',
        nome: "Goiano's Club Combo",
        valor: 99.90,
        descricao: 'Cabelo e barba sempre em dia, com 10% de desconto nos demais serviços e produtos.',
    },
    {
        id: 'barba',
        nome: "Goiano's Club Barba",
        valor: 54.90,
        descricao: 'Barba bem cuidada todos os meses, com 10% de desconto nos demais serviços.',
    },
    {
        id: 'cabelo',
        nome: "Goiano's Club Cabelo",
        valor: 54.90,
        descricao: 'Corte e acabamento sempre no capricho, com 10% de desconto nos demais serviços e produtos.',
    },
];

const estadoPadrao = {
    barbeiros: [
        { id: crypto.randomUUID(), nome: 'Marcos Goiano', ativo: true, expediente: true },
        { id: crypto.randomUUID(), nome: 'Pedro', ativo: true, expediente: true },
        { id: crypto.randomUUID(), nome: 'Rafael', ativo: true, expediente: true },
    ],
    clientes: [
        { id: crypto.randomUUID(), nome: 'Lucas Andrade', telefone: '62999990001', plano: 'ativo', planoVenceEm: addDiasIso(18) },
        { id: crypto.randomUUID(), nome: 'Bruno Silva', telefone: '62999990002', plano: 'pendente', planoVenceEm: addDiasIso(-2) },
    ],
    avaliacoes: [],
    fila: [],
    atendimentos: [],
    servicos: [
        { id: crypto.randomUUID(), nome: 'Corte simples', valor: 35 },
        { id: crypto.randomUUID(), nome: 'Barba', valor: 25 },
        { id: crypto.randomUUID(), nome: 'Corte + barba', valor: 55 },
        { id: crypto.randomUUID(), nome: 'Sobrancelha', valor: 10 },
        { id: crypto.randomUUID(), nome: 'Acabamento', valor: 15 },
    ],
    acessos: [
        { id: crypto.randomUUID(), nome: 'Administrador GB', login: 'admin', perfil: 'admin', ativo: true, senhaDefinida: true },
        { id: crypto.randomUUID(), nome: 'Barbeiro Modelo', login: 'barbeiro', perfil: 'barbeiro', ativo: true, senhaDefinida: false },
    ],
    expedienteAberto: false,
};

let estado = carregarEstado();
removerAvaliacoesDemonstracao();
let usuarioLogado = carregarSessao();
let abaAtual = 'dashboard';
let navPublicaFlutuante = false;

document.addEventListener('DOMContentLoaded', () => {
    lucide?.createIcons?.();
    configurarMascaraTelefone();
    atualizarTesouraCorte();
    atualizarNavbarPublica();
    window.addEventListener('scroll', atualizarTesouraCorte, { passive: true });
    window.addEventListener('scroll', atualizarNavbarPublica, { passive: true });
    window.addEventListener('resize', atualizarTesouraCorte);
    window.addEventListener('resize', atualizarNavbarPublica);
    if (new URLSearchParams(location.search).get('tv') === '1') {
        entrarAdmin({ login: 'tv', perfil: 'consulta' }, 'tv');
        return;
    }
    if (new URLSearchParams(location.search).get('admin') === '1') {
        mostrarLogin();
    }
    if (usuarioLogado) entrarAdmin(usuarioLogado, 'dashboard');
    renderTudo();
    carregarEstadoSupabase();
    document.getElementById('form-login')?.addEventListener('submit', loginAdmin);
    setInterval(atualizarRelogios, 1000);
});

function atualizarTesouraCorte() {
    const hero = document.querySelector('.hero');
    const divider = document.querySelector('.cut-divider');
    if (!hero || !divider) return;

    const inicio = hero.offsetTop;
    const distancia = Math.max(1, hero.offsetHeight * 2.35);
    const progresso = Math.min(1, Math.max(0, (window.scrollY - inicio) / distancia));

    divider.style.setProperty('--cut-progress', `${progresso * 100}%`);
    divider.style.setProperty('--cut-x', `${5 + progresso * 90}%`);
    divider.style.setProperty('--cut-rotation', `${-12 + progresso * 24}deg`);
}

function atualizarNavbarPublica() {
    const hero = document.querySelector('.hero');
    const nav = document.querySelector('.floating-public-nav');
    if (!hero || !nav || document.getElementById('site-publico')?.classList.contains('hidden')) return;

    const pontoEntrada = hero.offsetTop + 190;
    const pontoSaida = hero.offsetTop + 70;
    const scrollAtual = window.scrollY;
    const deveEntrar = !navPublicaFlutuante && scrollAtual > pontoEntrada;
    const deveSair = navPublicaFlutuante && scrollAtual < pontoSaida;
    if (!deveEntrar && !deveSair) return;

    if (deveEntrar) {
        navPublicaFlutuante = true;
        nav.classList.add('is-visible');
        return;
    }

    navPublicaFlutuante = false;
    nav.classList.remove('is-visible');
}

function togglePublicMenu(botao) {
    const nav = botao?.closest('.public-nav, .floating-public-nav');
    if (!nav) return;
    document.querySelectorAll('.public-nav, .floating-public-nav').forEach(item => {
        if (item !== nav) item.classList.remove('public-menu-open');
    });
    nav.classList.toggle('public-menu-open');
}

function carregarEstado() {
    try {
        const salvo = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return salvo ? { ...structuredClone(estadoPadrao), ...salvo } : structuredClone(estadoPadrao);
    } catch {
        return structuredClone(estadoPadrao);
    }
}

function removerAvaliacoesDemonstracao() {
    estado.avaliacoes = Array.isArray(estado.avaliacoes) ? estado.avaliacoes : [];
    const nomesTeste = new Set(['Matheus M S', 'Lucas Pires', 'Rafael Costa']);
    const totalAntes = estado.avaliacoes.length;
    estado.avaliacoes = estado.avaliacoes.filter(avaliacao => !nomesTeste.has(avaliacao?.nome));
    if (estado.avaliacoes.length !== totalAntes) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    }
}

function salvarEstado() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    agendarSalvamentoSupabase();
    renderTudo();
}

async function carregarEstadoSupabase() {
    if (!supabaseGb) return;
    try {
        const { data, error } = await supabaseGb
            .from('gb_estado_app')
            .select('dados')
            .eq('id', SUPABASE_ESTADO_ID)
            .maybeSingle();

        if (error) throw error;

        if (data?.dados && Object.keys(data.dados).length) {
            estado = { ...structuredClone(estadoPadrao), ...data.dados };
            removerAvaliacoesDemonstracao();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
            renderTudo();
            await salvarEstadoSupabase();
        } else {
            await salvarEstadoSupabase();
        }

        supabaseCarregado = true;
    } catch (erro) {
        supabaseCarregado = false;
        console.warn('Supabase indisponível. Usando dados locais.', erro);
    }
}

function agendarSalvamentoSupabase() {
    if (!supabaseGb || !supabaseCarregado) return;
    clearTimeout(salvamentoSupabaseTimer);
    salvamentoSupabaseTimer = setTimeout(salvarEstadoSupabase, 450);
}

async function salvarEstadoSupabase() {
    if (!supabaseGb) return;
    try {
        const { error } = await supabaseGb
            .from('gb_estado_app')
            .upsert({
                id: SUPABASE_ESTADO_ID,
                dados: estado,
                atualizado_em: new Date().toISOString(),
            });
        if (error) throw error;
        supabaseCarregado = true;
    } catch (erro) {
        console.warn('Não foi possível salvar no Supabase. Dados locais preservados.', erro);
    }
}

function carregarSessao() {
    try { return JSON.parse(localStorage.getItem(SESSAO_KEY)); } catch { return null; }
}

function salvarSessao(usuario) {
    localStorage.setItem(SESSAO_KEY, JSON.stringify(usuario));
}

function addDiasIso(dias) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString();
}

function agoraIso() { return new Date().toISOString(); }
function dinheiro(valor) { return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function minutosEntre(inicio, fim = new Date()) { return Math.max(0, Math.floor((new Date(fim) - new Date(inicio)) / 60000)); }
function duracao(inicio, fim = new Date()) {
    const total = Math.max(0, Math.floor((new Date(fim) - new Date(inicio)) / 1000));
    const min = String(Math.floor(total / 60)).padStart(2, '0');
    const seg = String(total % 60).padStart(2, '0');
    return `${min}:${seg}`;
}

function telefoneLimpo(valor) { return String(valor || '').replace(/\D/g, ''); }
function emailValido(valor) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(valor || '').trim()); }
function mascararEmail(email) {
    const [usuario = '', dominio = ''] = String(email || '').split('@');
    const inicio = usuario.slice(0, 2);
    const fim = usuario.length > 4 ? usuario.slice(-1) : '';
    return `${inicio}${'*'.repeat(Math.max(3, usuario.length - inicio.length - fim.length))}${fim}@${dominio}`;
}
function normalizarConteudo(valor) {
    return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function contemConteudoOfensivo(texto) {
    const normalizado = normalizarConteudo(texto);
    const bloqueados = [
        'arrombado',
        'bosta',
        'burro',
        'caralho',
        'fdp',
        'filho da puta',
        'merda',
        'otario',
        'porra',
        'puta',
        'vagabundo',
        'vai se fuder',
    ];
    return bloqueados.some(palavra => normalizado.includes(palavra));
}
function formatarTelefone(valor) {
    let digitos = telefoneLimpo(valor).slice(0, 12);
    if (digitos.length >= 2 && digitos[0] !== '0') digitos = `0${digitos}`.slice(0, 12);
    if (!digitos) return '';
    if (digitos.length <= 3) return `(${digitos}`;
    if (digitos.length <= 7) return `(${digitos.slice(0, 3)}) ${digitos.slice(3)}`;
    return `(${digitos.slice(0, 3)}) ${digitos.slice(3, 8)}-${digitos.slice(8)}`;
}
function configurarMascaraTelefone() {
    document.addEventListener('input', evento => {
        const alvo = evento.target;
        if (!alvo?.matches?.('input')) return;
        const idNome = `${alvo.id || ''} ${alvo.name || ''}`.toLowerCase();
        if (!idNome.includes('telefone')) return;
        alvo.value = formatarTelefone(alvo.value);
        alvo.setSelectionRange?.(alvo.value.length, alvo.value.length);
    });
}
function barbeirosDoDia() { return estado.barbeiros.filter(b => b.ativo && b.expediente); }
function emAtendimento() { return estado.fila.filter(item => item.status === 'atendimento'); }
function aguardando() { return estado.fila.filter(item => item.status === 'aguardando'); }
function clientePorId(id) { return estado.clientes.find(c => c.id === id); }
function barbeiroPorId(id) { return estado.barbeiros.find(b => b.id === id); }

function mostrarLogin() {
    document.getElementById('tela-login').classList.remove('hidden');
}

function loginAdmin(evento) {
    evento.preventDefault();
    const login = document.getElementById('login-usuario').value.trim();
    const senha = document.getElementById('login-senha').value.trim();
    if ((login === 'admin' && senha === '1234') || estado.acessos.some(a => a.login === login && a.ativo)) {
        const acesso = estado.acessos.find(a => a.login === login) || estado.acessos[0];
        entrarAdmin({ login: acesso.login, perfil: acesso.perfil, nome: acesso.nome }, 'dashboard');
        showToast('Bem-vindo à Goianos Barbearia.', 'success');
    } else {
        showToast('Credenciais inválidas.', 'error');
    }
}

function entrarAdmin(usuario, aba = 'dashboard') {
    usuarioLogado = usuario;
    salvarSessao(usuario);
    document.getElementById('site-publico').classList.add('hidden');
    document.getElementById('tela-login').classList.add('hidden');
    document.getElementById('nav-admin').classList.remove('hidden');
    document.getElementById('app-admin').classList.remove('hidden');
    abrirAba(aba, document.querySelector(`[onclick*="${aba}"]`));
}

function sairAdmin() {
    localStorage.removeItem(SESSAO_KEY);
    usuarioLogado = null;
    location.reload();
}

function abrirAba(id, botao) {
    abaAtual = id;
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    document.getElementById(`aba-${id}`)?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    botao?.classList?.add('active');
    if (id === 'tv') renderTv();
    if (id === 'controle') renderControle();
    if (id === 'acessos') renderAcessos();
    if (id === 'config') renderServicos();
    lucide?.createIcons?.();
}

function toggleMenu() {
    document.getElementById('nav-links').classList.toggle('open');
}

function abrirSubaba(id, botao) {
    document.querySelectorAll('.sub-content').forEach(s => s.classList.remove('active'));
    document.getElementById(`sub-${id}`)?.classList.add('active');
    document.querySelectorAll('.subtab').forEach(b => b.classList.remove('active'));
    botao?.classList?.add('active');
    renderControle();
}

function renderTudo() {
    renderDashboard();
    renderControle();
    renderAcessos();
    renderServicos();
    renderTv();
    renderEquipePublica();
    renderAvaliacoesPublicas();
    lucide?.createIcons?.();
}

function fotoPadraoBarbeiro(barbeiro, indice = 0) {
    const nome = String(barbeiro?.nome || '').toLowerCase();
    if (nome.includes('goiano')) return 'Imagens/Foto Goiano.png';
    return indice % 2 === 0 ? 'Imagens/Foto_Suspense_Esquerda.png' : 'Imagens/Foto_Suspense_Direita.png';
}

function renderEquipePublica() {
    const alvo = document.getElementById('team-grid-public');
    if (!alvo) return;
    const barbeiros = [...(estado.barbeiros || [])]
        .filter(barbeiro => barbeiro.ativo !== false)
        .sort((a, b) => {
            const ordemA = Number(a.ordemExibicao || 99);
            const ordemB = Number(b.ordemExibicao || 99);
            if (ordemA !== ordemB) return ordemA - ordemB;
            return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
        });
    alvo.innerHTML = barbeiros.map((barbeiro, indice) => {
        const foto = barbeiro.foto || barbeiro.fotoUrl || fotoPadraoBarbeiro(barbeiro, indice);
        const destaque = String(barbeiro.nome || '').toLowerCase().includes('goiano') ? ' featured' : '';
        return `
            <article class="team-card${destaque}">
                <img src="${escapeAttr(foto)}" alt="${escapeAttr(barbeiro.nome || 'Barbeiro')}, barbeiro da Goianos Barbearia">
                <strong>${escapeHtml(barbeiro.nome || 'Equipe GB')}</strong>
            </article>`;
    }).join('');
}

function renderAvaliacoesPublicas() {
    const alvo = document.getElementById('lista-avaliacoes-publicas');
    if (!alvo) return;
    const avaliacoes = [...(estado.avaliacoes || [])].sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));
    if (!avaliacoes.length) {
        alvo.innerHTML = vazio('As primeiras avaliações aparecerão aqui em breve.');
        return;
    }
    const cards = avaliacoes.map(a => `
        <article class="review-card">
            ${a.atualizadoEm ? '<span class="review-edited-badge">Editado</span>' : ''}
            <div class="review-stars" aria-label="${Number(a.estrelas || 0)} estrelas">${estrelasHtml(a.estrelas)}</div>
            <p>${escapeHtml(a.texto || '')}</p>
            ${a.barbeiroAlvoNome ? `<small class="review-target">Menção ao barbeiro: ${escapeHtml(a.barbeiroAlvoNome)}</small>` : ''}
            <strong>${escapeHtml(a.nome || 'Cliente GB')}</strong>
        </article>
    `).join('');
    if (avaliacoes.length <= 2) {
        alvo.innerHTML = `<div class="reviews-static">${cards}</div>`;
        lucide?.createIcons?.();
        return;
    }
    alvo.innerHTML = `
        <div class="reviews-marquee">
            <div class="reviews-track">
                <div class="reviews-group">${cards}</div>
                <div class="reviews-group" aria-hidden="true">${cards}</div>
            </div>
        </div>`;
    lucide?.createIcons?.();
}

function renderDashboard() {
    const fila = aguardando();
    const atendendo = emAtendimento();
    const concluidosHoje = atendimentosHoje();
    const media = fila.length ? Math.round(fila.reduce((s, item) => s + minutosEntre(item.criadoEm), 0) / fila.length) : 0;
    const faturamento = concluidosHoje.reduce((s, a) => s + Number(a.valor || 0), 0);
    setText('m-clientes-loja', fila.length + atendendo.length);
    setText('m-barbeiros-atendendo', new Set(atendendo.map(i => i.barbeiroId)).size);
    setText('m-espera-media', `${String(media).padStart(2, '0')}:00`);
    setText('m-faturamento-dia', dinheiro(faturamento));
    renderLista('lista-dashboard-fila', fila, itemFilaHtml);
    renderLista('lista-dashboard-atendimento', atendendo, itemAtendimentoHtml);
}

function renderControle() {
    renderClientes();
    renderPlanos();
    renderPagamentos();
    renderExpediente();
    renderBarbeiros();
    renderRelatorios();
}

function renderClientes() {
    const alvo = document.getElementById('sub-clientes');
    if (!alvo) return;
    alvo.innerHTML = `
        <div class="card">
            <div class="card-title"><i data-lucide="users"></i> Clientes cadastrados</div>
            <div class="list-stack">
                ${estado.clientes.map(c => `
                    <div class="list-item">
                        <div><strong>${c.nome}</strong><small>${c.telefone} • Plano: ${rotuloPlano(c)}</small></div>
                        <span class="pill ${classePlano(c)}">${rotuloPlano(c)}</span>
                    </div>
                `).join('') || vazio('Nenhum cliente cadastrado.')}
            </div>
        </div>`;
}

function renderPlanos() {
    const alvo = document.getElementById('sub-planos');
    if (!alvo) return;
    alvo.innerHTML = `
        <div class="grid-2">
            <div class="card metric"><span>Planos ativos</span><strong>${estado.clientes.filter(c => c.plano === 'ativo').length}</strong><small>Goiano's Club a partir de R$ 54,90/mês</small></div>
            <div class="card metric"><span>Planos pendentes</span><strong>${estado.clientes.filter(c => c.plano === 'pendente').length}</strong><small>Podem regularizar no balcão/tablet</small></div>
        </div>
        <div class="card" style="margin-top:1rem">
            <div class="card-title"><i data-lucide="badge-dollar-sign"></i> Planos cadastrados</div>
            <div class="list-stack">
                ${PLANOS_GB.map(plano => `<div class="list-item"><div><strong>${plano.nome}</strong><small>${plano.descricao}</small></div><strong>${dinheiro(plano.valor)}/mês</strong></div>`).join('')}
            </div>
        </div>`;
}

function renderPagamentos() {
    const alvo = document.getElementById('sub-pagamentos');
    if (!alvo) return;
    alvo.innerHTML = `
        <div class="card">
            <div class="card-title"><i data-lucide="credit-card"></i> Pagamentos do dia</div>
            <div class="list-stack">
                ${atendimentosHoje().map(a => {
                    const c = clientePorId(a.clienteId);
                    return `<div class="list-item"><div><strong>${c?.nome || 'Cliente'}</strong><small>${a.tipoCorte} • ${a.formaPagamento}</small></div><strong>${dinheiro(a.valor)}</strong></div>`;
                }).join('') || vazio('Nenhum pagamento registrado hoje.')}
            </div>
        </div>`;
}

function renderExpediente() {
    const alvo = document.getElementById('sub-expediente');
    if (!alvo) return;
    alvo.innerHTML = `
        <div class="card">
            <div class="card-title"><i data-lucide="calendar-clock"></i> Expediente</div>
            <p class="muted">Status: <strong>${estado.expedienteAberto ? 'Aberto' : 'Fechado'}</strong></p>
            <div class="barber-grid">
                ${estado.barbeiros.filter(b => b.ativo).map(b => `
                    <button class="barber-choice" onclick="alternarBarbeiroExpediente('${b.id}')">
                        <strong>${b.nome}</strong><br><small>${b.expediente ? 'No expediente' : 'Fora do dia'}</small>
                    </button>
                `).join('')}
            </div>
            <div class="hero-actions">
                <button class="btn btn-primary" onclick="estado.expedienteAberto=true; salvarEstado()">Iniciar expediente</button>
                <button class="btn btn-danger" onclick="estado.expedienteAberto=false; salvarEstado()">Finalizar expediente</button>
            </div>
        </div>`;
}

function renderBarbeiros() {
    const alvo = document.getElementById('sub-barbeiros');
    if (!alvo) return;
    alvo.innerHTML = `
        <div class="card">
            <div class="card-title"><i data-lucide="scissors"></i> Barbeiros</div>
            <div class="list-stack">
                ${estado.barbeiros.map(b => `
                    <div class="list-item">
                        <div><strong>${b.nome}</strong><small>${b.ativo ? 'Ativo' : 'Inativo'} • ${b.expediente ? 'Expediente hoje' : 'Não escalado hoje'}</small></div>
                        <div class="hero-actions">
                            <button class="btn btn-soft" onclick="editarBarbeiro('${b.id}')">Editar</button>
                            <button class="btn btn-danger" onclick="excluirBarbeiro('${b.id}')">Excluir</button>
                        </div>
                    </div>`).join('')}
            </div>
            <button class="btn btn-primary" onclick="novoBarbeiro()">Novo barbeiro</button>
        </div>`;
}

function renderRelatorios() {
    const alvo = document.getElementById('sub-relatorios');
    if (!alvo) return;
    const porBarbeiro = estado.barbeiros.map(b => {
        const lista = estado.atendimentos.filter(a => a.barbeiroId === b.id);
        const valor = lista.reduce((s, a) => s + Number(a.valor || 0), 0);
        return { b, total: lista.length, valor };
    });
    alvo.innerHTML = `
        <div class="card">
            <div class="card-title"><i data-lucide="bar-chart-3"></i> Ficha mensal dos barbeiros</div>
            <div class="list-stack">
                ${porBarbeiro.map(x => `<div class="list-item"><div><strong>${x.b.nome}</strong><small>${x.total} atendimento(s) registrados</small></div><strong>${dinheiro(x.valor)}</strong></div>`).join('')}
            </div>
        </div>`;
}

function renderTv() {
    const alvo = document.getElementById('tv-preview');
    if (!alvo) return;
    alvo.innerHTML = `
        <div class="tv-top">
            <div><p class="eyebrow">Goianos Barbearia</p><h2>Fila da Loja</h2></div>
            <div class="pill ok">${new Date().toLocaleTimeString('pt-BR')}</div>
        </div>
        <div class="tv-grid">
            <div class="card"><div class="card-title">Aguardando</div><div class="tv-list">${aguardando().map(itemFilaHtml).join('') || vazio('Fila vazia.')}</div></div>
            <div class="card"><div class="card-title">Em atendimento</div><div class="tv-list">${emAtendimento().map(itemAtendimentoHtml).join('') || vazio('Nenhum atendimento agora.')}</div></div>
        </div>`;
}

function renderAcessos() {
    const alvo = document.getElementById('lista-acessos');
    if (!alvo) return;
    alvo.innerHTML = estado.acessos.map(a => `
        <div class="card">
            <div class="card-title">${a.nome}</div>
            <p class="muted">${a.login} • ${a.perfil} • ${a.ativo ? 'ativo' : 'inativo'}</p>
            <div class="hero-actions">
                <button class="btn btn-soft" onclick="copiarLinkSenha('${a.id}')">Copiar link</button>
                <button class="btn btn-soft" onclick="resetarSenha('${a.id}')">Resetar senha</button>
                <button class="btn btn-danger" onclick="excluirAcesso('${a.id}')">Excluir</button>
            </div>
        </div>`).join('');
}

function renderServicos() {
    const alvo = document.getElementById('lista-servicos');
    if (!alvo) return;
    alvo.innerHTML = estado.servicos.map(s => `
        <div class="service-row">
            <input class="input-estilizado" value="${s.nome}" onchange="atualizarServico('${s.id}', 'nome', this.value)">
            <input class="input-estilizado" type="number" value="${s.valor}" onchange="atualizarServico('${s.id}', 'valor', this.value)">
            <button class="btn btn-danger" onclick="removerServico('${s.id}')">Remover</button>
        </div>`).join('');
}

function buscarClienteTotem() {
    const tel = telefoneLimpo(document.getElementById('totem-telefone').value);
    if (!tel) return showToast('Informe o telefone.', 'error');
    let cliente = estado.clientes.find(c => telefoneLimpo(c.telefone) === tel);
    if (!cliente) {
        cliente = { id: crypto.randomUUID(), nome: `Cliente ${tel.slice(-4)}`, telefone: tel, plano: 'avulso', planoVenceEm: null };
        estado.clientes.push(cliente);
        salvarEstado();
    }
    mostrarEscolhaBarbeiro(cliente);
}

function mostrarEscolhaBarbeiro(cliente) {
    const alvo = document.getElementById('totem-resultado');
    alvo.innerHTML = `
        <div class="card">
            <p class="eyebrow">Cliente encontrado</p>
            <h3>${cliente.nome}</h3>
            <p class="muted">${cliente.telefone} • Plano: <span class="pill ${classePlano(cliente)}">${rotuloPlano(cliente)}</span></p>
        </div>
        <div class="card">
            <div class="card-title">Escolha o barbeiro</div>
            <div class="barber-grid">
                <button class="barber-choice" onclick="entrarNaFila('${cliente.id}', '')"><strong>Qualquer disponível</strong><br><small>Primeiro barbeiro livre</small></button>
                ${barbeirosDoDia().map(b => `<button class="barber-choice" onclick="entrarNaFila('${cliente.id}', '${b.id}')"><strong>${b.nome}</strong><br><small>Selecionar barbeiro</small></button>`).join('')}
            </div>
        </div>`;
    lucide?.createIcons?.();
}

function entrarNaFila(clienteId, barbeiroId) {
    if (estado.fila.some(i => i.clienteId === clienteId && i.status !== 'finalizado')) return showToast('Cliente já está na fila.', 'error');
    estado.fila.push({ id: crypto.randomUUID(), clienteId, barbeiroId, status: 'aguardando', criadoEm: agoraIso(), inicioEm: null });
    salvarEstado();
    showToast('Cliente adicionado à fila.', 'success');
}

function iniciarAtendimento(itemId) {
    const item = estado.fila.find(i => i.id === itemId);
    if (!item) return;
    if (!item.barbeiroId) {
        const livre = barbeirosDoDia().find(b => !emAtendimento().some(i => i.barbeiroId === b.id));
        if (!livre) return showToast('Nenhum barbeiro livre agora.', 'error');
        item.barbeiroId = livre.id;
    }
    item.status = 'atendimento';
    item.inicioEm = agoraIso();
    salvarEstado();
}

function finalizarAtendimento(itemId) {
    const item = estado.fila.find(i => i.id === itemId);
    if (!item) return;
    const cliente = clientePorId(item.clienteId);
    const servicos = estado.servicos.map(s => `<option value="${s.id}">${s.nome} - ${dinheiro(s.valor)}</option>`).join('');
    abrirModal(`
        <p class="eyebrow">Finalizar atendimento</p>
        <h2>${cliente?.nome || 'Cliente'}</h2>
        <div class="form-stack">
            <label>Tipo de corte<select id="fim-servico" class="input-estilizado">${servicos}</select></label>
            <label>Valor cobrado<input id="fim-valor" class="input-estilizado" type="number" step="0.01" value="${cliente?.plano === 'ativo' ? 0 : estado.servicos[0]?.valor || 0}"></label>
            <label>Forma real de pagamento
                <select id="fim-pagamento" class="input-estilizado">
                    <option>Plano GB</option><option>Pix</option><option>Dinheiro</option><option>Cartão de crédito</option><option>Cartão de débito</option><option>Cortesia</option>
                </select>
            </label>
            <button class="btn btn-primary" onclick="confirmarFinalizacao('${itemId}')">Finalizar</button>
        </div>`);
}

function confirmarFinalizacao(itemId) {
    const item = estado.fila.find(i => i.id === itemId);
    const servico = estado.servicos.find(s => s.id === document.getElementById('fim-servico').value);
    item.status = 'finalizado';
    item.fimEm = agoraIso();
    estado.atendimentos.push({
        id: crypto.randomUUID(),
        clienteId: item.clienteId,
        barbeiroId: item.barbeiroId,
        entradaEm: item.criadoEm,
        inicioEm: item.inicioEm,
        fimEm: item.fimEm,
        tipoCorte: servico?.nome || 'Corte',
        valor: Number(document.getElementById('fim-valor').value || 0),
        formaPagamento: document.getElementById('fim-pagamento').value,
        operador: usuarioLogado?.login || 'admin',
    });
    estado.fila = estado.fila.filter(i => i.id !== itemId);
    fecharModal();
    salvarEstado();
}

function itemFilaHtml(item) {
    const c = clientePorId(item.clienteId);
    const b = barbeiroPorId(item.barbeiroId);
    return `
        <div class="list-item">
            <div>
                <strong>${c?.nome || 'Cliente'} ${iconePlano(c)}</strong>
                <small>${b ? b.nome : 'Qualquer disponível'} • Espera: <span data-tempo="${item.criadoEm}">${duracao(item.criadoEm)}</span></small>
            </div>
            <button class="btn btn-ok" onclick="iniciarAtendimento('${item.id}')">Iniciar</button>
        </div>`;
}

function itemAtendimentoHtml(item) {
    const c = clientePorId(item.clienteId);
    const b = barbeiroPorId(item.barbeiroId);
    return `
        <div class="list-item">
            <div>
                <strong>${c?.nome || 'Cliente'} ${iconePlano(c)}</strong>
                <small>${b?.nome || 'Barbeiro'} • Atendimento: <span data-tempo="${item.inicioEm}">${duracao(item.inicioEm)}</span></small>
            </div>
            <button class="btn btn-primary" onclick="finalizarAtendimento('${item.id}')">Finalizar</button>
        </div>`;
}

function rotuloPlano(c) {
    if (!c || c.plano === 'avulso') return 'Avulso';
    if (c.plano === 'ativo') return 'Ativo';
    if (c.plano === 'cancelado') return 'Cancelado';
    return 'Pendente';
}
function classePlano(c) {
    if (!c || c.plano === 'avulso') return 'neutral';
    if (c.plano === 'cancelado') return 'neutral';
    return c.plano === 'ativo' ? 'ok' : 'bad';
}
function iconePlano(c) {
    if (!c || c.plano === 'avulso') return '';
    if (c.plano === 'cancelado') return '<span class="pill neutral">Cancelado</span>';
    return c.plano === 'ativo' ? '<span class="pill ok">Plano</span>' : '<span class="pill bad">Pendente</span>';
}

function formatarDataCurta(valor) {
    if (!valor) return '';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return '';
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function situacaoPlanoDetalhada(cliente) {
    const status = String(cliente?.plano || 'avulso').toLowerCase();
    const vencimento = cliente?.planoVenceEm ? new Date(cliente.planoVenceEm) : null;
    const venceu = vencimento && !Number.isNaN(vencimento.getTime()) && vencimento < new Date();
    const planoAtual = PLANOS_GB.find(plano => plano.id === cliente?.planoTipo);
    const nomePlano = planoAtual?.nome || (status === 'avulso' ? 'Nenhum plano ativo' : 'Goiano\'s Club');
    const vencimentoTexto = formatarDataCurta(cliente?.planoVenceEm);

    if (status === 'cancelado') {
        return { rotulo: 'Cancelado', classe: 'neutral', titulo: nomePlano, detalhe: 'Plano encerrado. Nova contratação somente presencial.' };
    }
    if (status === 'pendente') {
        return { rotulo: 'Não pago', classe: 'bad', titulo: nomePlano, detalhe: 'Pagamento pendente. Regularização somente presencial.' };
    }
    if (status === 'ativo' && venceu) {
        return { rotulo: 'Vencido', classe: 'warn', titulo: nomePlano, detalhe: `Venceu em ${vencimentoTexto}. Renove presencialmente.` };
    }
    if (status === 'ativo') {
        return { rotulo: 'Pago', classe: 'ok', titulo: nomePlano, detalhe: vencimentoTexto ? `Ativo até ${vencimentoTexto}.` : 'Plano ativo no cadastro.' };
    }
    return { rotulo: 'Sem plano', classe: 'neutral', titulo: 'Cliente avulso', detalhe: 'Ainda não há Goiano\'s Club ativo neste cadastro.' };
}

function atendimentosHoje() {
    const hoje = new Date().toISOString().slice(0, 10);
    return estado.atendimentos.filter(a => String(a.fimEm || '').slice(0, 10) === hoje);
}

function atualizarRelogios() {
    document.querySelectorAll('[data-tempo]').forEach(el => el.textContent = duracao(el.dataset.tempo));
    const adminVisivel = !document.getElementById('app-admin')?.classList.contains('hidden');
    if (adminVisivel && (abaAtual === 'dashboard' || abaAtual === 'tv')) renderTudo();
}

function setText(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
}
function renderLista(id, itens, fn) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = itens.length ? itens.map(fn).join('') : vazio('Nada por aqui agora.');
}
function vazio(texto) { return `<p class="muted">${texto}</p>`; }
function escapeHtml(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    }[caractere]));
}
function escapeAttr(valor) {
    return escapeHtml(valor).replace(/`/g, '&#096;');
}
function estrelasHtml(total = 5) {
    const qtd = Math.max(1, Math.min(5, Number(total) || 5));
    return Array.from({ length: 5 }, (_, i) => `<i data-lucide="star" class="${i < qtd ? 'filled' : ''}"></i>`).join('');
}

function abrirTotemPublico() {
    if (!usuarioLogado) mostrarLogin();
    else abrirAba('totem', document.querySelector('[onclick*="totem"]'));
}

function alternarMapaGoianos(modo, botao) {
    const mapa3d = document.getElementById('mapa-goianos-3d');
    const mapa2d = document.getElementById('mapa-goianos-2d');
    if (!mapa3d || !mapa2d) return;

    const usar3d = modo === '3d';
    mapa3d.classList.toggle('hidden', !usar3d);
    mapa2d.classList.toggle('hidden', usar3d);

    document.querySelectorAll('.map-toggle').forEach(item => {
        item.classList.toggle('active', item === botao || item.dataset.mapMode === modo);
    });
}

function abrirConsultaPlano() {
    abrirModal(`
        <p class="eyebrow">Consultar plano</p>
        <h2>Consulte seu Goiano's Club</h2>
        <div class="form-stack">
            <label>Telefone<input id="consulta-telefone" class="input-estilizado" inputmode="numeric" placeholder="(062) 99999-9999"></label>
            <button class="btn btn-primary" onclick="consultarPlano()">Ver meu plano</button>
            <div id="consulta-resultado"></div>
        </div>`);
}

function abrirFluxoAvaliacao() {
    fluxoAvaliacaoAtual = { tipo: 'criar', avaliacaoId: null };
    abrirModal(`
        <div class="review-start-panel">
            <div class="review-start-icon"><i data-lucide="star"></i></div>
            <p class="eyebrow">Sua opinião</p>
            <h2>Conte como foi sua experiência</h2>
            <p class="muted">Localizamos seu cadastro pelo telefone e confirmamos por e-mail antes de publicar.</p>
        </div>
        <div class="review-trust-note">
            <i data-lucide="mail-check"></i>
            <span>A confirmação é gratuita e ajuda a manter avaliações reais.</span>
        </div>
        <div class="form-stack review-start-form">
            <label>Telefone<input id="avaliacao-telefone" class="input-estilizado" inputmode="numeric" placeholder="(062) 99999-9999"></label>
            <button class="btn btn-primary" onclick="confirmarTelefoneAvaliacao(this)">Continuar avaliação</button>
        </div>`);
}

function confirmarTelefoneAvaliacao(botao = null) {
    const telefone = telefoneLimpo(document.getElementById('avaliacao-telefone').value);
    if (!telefone) return showToast('Informe o telefone.', 'error');
    const cliente = estado.clientes.find(c => telefoneLimpo(c.telefone) === telefone);
    if (!cliente && fluxoAvaliacaoAtual.tipo === 'editar') {
        return abrirModalAvaliacaoNaoEncontrada('Não encontramos um perfil com este telefone. Somente clientes com avaliação cadastrada podem editar.');
    }
    if (cliente?.email) return enviarCodigoAvaliacao({ clienteId: cliente.id, telefone, nome: cliente.nome, email: cliente.email, fluxo: fluxoAvaliacaoAtual.tipo, avaliacaoId: fluxoAvaliacaoAtual.avaliacaoId }, botao);
    if (cliente) return abrirCadastroEmailAvaliacao(cliente);

    if (fluxoAvaliacaoAtual.tipo === 'editar') {
        return abrirModalAvaliacaoNaoEncontrada('Este telefone ainda não possui avaliação para editar.');
    }

    abrirModal(`
        <p class="eyebrow">Cadastro rápido</p>
        <h2>Como seu nome deve aparecer?</h2>
        <p class="muted">Para evitar avaliação falsa, vamos enviar um código gratuito para seu e-mail.</p>
        <div class="form-stack">
            <label>Nome que aparecerá na avaliação<input id="avaliacao-nome-cadastro" class="input-estilizado" placeholder="Ex: João Silva"></label>
            <label>E-mail para confirmação<input id="avaliacao-email-cadastro" class="input-estilizado" type="email" placeholder="seuemail@exemplo.com"></label>
            <input id="avaliacao-telefone-cadastro" type="hidden" value="${telefone}">
            <button class="btn btn-primary" onclick="cadastrarClienteParaAvaliacao(this)">Enviar código por e-mail</button>
        </div>`);
}

function cadastrarClienteParaAvaliacao(botao = null) {
    const nome = document.getElementById('avaliacao-nome-cadastro').value.trim();
    const email = document.getElementById('avaliacao-email-cadastro').value.trim().toLowerCase();
    const telefone = document.getElementById('avaliacao-telefone-cadastro').value;
    if (!nome) return showToast('Informe seu nome.', 'error');
    if (!emailValido(email)) return showToast('Informe um e-mail válido.', 'error');
    enviarCodigoAvaliacao({ telefone, nome, email, novoCadastro: true }, botao);
}

function abrirModalAvaliacaoNaoEncontrada(mensagem) {
    abrirModal(`
        <div class="modal-head-clean">
            <p class="eyebrow">Avaliação não localizada</p>
            <h2>Não foi possível continuar</h2>
            <p class="muted">${escapeHtml(mensagem)}</p>
        </div>
        <div class="notice-box">
            Para criar uma nova avaliação, use o botão "Deixar avaliação". Para editar, confirme o telefone do mesmo cadastro usado na avaliação original.
        </div>
        <div class="form-stack">
            <button class="btn btn-soft" onclick="fecharModal()">Entendi</button>
        </div>`);
}

function abrirCadastroEmailAvaliacao(cliente) {
    abrirModal(`
        <p class="eyebrow">Perfil localizado</p>
        <h2>Dados protegidos pela barbearia</h2>
        <p class="muted">Encontramos o cadastro de ${escapeHtml(cliente.nome)}. Como este perfil já existe, nome, telefone e e-mail só podem ser alterados pelo barbeiro ou administrador.</p>
        <div class="profile-lock">
            <span><strong>Cliente</strong>${escapeHtml(cliente.nome)}</span>
            <span><strong>Telefone</strong>${escapeHtml(formatarTelefone(cliente.telefone))}</span>
            <span><strong>E-mail</strong>Não cadastrado</span>
        </div>
        <div class="notice-box">
            Peça para um barbeiro adicionar o e-mail no painel administrativo para liberar avaliações verificadas neste perfil.
        </div>
        <div class="form-stack">
            <button class="btn btn-soft" onclick="fecharModal()">Entendi</button>
        </div>`);
}

function enviarCodigoEmailCadastro(clienteId) {
    showToast('Dados de perfil só podem ser alterados pela barbearia.', 'error');
}

function iniciarCarregamentoBotao(botao, texto = 'Aguarde...') {
    if (!botao || botao.dataset.loading === 'true') return false;
    botao.dataset.loading = 'true';
    botao.dataset.originalHtml = botao.innerHTML;
    botao.disabled = true;
    botao.classList.add('btn-loading');
    botao.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span>${texto}`;
    return true;
}

function encerrarCarregamentoBotao(botao) {
    if (!botao || botao.dataset.loading !== 'true') return;
    botao.innerHTML = botao.dataset.originalHtml || botao.textContent;
    botao.disabled = false;
    botao.classList.remove('btn-loading');
    delete botao.dataset.loading;
    delete botao.dataset.originalHtml;
}

async function enviarCodigoAvaliacao(dados, botao = null) {
    if (botao?.dataset.loading === 'true') return;
    iniciarCarregamentoBotao(botao, 'Enviando...');
    if (!supabaseGb?.auth?.signInWithOtp) {
        encerrarCarregamentoBotao(botao);
        return showToast('Confirmação gratuita por e-mail indisponível. Verifique a conexão com o Supabase.', 'error');
    }

    avaliacaoPendente = dados;

    let error = null;
    try {
        const resultado = await supabaseGb.auth.signInWithOtp({
            email: dados.email,
            options: { shouldCreateUser: false },
        });
        error = resultado.error;
    } catch (erroRede) {
        console.warn('Erro de rede ao enviar código.', erroRede);
        encerrarCarregamentoBotao(botao);
        return showToast('Não foi possível conectar para enviar o código. Tente novamente.', 'error');
    }

    if (error) {
        console.warn('Erro ao enviar código de confirmação.', error);
        encerrarCarregamentoBotao(botao);
        return showToast('Não foi possível enviar o código. Confira o e-mail e tente novamente.', 'error');
    }

    abrirModalCodigoAvaliacao(dados.email);
}

function abrirModalCodigoAvaliacao(email) {
    const rotuloConfirmacao = avaliacaoPendente?.fluxo === 'plano' ? 'Confirmar e continuar plano' : 'Confirmar e escrever avaliação';
    abrirModal(`
        <div class="modal-head-clean">
            <p class="eyebrow">Código de confirmação</p>
            <h2>Confira seu e-mail</h2>
            <p class="muted">Enviamos um código gratuito para ${escapeHtml(mascararEmail(email))}. Digite os números recebidos para continuar.</p>
        </div>
        <div class="form-stack">
            <label>Código
                <div class="otp-entry" onclick="focarCodigoAvaliacao(event)">
                    <span class="otp-letter" aria-hidden="true">G</span>
                    <span class="otp-letter" aria-hidden="true">B</span>
                    <span class="otp-separator" aria-hidden="true">-</span>
                    <input class="otp-cell" maxlength="1" inputmode="numeric" autocomplete="one-time-code" oninput="digitarCodigoAvaliacao(this, 0)" onkeydown="navegarCodigoAvaliacao(event, 0)" onpaste="colarCodigoAvaliacao(event)">
                    <input class="otp-cell" maxlength="1" inputmode="numeric" autocomplete="one-time-code" oninput="digitarCodigoAvaliacao(this, 1)" onkeydown="navegarCodigoAvaliacao(event, 1)" onpaste="colarCodigoAvaliacao(event)">
                    <input class="otp-cell" maxlength="1" inputmode="numeric" autocomplete="one-time-code" oninput="digitarCodigoAvaliacao(this, 2)" onkeydown="navegarCodigoAvaliacao(event, 2)" onpaste="colarCodigoAvaliacao(event)">
                    <input class="otp-cell" maxlength="1" inputmode="numeric" autocomplete="one-time-code" oninput="digitarCodigoAvaliacao(this, 3)" onkeydown="navegarCodigoAvaliacao(event, 3)" onpaste="colarCodigoAvaliacao(event)">
                    <input class="otp-cell" maxlength="1" inputmode="numeric" autocomplete="one-time-code" oninput="digitarCodigoAvaliacao(this, 4)" onkeydown="navegarCodigoAvaliacao(event, 4)" onpaste="colarCodigoAvaliacao(event)">
                    <input class="otp-cell" maxlength="1" inputmode="numeric" autocomplete="one-time-code" oninput="digitarCodigoAvaliacao(this, 5)" onkeydown="navegarCodigoAvaliacao(event, 5)" onpaste="colarCodigoAvaliacao(event)">
                </div>
                <input id="avaliacao-codigo-email" type="hidden">
            </label>
            <p class="muted otp-help">Cole o código completo do e-mail no formato GB-123456.</p>
            <button class="btn btn-primary" onclick="confirmarCodigoAvaliacao(this)">${rotuloConfirmacao}</button>
            <button class="btn btn-soft" onclick="enviarCodigoAvaliacao(avaliacaoPendente, this)">Reenviar código</button>
        </div>`);
    setTimeout(focarCodigoAvaliacao, 60);
}

function atualizarCodigoAvaliacao() {
    const codigo = [...document.querySelectorAll('.otp-cell')].map(input => input.value).join('');
    const alvo = document.getElementById('avaliacao-codigo-email');
    if (alvo) alvo.value = codigo;
}

function focarCodigoAvaliacao(evento) {
    if (evento?.target?.classList?.contains('otp-cell')) {
        evento.target.select();
        return;
    }
    const primeiraVazia = [...document.querySelectorAll('.otp-cell')].find(input => !input.value);
    (primeiraVazia || document.querySelector('.otp-cell'))?.focus();
}

function digitarCodigoAvaliacao(input, indice) {
    const digitos = input.value.replace(/\D/g, '');
    input.value = digitos.slice(-1);
    atualizarCodigoAvaliacao();
    if (input.value) document.querySelectorAll('.otp-cell')[indice + 1]?.focus();
}

function navegarCodigoAvaliacao(evento, indice) {
    const campos = document.querySelectorAll('.otp-cell');
    if (evento.key === 'Backspace') {
        evento.preventDefault();
        if (campos[indice].value) {
            campos[indice].value = '';
            atualizarCodigoAvaliacao();
            return;
        }
        const anterior = campos[indice - 1];
        if (anterior) {
            anterior.value = '';
            anterior.focus();
            atualizarCodigoAvaliacao();
        }
        return;
    }
    if (evento.key === 'ArrowLeft') campos[indice - 1]?.focus();
    if (evento.key === 'ArrowRight') campos[indice + 1]?.focus();
}

function colarCodigoAvaliacao(evento) {
    evento.preventDefault();
    const digitos = evento.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const campos = document.querySelectorAll('.otp-cell');
    digitos.split('').forEach((digito, indice) => {
        if (campos[indice]) campos[indice].value = digito;
    });
    atualizarCodigoAvaliacao();
    campos[Math.min(digitos.length, campos.length - 1)]?.focus();
}

async function confirmarCodigoAvaliacao(botao = null) {
    if (botao?.dataset.loading === 'true') return;
    atualizarCodigoAvaliacao();
    const codigo = document.getElementById('avaliacao-codigo-email').value.trim();
    if (!avaliacaoPendente) return showToast('Solicite um novo código.', 'error');
    if (codigo.length < 4) return showToast('Informe o código recebido por e-mail.', 'error');

    iniciarCarregamentoBotao(botao, 'Confirmando...');
    let error = null;
    try {
        const resultadoEmail = await supabaseGb.auth.verifyOtp({
            email: avaliacaoPendente.email,
            token: codigo,
            type: 'email',
        });
        error = resultadoEmail.error;

        if (error && avaliacaoPendente.novoCadastro) {
            const resultadoSignup = await supabaseGb.auth.verifyOtp({
                email: avaliacaoPendente.email,
                token: codigo,
                type: 'signup',
            });
            error = resultadoSignup.error;
        }
    } catch (erroRede) {
        console.warn('Erro de rede ao confirmar código.', erroRede);
        encerrarCarregamentoBotao(botao);
        return showToast('Não foi possível confirmar agora. Verifique a conexão e tente novamente.', 'error');
    }

    if (error) {
        console.warn('Código inválido.', error);
        encerrarCarregamentoBotao(botao);
        return showToast('Código inválido ou expirado.', 'error');
    }

    let cliente = avaliacaoPendente.clienteId ? clientePorId(avaliacaoPendente.clienteId) : null;
    if (!cliente) {
        cliente = {
            id: crypto.randomUUID(),
            nome: avaliacaoPendente.nome,
            telefone: avaliacaoPendente.telefone,
            email: avaliacaoPendente.email,
            plano: 'avulso',
            planoVenceEm: null,
        };
        estado.clientes.push(cliente);
    }

    salvarEstado();
    if (avaliacaoPendente.fluxo === 'plano') {
        return abrirAvisoPlanoPresencial(cliente, avaliacaoPendente.planoInicial || 'combo');
    }
    if (avaliacaoPendente.fluxo === 'editar') {
        return abrirModalEditarAvaliacao(cliente);
    }
    if (avaliacaoDoCliente(cliente)) {
        return abrirModalAvaliacaoJaExiste(cliente);
    }
    abrirModalAvaliacao(cliente);
}

function avaliacaoDoCliente(cliente, avaliacaoPreferidaId = null) {
    const avaliacoes = estado.avaliacoes || [];
    const telefone = telefoneLimpo(cliente?.telefone);
    if (avaliacaoPreferidaId) {
        const preferida = avaliacoes.find(avaliacao => avaliacao.id === avaliacaoPreferidaId);
        if (preferida && (preferida.clienteId === cliente?.id || telefoneLimpo(preferida.telefone) === telefone)) return preferida;
    }
    return avaliacoes.find(avaliacao => avaliacao.clienteId === cliente?.id || telefoneLimpo(avaliacao.telefone) === telefone);
}

function abrirModalEditarAvaliacao(cliente) {
    const avaliacao = avaliacaoDoCliente(cliente, avaliacaoPendente?.avaliacaoId);
    if (!avaliacao) {
        return abrirModalAvaliacaoNaoEncontrada('Confirmamos seu e-mail, mas não encontramos uma avaliação vinculada a este cadastro.');
    }

    abrirModal(`
        <div class="modal-head-clean">
            <p class="eyebrow">Editar avaliação</p>
            <h2>${escapeHtml(cliente.nome)}</h2>
            <p class="muted">Perfil confirmado. Você pode atualizar somente a nota e a mensagem da sua avaliação.</p>
        </div>
        <div class="profile-lock">
            <span><strong>Cliente</strong>${escapeHtml(cliente.nome)}</span>
            <span><strong>Telefone</strong>${escapeHtml(formatarTelefone(cliente.telefone))}</span>
            <span><strong>Plano</strong>${rotuloPlano(cliente)}</span>
        </div>
        <div class="form-stack">
            <label>Sua nota
                <select id="avaliacao-estrelas" class="input-estilizado">
                    <option value="5" ${Number(avaliacao.estrelas) === 5 ? 'selected' : ''}>5 estrelas</option>
                    <option value="4" ${Number(avaliacao.estrelas) === 4 ? 'selected' : ''}>4 estrelas</option>
                    <option value="3" ${Number(avaliacao.estrelas) === 3 ? 'selected' : ''}>3 estrelas</option>
                    <option value="2" ${Number(avaliacao.estrelas) === 2 ? 'selected' : ''}>2 estrelas</option>
                    <option value="1" ${Number(avaliacao.estrelas) === 1 ? 'selected' : ''}>1 estrela</option>
                </select>
            </label>
            <label>Mensagem da avaliação
                <textarea id="avaliacao-texto" class="input-estilizado review-textarea" placeholder="Conte o que você achou do atendimento, do ambiente e do resultado.">${escapeHtml(avaliacao.texto || '')}</textarea>
            </label>
            <label>Barbeiro mencionado
                <select id="avaliacao-barbeiro-alvo" class="input-estilizado">
                    ${opcoesBarbeirosAvaliacao(avaliacao.barbeiroAlvoId || '')}
                </select>
            </label>
            <div class="notice-box review-target-note">
                A escolha do barbeiro é opcional. Se você selecionar alguém, o card público mostrará essa menção. Se deixar em branco, sua avaliação será exibida como uma opinião geral sobre a Goianos Barbearia.
            </div>
            <button class="btn btn-primary" onclick="salvarEdicaoAvaliacao('${avaliacao.id}')">Salvar alterações</button>
        </div>`);
}

function abrirModalAvaliacaoJaExiste(cliente) {
    const avaliacao = avaliacaoDoCliente(cliente);
    abrirModal(`
        <div class="modal-head-clean">
            <p class="eyebrow">Avaliação já cadastrada</p>
            <h2>Você já deixou sua opinião</h2>
            <p class="muted">Perfil confirmado. Para evitar avaliações duplicadas, você pode editar a avaliação existente.</p>
        </div>
        <div class="notice-box">
            A avaliação atual tem ${Number(avaliacao?.estrelas || 0)} estrela(s). Clique abaixo para atualizar a nota ou a mensagem.
        </div>
        <div class="form-stack">
            <button class="btn btn-primary" onclick="abrirModalEditarAvaliacao(clientePorId('${cliente.id}'))">Editar avaliação</button>
            <button class="btn btn-soft" onclick="fecharModal()">Agora não</button>
        </div>`);
}

function abrirModalAvaliacao(cliente) {
    abrirModal(`
        <div class="modal-head-clean">
            <p class="eyebrow">Avaliação verificada</p>
            <h2>Como foi sua experiência?</h2>
            <p class="muted">Seu perfil foi confirmado. Os dados de cadastro ficam bloqueados e só podem ser alterados pela barbearia.</p>
        </div>
        <div class="profile-lock">
            <span><strong>Cliente</strong>${escapeHtml(cliente.nome)}</span>
            <span><strong>Telefone</strong>${escapeHtml(formatarTelefone(cliente.telefone))}</span>
            <span><strong>Plano</strong>${rotuloPlano(cliente)}</span>
        </div>
        <div class="form-stack">
            <label>Sua nota
                <select id="avaliacao-estrelas" class="input-estilizado">
                    <option value="5">5 estrelas</option>
                    <option value="4">4 estrelas</option>
                    <option value="3">3 estrelas</option>
                    <option value="2">2 estrelas</option>
                    <option value="1">1 estrela</option>
                </select>
            </label>
            <label>Mensagem da avaliação
                <textarea id="avaliacao-texto" class="input-estilizado review-textarea" placeholder="Conte o que você achou do atendimento, do ambiente e do resultado."></textarea>
            </label>
            <label>Deseja mencionar um barbeiro?
                <select id="avaliacao-barbeiro-alvo" class="input-estilizado">
                    ${opcoesBarbeirosAvaliacao('')}
                </select>
            </label>
            <div class="notice-box review-target-note">
                Esse campo é opcional. Escolha um barbeiro apenas se sua avaliação for direcionada ao atendimento dele; se não escolher ninguém, o card ficará como uma avaliação geral da barbearia.
            </div>
            <button class="btn btn-primary" onclick="salvarAvaliacao('${cliente.id}')">Enviar avaliação</button>
        </div>`);
}

function opcoesBarbeirosAvaliacao(selecionado = '') {
    const barbeiros = (estado.barbeiros || []).filter(barbeiro => barbeiro.ativo !== false);
    return `
        <option value="" ${!selecionado ? 'selected' : ''}>Sem barbeiro específico</option>
        ${barbeiros.map(barbeiro => `<option value="${barbeiro.id}" ${selecionado === barbeiro.id ? 'selected' : ''}>${escapeHtml(barbeiro.nome)}</option>`).join('')}`;
}

function barbeiroAlvoSelecionado() {
    const barbeiroId = document.getElementById('avaliacao-barbeiro-alvo')?.value || '';
    const barbeiro = barbeiroId ? barbeiroPorId(barbeiroId) : null;
    return {
        barbeiroAlvoId: barbeiro?.id || '',
        barbeiroAlvoNome: barbeiro?.nome || '',
    };
}

function salvarAvaliacao(clienteId) {
    const cliente = clientePorId(clienteId);
    if (!cliente) return showToast('Cadastro não localizado. Procure a barbearia.', 'error');
    const nome = cliente.nome || 'Cliente GB';
    const texto = document.getElementById('avaliacao-texto').value.trim();
    const estrelas = Number(document.getElementById('avaliacao-estrelas').value || 5);
    const barbeiroAlvo = barbeiroAlvoSelecionado();
    if (texto.length < 12) return showToast('Escreva um pouco mais sobre sua experiência.', 'error');
    if (contemConteudoOfensivo(`${nome} ${texto}`)) return showToast('Ajuste a mensagem para manter uma avaliação respeitosa.', 'error');

    estado.avaliacoes = estado.avaliacoes || [];
    estado.avaliacoes.unshift({
        id: crypto.randomUUID(),
        clienteId,
        nome,
        telefone: cliente?.telefone || '',
        estrelas,
        texto,
        ...barbeiroAlvo,
        criadoEm: agoraIso(),
    });
    fecharModal();
    salvarEstado();
    showToast('Avaliação enviada. Obrigado por compartilhar sua experiência!', 'success');
}

function salvarEdicaoAvaliacao(avaliacaoId) {
    const avaliacao = (estado.avaliacoes || []).find(item => item.id === avaliacaoId);
    if (!avaliacao) return showToast('Avaliação não localizada.', 'error');
    const cliente = clientePorId(avaliacao.clienteId);
    const nome = cliente?.nome || avaliacao.nome || 'Cliente GB';
    const texto = document.getElementById('avaliacao-texto').value.trim();
    const estrelas = Number(document.getElementById('avaliacao-estrelas').value || 5);
    const barbeiroAlvo = barbeiroAlvoSelecionado();
    if (texto.length < 12) return showToast('Escreva um pouco mais sobre sua experiência.', 'error');
    if (contemConteudoOfensivo(`${nome} ${texto}`)) return showToast('Ajuste a mensagem para manter uma avaliação respeitosa.', 'error');

    avaliacao.nome = nome;
    avaliacao.telefone = cliente?.telefone || avaliacao.telefone || '';
    avaliacao.estrelas = estrelas;
    avaliacao.texto = texto;
    avaliacao.barbeiroAlvoId = barbeiroAlvo.barbeiroAlvoId;
    avaliacao.barbeiroAlvoNome = barbeiroAlvo.barbeiroAlvoNome;
    avaliacao.atualizadoEm = agoraIso();
    fecharModal();
    salvarEstado();
    showToast('Avaliação atualizada com sucesso.', 'success');
}

function consultarPlano() {
    const tel = telefoneLimpo(document.getElementById('consulta-telefone').value);
    const c = estado.clientes.find(x => telefoneLimpo(x.telefone) === tel);
    document.getElementById('consulta-resultado').innerHTML = c
        ? `<div class="plan-result list-item"><div><strong>${c.nome}</strong><small>${c.telefone}</small></div><span class="pill ${classePlano(c)}">${rotuloPlano(c)}</span></div>`
        : `<p class="muted">Não encontramos um plano vinculado a este telefone.</p>`;
}
function abrirModalAssinar(planoInicial = 'combo') {
    planoPendente = { planoInicial };
    abrirModal(`
        <div class="plan-start-panel">
            <div class="plan-start-icon"><i data-lucide="badge-dollar-sign"></i></div>
            <p class="eyebrow">Plano GB</p>
            <h2>Confirme seu telefone</h2>
            <p class="muted">Vamos localizar seu cadastro e enviar a confirmação gratuita por e-mail antes de orientar o atendimento presencial.</p>
        </div>
        <div class="plan-start-note">
            <i data-lucide="shield-check"></i>
            <span>Plano, alteração e cancelamento são finalizados somente na barbearia.</span>
        </div>
        <div class="form-stack plan-start-form">
            <label>Telefone<input id="plano-telefone" class="input-estilizado" inputmode="numeric" placeholder="(062) 99999-9999"></label>
            <button class="btn btn-primary" onclick="confirmarTelefonePlano(this)">Continuar plano</button>
        </div>`);
}

function confirmarTelefonePlano(botao = null) {
    const telefone = telefoneLimpo(document.getElementById('plano-telefone').value);
    if (!telefone) return showToast('Informe o telefone.', 'error');
    const cliente = estado.clientes.find(c => telefoneLimpo(c.telefone) === telefone);
    if (cliente?.email) {
        return enviarCodigoAvaliacao({
            clienteId: cliente.id,
            telefone,
            nome: cliente.nome,
            email: cliente.email,
            fluxo: 'plano',
            planoInicial: planoPendente.planoInicial,
        }, botao);
    }
    if (cliente) return abrirCadastroEmailAvaliacao(cliente);

    abrirModal(`
        <p class="eyebrow">Cadastro rápido</p>
        <h2>Dados para iniciar seu plano</h2>
        <p class="muted">Vamos enviar um código gratuito para seu e-mail antes de mostrar como finalizar o plano presencialmente.</p>
        <div class="form-stack">
            <label>Nome<input id="plano-nome-cadastro" class="input-estilizado" placeholder="Ex: João Silva"></label>
            <label>E-mail para confirmação<input id="plano-email-cadastro" class="input-estilizado" type="email" placeholder="seuemail@exemplo.com"></label>
            <input id="plano-telefone-cadastro" type="hidden" value="${telefone}">
            <button class="btn btn-primary" onclick="cadastrarClienteParaPlano(this)">Enviar código por e-mail</button>
        </div>`);
}

function cadastrarClienteParaPlano(botao = null) {
    const nome = document.getElementById('plano-nome-cadastro').value.trim();
    const email = document.getElementById('plano-email-cadastro').value.trim().toLowerCase();
    const telefone = document.getElementById('plano-telefone-cadastro').value;
    if (!nome) return showToast('Informe seu nome.', 'error');
    if (!emailValido(email)) return showToast('Informe um e-mail válido.', 'error');
    enviarCodigoAvaliacao({
        telefone,
        nome,
        email,
        novoCadastro: true,
        fluxo: 'plano',
        planoInicial: planoPendente.planoInicial,
    }, botao);
}

function abrirAvisoPlanoPresencial(cliente, planoInicial = 'combo') {
    const planoDesejado = PLANOS_GB.find(plano => plano.id === planoInicial) || PLANOS_GB[0];
    const situacao = situacaoPlanoDetalhada(cliente);
    abrirModal(`
        <div class="plan-presential-panel">
            <div class="plan-presential-icon"><i data-lucide="store"></i></div>
            <p class="eyebrow">Plano GB verificado</p>
            <h2>Agora é só passar na barbearia</h2>
            <p class="muted">
                Confirmamos seu cadastro, mas a contratação, troca ou cancelamento do Goiano's Club é feita presencialmente para proteger seus dados e finalizar o pagamento com a equipe.
            </p>
            <div class="plan-status-grid">
                <div class="plan-presential-choice">
                    <span>Plano desejado</span>
                    <strong>${escapeHtml(planoDesejado.nome)} - ${dinheiro(planoDesejado.valor)}/mês</strong>
                </div>
                <div class="plan-presential-choice plan-current-status">
                    <span>Situação atual</span>
                    <strong><em class="pill ${situacao.classe}">${situacao.rotulo}</em>${escapeHtml(situacao.titulo)}</strong>
                    <small>${escapeHtml(situacao.detalhe)}</small>
                </div>
            </div>
        </div>
        <div class="modal-actions-grid">
            <a class="btn btn-primary" href="https://maps.app.goo.gl/TCo9g1qx1W7uDYRs5" target="_blank" rel="noopener">Abrir localização</a>
            <button class="btn btn-soft" onclick="fecharModal()">Entendi</button>
        </div>`);
}

function assinarPlanoFake(clienteId) {
    const c = clientePorId(clienteId);
    if (!c) return showToast('Cadastro não localizado. Reinicie a confirmação.', 'error');
    showToast('Planos, alterações e cancelamentos só podem ser feitos presencialmente na barbearia.', 'error');
}

function alternarBarbeiroExpediente(id) {
    const b = barbeiroPorId(id);
    b.expediente = !b.expediente;
    salvarEstado();
}
function novoBarbeiro() {
    const nome = prompt('Nome do barbeiro:');
    if (!nome) return;
    estado.barbeiros.push({ id: crypto.randomUUID(), nome, ativo: true, expediente: true });
    salvarEstado();
}
function editarBarbeiro(id) {
    const b = barbeiroPorId(id);
    const nome = prompt('Novo nome:', b.nome);
    if (!nome) return;
    b.nome = nome;
    salvarEstado();
}
function excluirBarbeiro(id) {
    estado.barbeiros = estado.barbeiros.filter(b => b.id !== id);
    salvarEstado();
}

function abrirModalAcesso() {
    abrirModal(`
        <p class="eyebrow">Novo acesso</p>
        <h2>Criar usuário</h2>
        <div class="form-stack">
            <label>Nome<input id="acesso-nome" class="input-estilizado"></label>
            <label>Login<input id="acesso-login" class="input-estilizado"></label>
            <label>Perfil<select id="acesso-perfil" class="input-estilizado"><option value="admin">Administrador</option><option value="barbeiro">Barbeiro</option><option value="recepcao">Recepção</option></select></label>
            <button class="btn btn-primary" onclick="salvarAcesso()">Criar e copiar link</button>
        </div>`);
}
function salvarAcesso() {
    const nome = document.getElementById('acesso-nome').value.trim();
    const login = document.getElementById('acesso-login').value.trim();
    if (!nome || !login) return showToast('Preencha nome e login.', 'error');
    const acesso = { id: crypto.randomUUID(), nome, login, perfil: document.getElementById('acesso-perfil').value, ativo: true, senhaDefinida: false };
    estado.acessos.push(acesso);
    copiarLinkSenha(acesso.id);
    fecharModal();
    salvarEstado();
}
function copiarLinkSenha(id) {
    const link = `${location.origin}${location.pathname}?definir_senha=${id}&token=${crypto.randomUUID()}`;
    navigator.clipboard?.writeText(link);
    showToast('Link de definição de senha copiado.', 'success');
}
function resetarSenha(id) {
    const a = estado.acessos.find(x => x.id === id);
    if (a) a.senhaDefinida = false;
    copiarLinkSenha(id);
    salvarEstado();
}
function excluirAcesso(id) {
    estado.acessos = estado.acessos.filter(a => a.id !== id);
    salvarEstado();
}

function adicionarServico() {
    estado.servicos.push({ id: crypto.randomUUID(), nome: 'Novo serviço', valor: 0 });
    salvarEstado();
}
function atualizarServico(id, campo, valor) {
    const s = estado.servicos.find(x => x.id === id);
    if (!s) return;
    s[campo] = campo === 'valor' ? Number(valor) : valor;
    salvarEstado();
}
function removerServico(id) {
    estado.servicos = estado.servicos.filter(s => s.id !== id);
    salvarEstado();
}

function abrirTvEmNovaAba() {
    window.open(`${location.pathname}?tv=1`, '_blank');
}

function abrirModal(html) {
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal').classList.remove('hidden');
    lucide?.createIcons?.();
}
function fecharModal() {
    document.getElementById('modal').classList.add('hidden');
}
function showToast(msg) {
    const div = document.createElement('div');
    div.className = 'toast';
    div.textContent = msg;
    document.getElementById('toast-container').appendChild(div);
    setTimeout(() => div.remove(), 3200);
}
