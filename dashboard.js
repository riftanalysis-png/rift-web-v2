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

// Elementos Visuais
const displayWinrate = document.querySelector('.card:nth-child(1) .big-number');
const displayKDA = document.querySelector('.card:nth-child(2) .big-number');
const displayMainChampName = document.querySelector('.champ-badge span');
const displayMainChampImg = document.querySelector('.champ-badge img');
const displayMainChampStats = document.querySelector('.card:nth-child(3) p');

let chartInstance = null;

// ==========================================
// 2. LISTA DE SUGESTÕES
// ==========================================
const suggestedNicks = [
    "Zekas#2002", "han dao#EGC", "Pilot#br11", "Celo#br2", "Gatovisck#愛憎の影"
];

// ==========================================
// 3. LÓGICA DE BUSCA
// ==========================================
searchInput.addEventListener('focus', () => {
    const termo = searchInput.value.toLowerCase();
    const lista = termo === "" ? suggestedNicks : suggestedNicks.filter(n => n.toLowerCase().includes(termo));
    renderSuggestions(lista);
    suggestionsBox.style.display = 'block';
});

searchInput.addEventListener('input', (e) => {
    const termo = e.target.value.toLowerCase();
    const nicksFiltrados = suggestedNicks.filter(nick => nick.toLowerCase().includes(termo));
    
    if (nicksFiltrados.length > 0) {
        renderSuggestions(nicksFiltrados);
        suggestionsBox.style.display = 'block';
    } else {
        suggestionsBox.style.display = 'none';
    }
});

document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
        suggestionsBox.style.display = 'none';
    }
});

function renderSuggestions(list) {
    suggestionsBox.innerHTML = '';
    list.forEach(nick => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        const [name, tag] = nick.split('#');
        div.innerHTML = `<span>${name}</span><strong style="font-size:0.8rem; color:#666;">#${tag || ''}</strong>`;
        
        div.addEventListener('click', () => {
            fetchRealPlayerData(nick); 
        });
        
        suggestionsBox.appendChild(div);
    });
}

