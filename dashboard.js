// =========================================================
// 1. CONFIGURAÇÃO E CONSTANTES
// =========================================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc";

// Inicializa cliente Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Lista de nicks sugeridos (Hardcoded por enquanto)
const SUGGESTED_NICKS = [
    "Zekas#2002", "han dao#EGC", "Pilot#br11", "Celo#br2", "Gatovisck#愛憎の影"
];

// Elementos da UI (Cache para não buscar toda hora)
const UI = {
    loading: document.getElementById('loadingScreen'),
    welcome: document.getElementById('welcomeMsg'),
    userDisplay: document.getElementById('userNickDisplay'),
    search: document.getElementById('playerSearch'),
    suggestions: document.getElementById('suggestionsBox'),
    logout: document.getElementById('logoutBtn'),
    
    // Cards de Stats
    winrate: document.getElementById('valWinrate'),
    kda: document.getElementById('valKDA'),
    champName: document.getElementById('txtMainChamp'),
    champImg: document.getElementById('imgMainChamp'),
    champStats: document.getElementById('txtMainChampStats'),
    
    // Canvas do Gráfico
    chartCanvas: document.getElementById('resourceChart')
};

let chartInstance = null; // Variável global para guardar o gráfico

// =========================================================
// 2. INICIALIZAÇÃO E AUTENTICAÇÃO
// =========================================================

async function init() {
    setupEventListeners();
    await checkSession();
}

// Configura os cliques e inputs
function setupEventListeners() {
    // Logout
    UI.logout.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
    });

    // Busca (Autocomplete)
    UI.search.addEventListener('input', (e) => handleSearchInput(e.target.value));
    UI.search.addEventListener('focus', (e) => handleSearchInput(e.target.value));
    
    // Fechar sugestões ao clicar fora
    document.addEventListener('click', (e) => {
        if (!UI.search.contains(e.target) && !UI.suggestions.contains(e.target)) {
            UI.suggestions.style.display = 'none';
        }
    });
}

// Verifica se o usuário está logado
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = "index.html"; // Chuta pra fora se não logou
        return;
    }

    const user = session.user;
    const nick = user.user_metadata.lol_nick || "Sem Nick";
    
    // Atualiza UI inicial
    UI.userDisplay.innerText = user.user_metadata.full_name || "Invocador";
    UI.welcome.innerText = `Bem-vindo, ${nick}`;
    UI.loading.style.display = 'none';

    // Carrega um perfil padrão (ex: Zekas) para a tela não ficar vazia
    fetchPlayerData("Zekas#2002");
}

// =========================================================
// 3. LÓGICA DE BUSCA (AUTOCOMPLETE)
// =========================================================

function handleSearchInput(termo) {
    termo = termo.toLowerCase();
    
    // Filtra a lista
    const filtrados = termo === "" 
        ? SUGGESTED_NICKS 
        : SUGGESTED_NICKS.filter(n => n.toLowerCase().includes(termo));

    // Renderiza
    UI.suggestions.innerHTML = '';
    if (filtrados.length > 0) {
        filtrados.forEach(nick => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            const [name, tag] = nick.split('#');
            div.innerHTML = `<span>${name}</span><strong style="font-size:0.8rem; color:#666;">#${tag}</strong>`;
            
            div.addEventListener('click', () => {
                fetchPlayerData(nick);
                UI.search.value = nick;
                UI.suggestions.style.display = 'none';
            });
            UI.suggestions.appendChild(div);
        });
        UI.suggestions.style.display = 'block';
    } else {
        UI.suggestions.style.display = 'none';
    }
}

// =========================================================
// 4. CORE: BUSCA E PROCESSAMENTO DE DADOS
// =========================================================

async function fetchPlayerData(nick) {
    UI.welcome.innerText = `Carregando dados de ${nick}...`;

    try {
        // 1. Busca no Banco (Tabela 'partidas_br')
        const { data, error } = await supabaseClient
            .from('partidas_br')
            .select('*')
            .eq('Player Name', nick); // .eq é Exato, evita erros de nicks parecidos

        if (error) throw error;
        
        if (!data || data.length === 0) {
            alert("Nenhuma partida encontrada.");
            UI.welcome.innerText = `Sem dados para ${nick}`;
            return;
        }

        // 2. Limpeza de Dados (Remove Duplicatas por Match ID)
        const cleanData = removeDuplicates(data);
        console.log(`Partidas encontradas: ${data.length} | Únicas: ${cleanData.length}`);

        // 3. Calcula Estatísticas
        const stats = calculateStats(cleanData);

        // 4. Atualiza a Tela
        updateDashboard(nick, stats, cleanData);

    } catch (err) {
        console.error("Erro ao buscar dados:", err);
        alert("Erro técnico. Verifique o console.");
    }
}

// Remove partidas repetidas baseadas no Match ID
function removeDuplicates(data) {
    const uniqueMatches = [];
    const seenIds = new Set();

    data.forEach(match => {
        const id = match['Match ID'];
        if (!seenIds.has(id)) {
            seenIds.add(id);
            uniqueMatches.push(match);
        }
    });
    return uniqueMatches;
}

