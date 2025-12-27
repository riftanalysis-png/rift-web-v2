// =========================================================
// 1. CONFIGURAÇÃO E CONSTANTES
// =========================================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// SUGESTÕES BASEADAS NO SEU CSV (Para teste rápido)
const SUGGESTED_NICKS = [
    "han dao#EGC", 
    "Flanelinha#Veig", 
    "MENTAL INABALADO#BR11", 
    "TwTv dudahri#dudsz", 
    "black sails#五星红旗"
];

const UI = {
    loading: document.getElementById('loadingScreen'),
    welcome: document.getElementById('welcomeMsg'),
    userDisplay: document.getElementById('userNickDisplay'),
    search: document.getElementById('playerSearch'),
    suggestions: document.getElementById('suggestionsBox'),
    logout: document.getElementById('logoutBtn'),
    
    // Cards
    winrate: document.getElementById('valWinrate'),
    kda: document.getElementById('valKDA'),
    champName: document.getElementById('txtMainChamp'),
    champImg: document.getElementById('imgMainChamp'),
    champStats: document.getElementById('txtMainChampStats'),
    
    // Gráfico
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
    // Logout
    UI.logout.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
    });

    // --- CORREÇÃO DA BUSCA ---
    
    // 1. Ao digitar: mostra sugestões
    UI.search.addEventListener('input', (e) => handleSearchInput(e.target.value));
    
    // 2. Ao clicar na caixa: mostra sugestões
    UI.search.addEventListener('focus', (e) => handleSearchInput(e.target.value));

    // 3. (NOVO) Ao apertar ENTER: Busca o que estiver escrito!
    UI.search.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const termo = UI.search.value;
            if (termo.length > 0) {
                fetchPlayerData(termo); // Busca direta no banco
                UI.suggestions.style.display = 'none'; // Esconde sugestões
            }
        }
    });
    
    // Fecha sugestões ao clicar fora
    document.addEventListener('click', (e) => {
        if (!UI.search.contains(e.target) && !UI.suggestions.contains(e.target)) {
            UI.suggestions.style.display = 'none';
        }
    });
}

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = "index.html";
        return;
    }

    const user = session.user;
    UI.userDisplay.innerText = user.user_metadata.full_name || "Invocador";
    UI.welcome.innerText = `Bem-vindo, ${user.user_metadata.lol_nick || "Jogador"}`;
    UI.loading.style.display = 'none';

    // Carrega um perfil de exemplo que SABEMOS que existe no CSV
    fetchPlayerData("han dao#EGC");
}

// =========================================================
// 3. LÓGICA DE AUTOCOMPLETE
// =========================================================

function handleSearchInput(termo) {
    termo = termo.toLowerCase();
    
    // Filtra nossa lista de exemplos
    const filtrados = termo === "" 
        ? SUGGESTED_NICKS 
        : SUGGESTED_NICKS.filter(n => n.toLowerCase().includes(termo));

    UI.suggestions.innerHTML = '';
    
    if (filtrados.length > 0) {
        filtrados.forEach(nick => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            
            // Tenta separar Nome e Tag visualmente
            const parts = nick.split('#');
            const name = parts[0];
            const tag = parts[1] ? `#${parts[1]}` : '';

            div.innerHTML = `<span>${name}</span><strong style="font-size:0.8rem; color:#666;">${tag}</strong>`;
            
            div.addEventListener('click', () => {
                UI.search.value = nick; // Preenche a barra
                fetchPlayerData(nick);  // Busca
                UI.suggestions.style.display = 'none';
            });
            UI.suggestions.appendChild(div);
        });
        UI.suggestions.style.display = 'block';
    } else {
        // (Opcional) Poderia mostrar "Pressione Enter para buscar..."
        UI.suggestions.style.display = 'none';
    }
}

// =========================================================
// 4. BUSCA NO BANCO DE DADOS
// =========================================================

