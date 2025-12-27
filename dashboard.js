// =========================================================
// 1. CONFIGURAÇÃO
// =========================================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const UI = {
    search: document.getElementById('playerSearch'),
    logout: document.getElementById('logoutBtn')
};

// Variáveis Globais
let chartBubble = null;
let chartBar = null;
let chartXP = null;
let chartImpacto = null;

// =========================================================
// 2. INICIALIZAÇÃO
// =========================================================
function init() {
    console.log("🚀 Dashboard Final v2 Iniciado");

    if (UI.logout) {
        UI.logout.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.href = "index.html";
        });
    }

    if (UI.search) {
        UI.search.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                buscarDados(UI.search.value);
            }
        });
    }
}

// =========================================================
// 3. BUSCA DE DADOS
// =========================================================
async function buscarDados(nick) {
    console.clear();
    console.log(`🔎 Buscando: "${nick}"...`);

    try {
        const { data, error } = await supabaseClient
            .from('partidas_br')
            .select('*')
            .ilike('Player Name', `%${nick}%`)
            .order('Game Start Time', { ascending: true });

        if (error) throw error;
        if (!data || data.length === 0) {
            alert("Jogador não encontrado ou sem dados.");
            return;
        }

        const dadosDoJogador = data.filter(linha => 
            linha['Player Name'].toLowerCase().includes(nick.toLowerCase())
        );

        const dadosUnicos = Array.from(
            new Map(dadosDoJogador.map(item => [item['Match ID'], item])).values()
        );

        console.log(`✅ ${dadosUnicos.length} partidas carregadas.`);
        renderizarGraficos(dadosUnicos);

    } catch (err) {
        console.error("Erro:", err);
    }
}

// =========================================================
// 4. RENDERIZAÇÃO
// =========================================================
async function renderizarGraficos(dados) {
    const dadosRecentes = dados.slice(-20);
    const dadosCompletos = dados; 

    const imagensMap = await carregarImagensCampeoes(dadosRecentes);

    renderizarBubble(dadosRecentes, imagensMap);
    renderizarFarm(dadosRecentes);
    renderizarXPProbability(dadosCompletos);
    
    // --- BOXPLOT CORRIGIDO ---
    renderizarImpactoXP(dadosCompletos);
}

// ---------------------------------------------------------
// A. GRÁFICO DE BOLHAS
// ---------------------------------------------------------
function renderizarBubble(dados, imagensMap) {
    const ctx = document.getElementById('graficoPrincipal');
    if (!ctx) return;
    if (chartBubble) chartBubble.destroy();

    const bubbleData = dados.map(d => {
        let duracao = d['Game Duration'] || (d['Gold Earned'] / (d['Gold/Min'] || 1));
        const gpm = d['Gold Earned'] / duracao;
        const ESCALA_BASE = 45; 
        const radiusPixel = (gpm / 450) * ESCALA_BASE;

        return {
            x: d['Damage/Min'],
            y: d['Gold/Min'],
            r: radiusPixel,
            champion: d['Champion'],
            win: d['Win Rate %'] === 1,
            gpm: gpm.toFixed(0),
            rawDamage: d['Damage/Min'].toFixed(0)
        };
    });

    const imageProfilePlugin = {
        id: 'customAvatar',
        afterDatasetDraw(chart) {
            const { ctx } = chart;
            const meta = chart.getDatasetMeta(0);
            meta.data.forEach((element, index) => {
                const dataPoint = bubbleData[index];
                const img = imagensMap[dataPoint.champion];
                if (!img) return;
                const { x, y } = element.tooltipPosition();
                const radius = element.options.radius;
                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
                ctx.restore();
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.lineWidth = 3;
                ctx.strokeStyle = dataPoint.win ? '#00BFFF' : '#FF4500';
                ctx.stroke();
            });
        }
    };

    chartBubble = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Performance',
                data: bubbleData,
                backgroundColor: 'transparent', 
                borderColor: 'transparent',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: (ctx) => `${ctx.raw.champion}: ${ctx.raw.rawDamage} Dano | ${ctx.raw.gpm} GPM` }
                }
            },
            scales: {
                x: { title: { display: true, text: 'Dano/Min', color: '#aaa' }, grid: { color: '#333' } },
                y: { title: { display: true, text: 'Ouro/Min', color: '#aaa' }, grid: { color: '#333' } }
            }
        },
        plugins: [imageProfilePlugin]
    });
}

