// =========================================================
// 1. CONFIGURAÇÃO
// =========================================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Lista de teste (para facilitar sua vida)
const SUGGESTED_NICKS = [
    "zekas#2002",
    "han dao#EGC",
    "Flanelinha#Veig", 
    "MENTAL INABALADO#BR11", 
    "black sails#五星红旗"
];

const UI = {
    loading: document.getElementById('loadingScreen'),
    welcome: document.getElementById('welcomeMsg'),
    userDisplay: document.getElementById('userNickDisplay'),
    search: document.getElementById('playerSearch'),
    suggestions: document.getElementById('suggestionsBox'),
    logout: document.getElementById('logoutBtn'),
    // Cards e Gráfico
    winrate: document.getElementById('valWinrate'),
    kda: document.getElementById('valKDA'),
    champName: document.getElementById('txtMainChamp'),
    champImg: document.getElementById('imgMainChamp'),
    champStats: document.getElementById('txtMainChampStats'),
    chartCanvas: document.getElementById('resourceChart')
};

let chartInstance = null;

// =========================================================
// 2. INICIALIZAÇÃO
// =========================================================
async function init() {
    setupEventListeners();
    await checkSession();
}

function setupEventListeners() {
    UI.logout.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
    });

    // Busca ao Digitar ou Clicar
    UI.search.addEventListener('input', (e) => handleSearchInput(e.target.value));
    UI.search.addEventListener('focus', (e) => handleSearchInput(e.target.value));

    // Busca ao apertar ENTER
    UI.search.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && UI.search.value.length > 0) {
            fetchPlayerData(UI.search.value);
            UI.suggestions.style.display = 'none';
        }
    });
    
    // Fechar sugestões
    document.addEventListener('click', (e) => {
        if (!UI.search.contains(e.target) && !UI.suggestions.contains(e.target)) {
            UI.suggestions.style.display = 'none';
        }
    });
}

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = "index.html"; return; }

    const user = session.user;
    UI.userDisplay.innerText = user.user_metadata.full_name || "Invocador";
    UI.welcome.innerText = `Bem-vindo, ${user.user_metadata.lol_nick || "Jogador"}`;
    UI.loading.style.display = 'none';

    // Carrega o zekas como exemplo inicial
    fetchPlayerData("zekas#2002");
}

function handleSearchInput(termo) {
    termo = termo.toLowerCase();
    const filtrados = termo === "" 
        ? SUGGESTED_NICKS 
        : SUGGESTED_NICKS.filter(n => n.toLowerCase().includes(termo));

    UI.suggestions.innerHTML = '';
    if (filtrados.length > 0) {
        UI.suggestions.style.display = 'block';
        filtrados.forEach(nick => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerText = nick; // Mostra o nick simples
            div.addEventListener('click', () => {
                UI.search.value = nick;
                fetchPlayerData(nick);
                UI.suggestions.style.display = 'none';
            });
            UI.suggestions.appendChild(div);
        });
    } else {
        UI.suggestions.style.display = 'none';
    }
}

// =========================================================
// 3. A LÓGICA "EXCEL" (=FILTER)
// =========================================================

async function fetchPlayerData(nickPesquisado) {
    UI.welcome.innerText = `Buscando: ${nickPesquisado}...`;
    UI.welcome.style.color = "#c8aa6e";

    try {
        // 1. Busca TUDO que parece com o nick (ILOIKE é flexível)
        const { data, error } = await supabaseClient
            .from('partidas_br')
            .select('*')
            .ilike('Player Name', `%${nickPesquisado}%`);

        if (error) throw error;
        
        if (!data || data.length === 0) {
            UI.welcome.innerText = `Nenhum dado encontrado.`;
            UI.welcome.style.color = "#ff4d4d";
            return;
        }

        // 2. APLICANDO O FILTRO EXATO (=FILTER)
        // Aqui garantimos que só pegamos as linhas onde o nome é IGUAL ao que queremos.
        // Convertemos para minúsculo para garantir que "Zekas" e "zekas" sejam iguais.
        const dadosDoJogador = data.filter(linha => 
            linha['Player Name'].toLowerCase().includes(nickPesquisado.toLowerCase())
        );

        if (dadosDoJogador.length === 0) {
            alert("Encontramos nomes parecidos, mas não esse exato.");
            return;
        }

        // 3. REMOVENDO DUPLICATAS (=UNIQUE)
        const partidasUnicas = [];
        const idsJaVistos = new Set();

        dadosDoJogador.forEach(partida => {
            const id = partida['Match ID'];
            // Se eu ainda não vi esse ID, adiciono na lista final
            if (!idsJaVistos.has(id)) {
                idsJaVistos.add(id);
                partidasUnicas.push(partida);
            }
        });

        console.log(`Dados limpos: ${partidasUnicas.length} partidas.`);

        // 4. ATUALIZA A TELA
        // Usamos o nome real da primeira partida encontrada para ficar bonito (Ex: Zekas#2002)
        const nomeReal = partidasUnicas[0]['Player Name'];
        updateDashboard(nomeReal, partidasUnicas);

    } catch (err) {
        console.error("Erro:", err);
        UI.welcome.innerText = "Erro ao carregar dados.";
    }
}

