// ==========================================
// 1. CONFIGURAÇÃO & VARIÁVEIS GLOBAIS
// ==========================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos DOM
const loadingScreen = document.getElementById('loadingScreen');
const welcomeMsg = document.getElementById('welcomeMsg');
const userNickDisplay = document.getElementById('userNickDisplay');
const logoutBtn = document.getElementById('logoutBtn');
const searchInput = document.getElementById('playerSearch');
const suggestionsBox = document.getElementById('suggestionsBox');

// Elementos que vão mudar com a busca
const displayWinrate = document.querySelector('.card:nth-child(1) .big-number');
const displayKDA = document.querySelector('.card:nth-child(2) .big-number');
const displayMainChampName = document.querySelector('.champ-badge span');
const displayMainChampImg = document.querySelector('.champ-badge img');
const displayMainChampStats = document.querySelector('.card:nth-child(3) p');

// Variável global para o gráfico (para podermos destruí-lo e recriá-lo)
let chartInstance = null;

// ==========================================
// 2. BANCO DE DADOS MOCK (OS 5 JOGADORES)
// ==========================================
const mockPlayers = {
    "Zekas#2002": {
        winrate: "58.2%", kda: "4.1 : 1", main: "Zed", mainStats: "42 Partidas (62% WR)",
        chartData: [ // Agressivo: Muito dano, gold ok
            { x: 950, y: 480, r: 28, champ: 'Zed', win: true },
            { x: 800, y: 450, r: 20, champ: 'Yone', win: false },
            { x: 1100, y: 550, r: 35, champ: 'Sylas', win: true }
        ]
    },
    "han dao#EGC": {
        winrate: "49.5%", kda: "2.8 : 1", main: "LeeSin", mainStats: "30 Partidas (51% WR)",
        chartData: [ // Jungler: Dano médio, eficiência variável
            { x: 500, y: 400, r: 15, champ: 'LeeSin', win: true },
            { x: 450, y: 380, r: 10, champ: 'Viego', win: false },
            { x: 600, y: 450, r: 22, champ: 'Graves', win: true }
        ]
    },
    "Pilot#br11": {
        winrate: "61.0%", kda: "5.2 : 1", main: "Jhin", mainStats: "55 Partidas (65% WR)",
        chartData: [ // ADC: Muito Gold, Dano alto
            { x: 900, y: 600, r: 30, champ: 'Jhin', win: true },
            { x: 850, y: 550, r: 25, champ: 'Kaisa', win: true },
            { x: 400, y: 300, r: 10, champ: 'Ezreal', win: false }
        ]
    },
    "Celo#br2": {
        winrate: "52.4%", kda: "3.4 : 1", main: "Thresh", mainStats: "18 Partidas (55% WR)",
        chartData: [ // Support: Pouco dano, pouco gold, mas ganha
            { x: 200, y: 250, r: 15, champ: 'Thresh', win: true },
            { x: 300, y: 280, r: 18, champ: 'Nautilus', win: true },
            { x: 150, y: 200, r: 10, champ: 'Lulu', win: false }
        ]
    },
    "Gatovisck#愛憎の影": {
        winrate: "45.0%", kda: "1.9 : 1", main: "Yasuo", mainStats: "100 Partidas (40% WR)",
        chartData: [ // O Yasuo clássico: Dano alto nas derrotas
            { x: 800, y: 400, r: 10, champ: 'Yasuo', win: false },
            { x: 850, y: 410, r: 12, champ: 'Yone', win: false },
            { x: 600, y: 500, r: 25, champ: 'Malphite', win: true }
        ]
    }
};

const suggestedNicks = Object.keys(mockPlayers);

// ==========================================
// 3. LÓGICA DE BUSCA
// ==========================================

// Mostrar sugestões ao focar
searchInput.addEventListener('focus', () => {
    renderSuggestions(suggestedNicks);
    suggestionsBox.style.display = 'block';
});

// Esconder ao clicar fora (com um pequeno delay para permitir o clique na sugestão)
document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
        suggestionsBox.style.display = 'none';
    }
});

// Renderizar a lista
function renderSuggestions(list) {
    suggestionsBox.innerHTML = '';
    list.forEach(nick => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        // Separa o Nick da Tag para estilizar
        const [name, tag] = nick.split('#');
        div.innerHTML = `<span>${name}</span><strong style="font-size:0.8rem; color:#666;">#${tag || ''}</strong>`;
        
        div.addEventListener('click', () => {
            selectPlayer(nick);
        });
        
        suggestionsBox.appendChild(div);
    });
}