async function fetchPlayerData(nick) {
    // Feedback visual de que está buscando
    const originalText = UI.welcome.innerText;
    UI.welcome.innerText = `🔍 Buscando dados de: ${nick}...`;
    UI.welcome.style.color = "#c8aa6e"; // Dourado

    try {
        // 1. Busca na tabela 'partidas_br' (Use .ilike para ignorar maiúsculas)
        const { data, error } = await supabaseClient
            .from('partidas_br')
            .select('*')
            .ilike('Player Name', `%${nick}%`); // % permite busca parcial (ex: "han dao" acha "han dao#EGC")

        if (error) throw error;
        
        // 2. Verifica se achou algo
        if (!data || data.length === 0) {
            UI.welcome.innerText = `❌ Jogador não encontrado: ${nick}`;
            UI.welcome.style.color = "#ff4d4d";
            alert(`Não encontramos partidas para "${nick}" no banco de dados.`);
            return;
        }

        // 3. Remove Duplicatas (Match ID)
        const cleanData = removeDuplicates(data);
        console.log(`Encontrados: ${data.length} | Únicos: ${cleanData.length}`);

        // 4. Calcula e Atualiza
        const stats = calculateStats(cleanData);
        updateDashboard(cleanData[0]['Player Name'], stats, cleanData); // Usa o nome real achado no banco

    } catch (err) {
        console.error("Erro na busca:", err);
        UI.welcome.innerText = "Erro ao buscar dados.";
        alert("Erro técnico. Veja o console.");
    }
}

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

function calculateStats(matches) {
    const total = matches.length;
    const wins = matches.filter(m => m['Win Rate %'] == 1).length;
    
    // KDA
    let kdaSum = 0, kdaCount = 0;
    matches.forEach(m => {
        const k = parseFloat(m['KDA']);
        if (!isNaN(k)) { kdaSum += k; kdaCount++; }
    });
    
    // Main Champ
    const champCount = {};
    matches.forEach(m => {
        const c = m['Champion'];
        champCount[c] = (champCount[c] || 0) + 1;
    });
    const mainChamp = Object.keys(champCount).reduce((a, b) => champCount[a] > champCount[b] ? a : b);

    return {
        winrate: ((wins / total) * 100).toFixed(0) + "%",
        kda: kdaCount > 0 ? (kdaSum / kdaCount).toFixed(2) : "-",
        mainChamp: mainChamp,
        mainChampGames: champCount[mainChamp]
    };
}

// =========================================================
// 5. ATUALIZAÇÃO VISUAL
// =========================================================

function updateDashboard(realNick, stats, matches) {
    // Restaura cor e texto
    UI.welcome.style.color = "#ffffff";
    UI.welcome.innerText = `Análise: ${realNick}`;
    
    UI.winrate.innerText = stats.winrate;
    UI.kda.innerText = stats.kda;
    
    UI.champName.innerText = stats.mainChamp;
    UI.champStats.innerText = `${stats.mainChampGames} Partidas`;
    
    // Imagem do Champ
    const cleanName = stats.mainChamp.replace(/[^a-zA-Z0-9]/g, '');
    UI.champImg.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${cleanName}.png`;

    renderBubbleChart(matches);
}

function renderBubbleChart(matches) {
    const chartData = matches.map(m => {
        const dmg = parseFloat(m['Damage/Min']) || 0;
        const gold = parseFloat(m['Gold/Min']) || 1;
        const win = m['Win Rate %'] == 1;
        
        // Cálculo de Eficiência
        const eff = (dmg / gold) * 100;
        
        return {
            x: gold, 
            y: dmg, 
            r: (eff / 6) < 5 ? 5 : (eff / 6), // Tamanho
            champ: m['Champion'],
            win: win,
            effText: eff.toFixed(0) + "%"
        };
    });

    const wins = chartData.filter(d => d.win);
    const losses = chartData.filter(d => !d.win);

    const getImg = (name) => {
        const img = new Image();
        img.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${name.replace(/[^a-zA-Z0-9]/g, '')}.png`;
        return img;
    };
    
    // Pre-load images
    wins.forEach(d => d.image = getImg(d.champ));
    losses.forEach(d => d.image = getImg(d.champ));

    const ctx = UI.chartCanvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();

    // Plugin Imagem
    const imagePlugin = {
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
        plugins: [imagePlugin],
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
    
    // Força update caso as imagens demorem
    setTimeout(() => chartInstance.update(), 800);
}

// Inicia
init();