// =========================================================
// 4. ATUALIZAÇÃO DA TELA
// =========================================================

function updateDashboard(nick, matches) {
    // Calcula Estatísticas Básicas
    const total = matches.length;
    const wins = matches.filter(m => m['Win Rate %'] == 1).length;
    
    // KDA Médio
    let kdaSum = 0, kdaCount = 0;
    matches.forEach(m => {
        const k = parseFloat(m['KDA']);
        if (!isNaN(k)) { kdaSum += k; kdaCount++; }
    });
    
    // Main Champ (Campeão mais repetido na lista)
    const contagem = {};
    matches.forEach(m => {
        const c = m['Champion'];
        contagem[c] = (contagem[c] || 0) + 1;
    });
    const mainChamp = Object.keys(contagem).reduce((a, b) => contagem[a] > contagem[b] ? a : b);

    // Preenche os Textos
    UI.welcome.style.color = "#ffffff";
    UI.welcome.innerText = `Análise: ${nick}`;
    UI.winrate.innerText = ((wins / total) * 100).toFixed(0) + "%";
    UI.kda.innerText = kdaCount > 0 ? (kdaSum / kdaCount).toFixed(2) : "-";
    
    UI.champName.innerText = mainChamp;
    UI.champStats.innerText = `${contagem[mainChamp]} Partidas`;
    
    const cleanName = mainChamp.replace(/[^a-zA-Z0-9]/g, '');
    UI.champImg.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${cleanName}.png`;

    // Renderiza o Gráfico
    renderChart(matches);
}

function renderChart(matches) {
    // Transforma dados para o gráfico
    const chartData = matches.map(m => {
        const dmg = parseFloat(m['Damage/Min']) || 0;
        const gold = parseFloat(m['Gold/Min']) || 1;
        const eff = (dmg / gold) * 100; // Eficiência
        
        return {
            x: gold, 
            y: dmg, 
            r: (eff / 6) < 5 ? 5 : (eff / 6), // Tamanho da bolha
            champ: m['Champion'],
            win: m['Win Rate %'] == 1,
            effText: eff.toFixed(0) + "%"
        };
    });

    // Separa Vitória/Derrota
    const wins = chartData.filter(d => d.win);
    const losses = chartData.filter(d => !d.win);

    // Prepara imagens
    const getImg = (n) => {
        const i = new Image();
        i.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${n.replace(/[^a-zA-Z0-9]/g, '')}.png`;
        return i;
    };
    wins.forEach(d => d.image = getImg(d.champ));
    losses.forEach(d => d.image = getImg(d.champ));

    const ctx = UI.chartCanvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();

    // Plugin para desenhar a imagem na bolha
    const imgPlugin = {
        id: 'customImage',
        afterDatasetDraw(chart, args) {
            const { ctx } = chart;
            const meta = args.meta;
            meta.data.forEach((el, index) => {
                const d = chart.data.datasets[meta.index].data[index];
                if (!d.image || !d.image.complete) return;

                const { x, y } = el.getProps(['x', 'y'], true);
                const r = el.options.radius;

                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(d.image, x-r, y-r, r*2, r*2);
                
                ctx.lineWidth = 3;
                ctx.strokeStyle = d.win ? '#5383e8' : '#e84057';
                ctx.stroke();
                ctx.restore();
            });
        }
    };

    chartInstance = new Chart(ctx, {
        type: 'bubble',
        plugins: [imgPlugin],
        data: {
            datasets: [
                { label: 'Vitória', data: wins, backgroundColor: 'rgba(83, 131, 232, 0.1)', borderColor: 'transparent' },
                { label: 'Derrota', data: losses, backgroundColor: 'rgba(232, 64, 87, 0.1)', borderColor: 'transparent' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#13161d',
                    bodyColor: '#fff',
                    titleColor: '#c8aa6e',
                    callbacks: {
                        label: (c) => {
                            const d = c.raw;
                            return [` ${d.champ}`, ` Eficiência: ${d.effText}`, ` Dano: ${d.y.toFixed(0)}`, ` Gold: ${d.x.toFixed(0)}`];
                        }
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: 'Gold/Min' }, grid: { color: '#ffffff10' } },
                y: { title: { display: true, text: 'Dano/Min' }, grid: { color: '#ffffff10' } }
            }
        }
    });
    
    setTimeout(() => chartInstance.update(), 800);
}

// Inicia
init();