// Calcula médias e totais
function calculateStats(matches) {
    const total = matches.length;
    
    // Winrate (Win Rate % é 1 ou 0)
    const wins = matches.filter(m => m['Win Rate %'] == 1).length;
    const winrate = ((wins / total) * 100).toFixed(1);

    // KDA Médio
    let kdaSum = 0;
    let kdaCount = 0;
    matches.forEach(m => {
        const k = parseFloat(m['KDA']);
        if (!isNaN(k)) { kdaSum += k; kdaCount++; }
    });
    const avgKda = kdaCount > 0 ? (kdaSum / kdaCount).toFixed(2) : "-";

    // Campeão Mais Jogado
    const champCount = {};
    matches.forEach(m => {
        const c = m['Champion'];
        champCount[c] = (champCount[c] || 0) + 1;
    });
    // Pega o que tem maior número
    const mainChamp = Object.keys(champCount).reduce((a, b) => champCount[a] > champCount[b] ? a : b);

    return {
        totalGames: total,
        winrate: winrate + "%",
        kda: avgKda,
        mainChamp: mainChamp,
        mainChampGames: champCount[mainChamp]
    };
}

// =========================================================
// 5. ATUALIZAÇÃO VISUAL (UI & GRÁFICO)
// =========================================================

function updateDashboard(nick, stats, matches) {
    // Textos
    UI.welcome.innerText = `Análise: ${nick}`;
    UI.winrate.innerText = stats.winrate;
    UI.kda.innerText = stats.kda;
    
    // Card do Main Champ
    UI.champName.innerText = stats.mainChamp;
    UI.champStats.innerText = `${stats.mainChampGames} Partidas`;
    
    // Imagem do Champ (Tratamento para URL da Riot)
    const cleanName = stats.mainChamp.replace(/[^a-zA-Z0-9]/g, '');
    UI.champImg.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${cleanName}.png`;

    // Desenha o Gráfico
    renderBubbleChart(matches);
}

function renderBubbleChart(matches) {
    // Prepara os dados para o formato do Chart.js
    const chartData = matches.map(m => {
        const damage = parseFloat(m['Damage/Min']) || 0;
        const gold = parseFloat(m['Gold/Min']) || 1;
        const isWin = m['Win Rate %'] == 1;
        
        // Cálculo de Eficiência para Tamanho da Bolha
        const efficiency = (damage / gold) * 100; // Ex: 150%
        const radius = efficiency / 6; // Ajuste visual

        return {
            x: gold,    // Eixo X
            y: damage,  // Eixo Y
            r: radius < 5 ? 5 : radius, // Tamanho
            champ: m['Champion'],
            win: isWin,
            eff: efficiency.toFixed(0)
        };
    });

    // Separa em dois datasets para cores diferentes
    const wins = chartData.filter(d => d.win);
    const losses = chartData.filter(d => !d.win);

    // Função auxiliar para carregar imagem no canvas
    const getImg = (champName) => {
        const img = new Image();
        const clean = champName.replace(/[^a-zA-Z0-9]/g, '');
        img.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${clean}.png`;
        return img;
    };

    // Mapeia imagens para cada ponto
    wins.forEach(d => d.image = getImg(d.champ));
    losses.forEach(d => d.image = getImg(d.champ));

    // Configura o Canvas
    const ctx = UI.chartCanvas.getContext('2d');
    
    // Se já existe gráfico, destroi antes de criar novo
    if (chartInstance) chartInstance.destroy();

    // Plugin Customizado para desenhar imagens
    const imagePlugin = {
        id: 'customImage',
        afterDatasetDraw(chart, args) {
            const { ctx } = chart;
            const meta = args.meta;
            
            meta.data.forEach((element, index) => {
                const data = chart.data.datasets[meta.index].data[index];
                if (!data.image || !data.image.complete) return; // Se não carregou, ignora

                const { x, y } = element.getProps(['x', 'y'], true);
                const r = element.options.radius;

                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip(); // Corta em círculo
                ctx.drawImage(data.image, x - r, y - r, r * 2, r * 2);
                
                // Borda
                ctx.lineWidth = 3;
                ctx.strokeStyle = data.win ? '#5383e8' : '#e84057';
                ctx.stroke();
                ctx.restore();
            });
        }
    };

    // Cria o Gráfico
    chartInstance = new Chart(ctx, {
        type: 'bubble',
        plugins: [imagePlugin],
        data: {
            datasets: [
                {
                    label: 'Vitória',
                    data: wins,
                    backgroundColor: 'rgba(83, 131, 232, 0.1)',
                    borderColor: 'transparent'
                },
                {
                    label: 'Derrota',
                    data: losses,
                    backgroundColor: 'rgba(232, 64, 87, 0.1)',
                    borderColor: 'transparent'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#13161d',
                    titleColor: '#c8aa6e',
                    bodyColor: '#fff',
                    callbacks: {
                        label: (c) => {
                            const d = c.raw;
                            return [
                                ` ${d.champ}`,
                                ` Eficiência: ${d.eff}%`,
                                ` Dano/min: ${d.y.toFixed(0)}`,
                                ` Gold/min: ${d.x.toFixed(0)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: { 
                    title: { display: true, text: 'Gold/Min', color: '#666' },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y: { 
                    title: { display: true, text: 'Dano/Min', color: '#666' },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                }
            }
        }
    });
    
    // Força atualização quando as imagens carregarem
    setTimeout(() => chartInstance.update(), 500);
}

// Inicia tudo
init();