// ==========================================
// 4. ATUALIZAR DASHBOARD (O CÉREBRO)
// ==========================================
function selectPlayer(nick) {
    // 1. Atualiza o Input
    searchInput.value = nick;
    suggestionsBox.style.display = 'none';

    // 2. Pega os dados do Mock
    const data = mockPlayers[nick];
    if (!data) return; // Segurança

    // 3. Atualiza Textos
    welcomeMsg.innerText = `Análise: ${nick}`;
    displayWinrate.innerText = data.winrate;
    displayKDA.innerText = data.kda;
    
    // 4. Atualiza Card do Campeão
    displayMainChampName.innerText = data.main;
    displayMainChampImg.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${data.main}.png`;
    displayMainChampStats.innerText = data.mainStats;

    // 5. Atualiza o Gráfico
    updateChart(data.chartData);
}

// ==========================================
// 5. LÓGICA DO GRÁFICO (CHART.JS)
// ==========================================

function updateChart(newData) {
    // Helper de imagem
    const carregarImg = (nome) => {
        const img = new Image();
        img.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${nome}.png`;
        return img;
    };

    // Prepara os dados
    const vitorias = newData.filter(d => d.win).map(d => ({ ...d, image: carregarImg(d.champ) }));
    const derrotas = newData.filter(d => !d.win).map(d => ({ ...d, image: carregarImg(d.champ) }));

    // Se já existe gráfico, atualiza os dados. Se não, cria.
    if (chartInstance) {
        chartInstance.data.datasets[0].data = vitorias;
        chartInstance.data.datasets[1].data = derrotas;
        chartInstance.update();
    } else {
        createChart(vitorias, derrotas);
    }
}

function createChart(vitorias, derrotas) {
    const ctx = document.getElementById('resourceChart').getContext('2d');

    const imagePlugin = {
        id: 'customImage',
        afterDatasetDraw(chart, args, options) {
            const { ctx } = chart;
            const meta = args.meta;
            meta.data.forEach((element, index) => {
                const dataPoint = chart.data.datasets[meta.index].data[index];
                const { x, y } = element.getProps(['x', 'y'], true);
                const radius = element.options.radius;
                
                if(dataPoint.image && dataPoint.image.complete) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2, true);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(dataPoint.image, x - radius, y - radius, radius * 2, radius * 2);
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = dataPoint.win ? 'rgba(83, 131, 232, 0.5)' : 'rgba(232, 64, 87, 0.5)';
                    ctx.stroke();
                    ctx.restore();
                }
            });
        }
    };

    chartInstance = new Chart(ctx, {
        type: 'bubble',
        plugins: [imagePlugin],
        data: {
            datasets: [
                { label: 'Vitória', data: vitorias, backgroundColor: 'rgba(83, 131, 232, 0.1)', borderColor: '#5383e8', borderWidth: 2, hoverRadius: 0 },
                { label: 'Derrota', data: derrotas, backgroundColor: 'rgba(232, 64, 87, 0.1)', borderColor: '#e84057', borderWidth: 2, hoverRadius: 0 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { backgroundColor: '#13161d', titleColor: '#c8aa6e', callbacks: { label: c => ` ${c.raw.champ} | D: ${c.raw.x} | G: ${c.raw.y}` } } },
            scales: {
                x: { title: { display: true, text: 'Dano (DPM)', color: '#555' }, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8a92a3' } },
                y: { title: { display: true, text: 'Ouro (GPM)', color: '#555' }, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8a92a3' } }
            }
        }
    });
}

// ==========================================
// 6. INICIALIZAÇÃO
// ==========================================
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = "index.html";
    } else {
        const user = session.user;
        const nick = user.user_metadata.lol_nick || "Sem Nick";
        const nome = user.user_metadata.full_name || "Invocador";

        welcomeMsg.innerText = `Bem-vindo ao Rift, ${nick}.`;
        userNickDisplay.innerText = nome;
        loadingScreen.style.display = 'none';

        // Carrega dados iniciais (usando o perfil do 'Zekas' como padrão visual ou vazio)
        // Se o nick do usuario bater com um da lista, carrega o dele
        if (mockPlayers[nick]) {
            selectPlayer(nick);
        } else {
            // Se não, carrega dados genéricos do Zekas só pra preencher o gráfico
            updateChart(mockPlayers["Zekas#2002"].chartData);
        }
    }
}

// Logout
logoutBtn.addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (!error) window.location.href = "index.html";
});

checkSession();