// ---------------------------------------------------------
// B. GRÁFICO DE FARM
// ---------------------------------------------------------
function renderizarFarm(dados) {
    const ctx = document.getElementById('graficoFarm');
    if (!ctx) return;
    if (chartBar) chartBar.destroy();

    const labels = dados.map(d => d.Champion);
    const csData = dados.map(d => d['Farm/Min']);

    chartBar = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'CS/Min',
                data: csData,
                backgroundColor: '#4BC0C0',
                borderColor: '#36A2EB',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#333' } },
                x: { display: false }
            }
        }
    });
}

// ---------------------------------------------------------
// C. GRÁFICO DE PROBABILIDADE
// ---------------------------------------------------------
function renderizarXPProbability(dados) {
    const ctx = document.getElementById('graficoXPWinrate');
    if (!ctx) return;
    if (chartXP) chartXP.destroy();

    const buckets = {};
    const TAMANHO_BALDE = 500; 

    dados.forEach(d => {
        const xpDiff = d["XP Diff 12'"] || d["XP Diff 12"] || 0; 
        const bucketKey = Math.round(xpDiff / TAMANHO_BALDE) * TAMANHO_BALDE;

        if (!buckets[bucketKey]) buckets[bucketKey] = { wins: 0, total: 0 };
        buckets[bucketKey].total++;
        if (d['Win Rate %'] === 1) buckets[bucketKey].wins++;
    });

    let chartData = Object.keys(buckets).map(key => {
        const k = parseInt(key);
        const winRate = (buckets[key].wins / buckets[key].total) * 100;
        return { x: k, y: winRate, total: buckets[key].total };
    });
    chartData.sort((a, b) => a.x - b.x);

    chartXP = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.map(d => d.x > 0 ? `+${d.x}` : d.x),
            datasets: [{
                label: 'Chance de Vitória',
                data: chartData.map(d => d.y),
                borderColor: '#22d3ee',
                backgroundColor: 'rgba(34, 211, 238, 0.2)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true, max: 100,
                    title: { display: true, text: 'Probabilidade (%)', color: '#aaa' },
                    grid: { color: '#333' },
                    ticks: { callback: (v) => v + '%' }
                },
                x: { title: { display: true, text: 'Vantagem XP @ 12', color: '#aaa' }, grid: { color: '#333' } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: (ctx) => `Chance: ${ctx.raw.y.toFixed(1)}%` }
                }
            }
        }
    });
}