// ==========================================
// 4. BUSCAR DADOS REAIS E LIMPAR DUPLICATAS
// ==========================================
async function fetchRealPlayerData(nick) {
    searchInput.value = nick;
    suggestionsBox.style.display = 'none';
    welcomeMsg.innerText = `Carregando dados de ${nick}...`;

    try {
        // CORREÇÃO 1: Usar .eq() em vez de .ilike() para ser EXATO
        // Isso evita pegar nicks parecidos.
        const { data, error } = await supabaseClient
            .from('partidas_br') 
            .select('*')
            .eq('Player Name', nick); 

        if (error) throw error;

        if (!data || data.length === 0) {
            alert("Nenhuma partida encontrada para este jogador.");
            welcomeMsg.innerText = `Sem dados para: ${nick}`;
            return;
        }

        // =========================================================
        // CORREÇÃO 2: REMOVER DUPLICATAS (O Segredo!) 🛡️
        // =========================================================
        const partidasUnicas = [];
        const idsVistos = new Set();

        data.forEach(match => {
            // Usa 'Match ID' para saber se é repetida
            const id = match['Match ID']; 
            
            if (!idsVistos.has(id)) {
                idsVistos.add(id);
                partidasUnicas.push(match);
            }
        });

        // Agora usamos APENAS 'partidasUnicas' para tudo
        const cleanData = partidasUnicas;

        console.log(`Dados brutos: ${data.length} | Dados únicos: ${cleanData.length}`);

        if (cleanData.length === 0) {
            alert("Erro: Dados encontrados mas inconsistentes.");
            return;
        }

        // --- CÁLCULOS GERAIS ---
        const totalGames = cleanData.length;
        const wins = cleanData.filter(match => match['Win Rate %'] == 1 || match['Win Rate %'] == 100).length;
        const winrate = ((wins / totalGames) * 100).toFixed(1) + "%";

        // Média KDA
        let totalKDA = 0;
        let validKDA = 0;
        cleanData.forEach(match => {
             const kdaVal = parseFloat(match['KDA']);
             if(!isNaN(kdaVal)) {
                 totalKDA += kdaVal;
                 validKDA++;
             }
        });
        const avgKDA = validKDA > 0 ? (totalKDA / validKDA).toFixed(1) : "-";

        // Main Champ
        const champCounts = {};
        cleanData.forEach(match => {
            const c = match['Champion'];
            champCounts[c] = (champCounts[c] || 0) + 1;
        });
        const mainChamp = Object.keys(champCounts).reduce((a, b) => champCounts[a] > champCounts[b] ? a : b);

        // Atualiza Tela
        welcomeMsg.innerText = `Análise: ${nick}`;
        displayWinrate.innerText = winrate;
        displayKDA.innerText = avgKDA;

        displayMainChampName.innerText = mainChamp;
        displayMainChampImg.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${mainChamp.replace(/[^a-zA-Z0-9]/g, '')}.png`;
        displayMainChampStats.innerText = `${champCounts[mainChamp]} Partidas`;

        // --- DADOS PARA O GRÁFICO ---
        const chartData = cleanData.map(match => {
            const dpm = parseFloat(match['Damage/Min']) || 0;
            const gpm = parseFloat(match['Gold/Min']) || 1; 
            const isWin = match['Win Rate %'] == 1 || match['Win Rate %'] == 100;

            const eficienciaPercent = (dpm / gpm) * 100;
            const radius = eficienciaPercent / 6;

            return {
                y: dpm,    
                x: gpm,    
                r: radius < 5 ? 5 : radius, 
                champ: match['Champion'],
                win: isWin,
                efficiency: eficienciaPercent.toFixed(0)
            };
        });

        updateChart(chartData);

    } catch (err) {
        console.error("Erro:", err);
        alert("Erro ao processar dados. Verifique o console (F12).");
    }
}

// ==========================================
// 5. GRÁFICO (CHART.JS)
// ==========================================
function updateChart(newData) {
    const carregarImg = (nome) => {
        const img = new Image();
        const cleanName = nome.replace(/[^a-zA-Z0-9]/g, ''); 
        img.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${cleanName}.png`;
        return img;
    };

    const vitorias = newData.filter(d => d.win).map(d => ({ ...d, image: carregarImg(d.champ) }));
    const derrotas = newData.filter(d => !d.win).map(d => ({ ...d, image: carregarImg(d.champ) }));

    if (chartInstance) {
        chartInstance.destroy();
    }

    createChart(vitorias, derrotas);
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
                
                if(dataPoint.image && dataPoint.image.complete && dataPoint.image.naturalHeight !== 0) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2, true);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(dataPoint.image, x - radius, y - radius, radius * 2, radius * 2);
                    
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = dataPoint.win ? '#5383e8' : '#e84057';
                    ctx.stroke();

                    ctx.restore();
                } else {
                    dataPoint.image.onload = () => chart.update();
                }
            });
        }
    };

    chartInstance = new Chart(ctx, {
        type: 'bubble',
        plugins: [imagePlugin],
        data: {
            datasets: [
                { 
                    label: 'Vitória', 
                    data: vitorias, 
                    backgroundColor: 'rgba(83, 131, 232, 0.1)', 
                    borderColor: 'transparent',
                    hoverRadius: 0 
                },
                { 
                    label: 'Derrota', 
                    data: derrotas, 
                    backgroundColor: 'rgba(232, 64, 87, 0.1)', 
                    borderColor: 'transparent',
                    hoverRadius: 0 
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { 
                legend: { display: false }, 
                tooltip: { 
                    backgroundColor: '#13161d', 
                    titleColor: '#c8aa6e',
                    bodyColor: '#fff',
                    callbacks: { 
                        label: c => {
                            const d = c.raw;
                            return [
                                ` ${d.champ}`,
                                ` Eficiência: ${d.efficiency}%`,
                                ` Dano/min: ${d.y.toFixed(0)}`,
                                ` Gold/min: ${d.x.toFixed(0)}`
                            ];
                        }
                    } 
                } 
            },
            scales: {
                x: { 
                    title: { display: true, text: 'Gold por Minuto (GPM)', color: '#8a92a3' }, 
                    grid: { color: 'rgba(255,255,255,0.03)' }, 
                    ticks: { color: '#8a92a3' },
                    suggestedMin: 0,
                },
                y: { 
                    title: { display: true, text: 'Dano por Minuto (DPM)', color: '#8a92a3' }, 
                    grid: { color: 'rgba(255,255,255,0.03)' }, 
                    ticks: { color: '#8a92a3' },
                    suggestedMin: 0,
                }
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

        fetchRealPlayerData("Zekas#2002");
    }
}

logoutBtn.addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (!error) window.location.href = "index.html";
});

checkSession();