// ---------------------------------------------------------
// D. GRÁFICO BOXPLOT MANUAL (CORRIGIDO)
// ---------------------------------------------------------
function renderizarImpactoXP(dados) {
    const ctx = document.getElementById('graficoImpactoXP');
    if (!ctx) return;
    if (chartImpacto) chartImpacto.destroy();

    // 1. Extrair arrays de XP Diff
    const xpWins = dados.filter(d => d['Win Rate %'] === 1).map(d => d["XP Diff 12'"] || d["XP Diff 12"] || 0);
    const xpLosses = dados.filter(d => d['Win Rate %'] === 0).map(d => d["XP Diff 12'"] || d["XP Diff 12"] || 0);

    // 2. Calcular Quartis
    const statsWin = calcularQuartis(xpWins);
    const statsLoss = calcularQuartis(xpLosses);

    // 3. Plugin de Renderização (Desenho Manual)
    const boxPlotRenderer = {
        id: 'boxPlotRenderer',
        afterDatasetsDraw(chart) {
            const { ctx, scales: { x, y } } = chart;
            
            // Pega os dados estatísticos que salvamos dentro do dataset (ver linha 372)
            const dataset = chart.data.datasets[0];
            const statsArray = dataset.customStats; // [statsWin, statsLoss]

            chart.getDatasetMeta(0).data.forEach((bar, index) => {
                const stats = statsArray[index];
                if (!stats) return;

                const yPos = bar.y; 
                const height = bar.height;

                // Coordenadas X
                const xMin = x.getPixelForValue(stats.min);
                const xQ1 = x.getPixelForValue(stats.q1);
                const xMedian = x.getPixelForValue(stats.median);
                const xQ3 = x.getPixelForValue(stats.q3);
                const xMax = x.getPixelForValue(stats.max);

                ctx.save();
                
                // MUDANÇA: Usei BRANCO ('#FFFFFF') para garantir contraste alto
                ctx.strokeStyle = '#FFFFFF'; 
                ctx.lineWidth = 2;

                // A. Linha da Mediana (Vertical dentro da barra)
                ctx.beginPath();
                ctx.moveTo(xMedian, yPos - height/1.5); // Um pouco maior que a barra
                ctx.lineTo(xMedian, yPos + height/1.5);
                ctx.stroke();

                // B. Bigode Esquerdo (Min -> Q1)
                ctx.beginPath();
                ctx.moveTo(xMin, yPos);
                ctx.lineTo(xQ1, yPos);
                ctx.stroke();
                // Cap do Bigode Esquerdo ( | )
                ctx.beginPath();
                ctx.moveTo(xMin, yPos - height/3);
                ctx.lineTo(xMin, yPos + height/3);
                ctx.stroke();

                // C. Bigode Direito (Q3 -> Max)
                ctx.beginPath();
                ctx.moveTo(xQ3, yPos);
                ctx.lineTo(xMax, yPos);
                ctx.stroke();
                // Cap do Bigode Direito ( | )
                ctx.beginPath();
                ctx.moveTo(xMax, yPos - height/3);
                ctx.lineTo(xMax, yPos + height/3);
                ctx.stroke();

                ctx.restore();
            });
        }
    };

    chartImpacto = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Vitórias', 'Derrotas'],
            datasets: [{
                label: 'Distribuição XP',
                // A barra "flutuante" vai do Q1 ao Q3 (O corpo da caixa)
                data: [
                    [statsWin ? statsWin.q1 : 0, statsWin ? statsWin.q3 : 0],
                    [statsLoss ? statsLoss.q1 : 0, statsLoss ? statsLoss.q3 : 0]
                ],
                // Salvamos os stats completos AQUI para o plugin ler
                customStats: [statsWin, statsLoss],
                backgroundColor: [
                    'rgba(0, 191, 255, 0.5)', 
                    'rgba(255, 69, 0, 0.5)'
                ],
                borderColor: ['#00BFFF', '#FF4500'],
                borderWidth: 1,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'x', // Horizontal
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            // Tooltip detalhado
                            const stats = context.dataset.customStats[context.dataIndex];
                            if(!stats) return "Sem dados";
                            return [
                                `Max: ${stats.max}`,
                                `Q3 (75%): ${stats.q3}`,
                                `Mediana: ${stats.median}`,
                                `Q1 (25%): ${stats.q1}`,
                                `Min: ${stats.min}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: '#333' },
                    ticks: { color: '#eee' },
                    title: { display: true, text: 'Vantagem de XP (Boxplot)', color: '#aaa' }
                },
                y: { grid: { display: false }, ticks: { color: '#eee', font: { weight: 'bold' } } }
            }
        },
        // Registra o plugin nesta instância
        plugins: [boxPlotRenderer]
    });
}

function calcularQuartis(arr) {
    if (!arr || arr.length === 0) return null;
    arr.sort((a, b) => a - b);
    const min = arr[0];
    const max = arr[arr.length - 1];
    
    const quantile = (arr, q) => {
        const pos = (arr.length - 1) * q;
        const base = Math.floor(pos);
        const rest = pos - base;
        if (arr[base + 1] !== undefined) {
            return Math.floor(arr[base] + rest * (arr[base + 1] - arr[base]));
        } else {
            return Math.floor(arr[base]);
        }
    };

    return {
        min: Math.floor(min),
        q1: quantile(arr, 0.25),
        median: quantile(arr, 0.50),
        q3: quantile(arr, 0.75),
        max: Math.floor(max)
    };
}

async function carregarImagensCampeoes(dados) {
    const map = {};
    const promessas = dados.map(d => {
        return new Promise((resolve) => {
            const img = new Image();
            let champName = d.Champion;
            if (champName === "FiddleSticks") champName = "Fiddlesticks"; 
            if (champName === "Renata") champName = "RenataGlasc"; 

            img.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${champName}.png`;
            img.onload = () => { map[d.Champion] = img; resolve(); };
            img.onerror = () => { map[d.Champion] = null; resolve(); };
        });
    });
    await Promise.all(promessas);
    return map;
}

init();
