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

// Variáveis Globais (Armazenam instâncias para destruir antes de recriar)
let charts = {
    bubble: null,
    bar: null,
    xpLine: null,
    xpBox: null,
    rel1: null, rel2: null, rel3: null, rel4: null, rel5: null, rel6: null
};

// =========================================================
// 2. INICIALIZAÇÃO
// =========================================================
function init() {
    console.log("🚀 Dashboard Relacional Iniciado");

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
// 4. RENDERIZAÇÃO GERAL
// =========================================================
async function renderizarGraficos(dados) {
    const dadosRecentes = dados.slice(-20);
    const dadosCompletos = dados; 

    const imagensMap = await carregarImagensCampeoes(dadosRecentes);

    // Gráficos Originais
    renderizarBubble(dadosRecentes, imagensMap);
    renderizarFarm(dadosRecentes);
    renderizarXPProbability(dadosCompletos);
    renderizarImpactoXP(dadosCompletos);

    // Novos Gráficos Relacionais (Usam todos os dados para melhor regressão)
    renderizarRelacionais(dadosCompletos);
}

// ... [AS FUNÇÕES ANTERIORES (Bubble, Farm, XP Line, XP Box) CONTINUAM IGUAIS] ...
// Vou repetir elas aqui para garantir o arquivo completo como você pediu.

// A. BUBBLE CHART
function renderizarBubble(dados, imagensMap) {
    const ctx = document.getElementById('graficoPrincipal');
    if (!ctx) return;
    if (charts.bubble) charts.bubble.destroy();

    const bubbleData = dados.map(d => {
        let duracao = d['Game Duration'] || (d['Gold Earned'] / (d['Gold/Min'] || 1));
        const gpm = d['Gold Earned'] / duracao;
        const ESCALA_BASE = 45; 
        const radiusPixel = (gpm / 450) * ESCALA_BASE;

        return {
            x: d['Damage/Min'], y: d['Gold/Min'], r: radiusPixel,
            champion: d['Champion'], win: d['Win Rate %'] === 1,
            gpm: gpm.toFixed(0), rawDamage: d['Damage/Min'].toFixed(0)
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
                ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
                ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
                ctx.restore();
                ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.lineWidth = 3;
                ctx.strokeStyle = dataPoint.win ? '#00BFFF' : '#FF4500'; ctx.stroke();
            });
        }
    };

    charts.bubble = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{ label: 'Performance', data: bubbleData, backgroundColor: 'transparent', borderColor: 'transparent' }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.raw.champion}: ${ctx.raw.rawDamage} Dano` } } },
            scales: { x: { title: { display: true, text: 'Dano/Min', color: '#aaa' }, grid: { color: '#333' } }, y: { title: { display: true, text: 'Ouro/Min', color: '#aaa' }, grid: { color: '#333' } } }
        },
        plugins: [imageProfilePlugin]
    });
}

// B. FARM CHART
function renderizarFarm(dados) {
    const ctx = document.getElementById('graficoFarm');
    if (!ctx) return;
    if (charts.bar) charts.bar.destroy();

    const labels = dados.map(d => d.Champion);
    const csData = dados.map(d => d['Farm/Min']);

    charts.bar = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: 'CS/Min', data: csData, backgroundColor: '#4BC0C0', borderColor: '#36A2EB', borderWidth: 1 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, grid: { color: '#333' } }, x: { display: false } }
        }
    });
}

// C. XP PROBABILITY
function renderizarXPProbability(dados) {
    const ctx = document.getElementById('graficoXPWinrate');
    if (!ctx) return;
    if (charts.xpLine) charts.xpLine.destroy();

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

    charts.xpLine = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.map(d => d.x > 0 ? `+${d.x}` : d.x),
            datasets: [{ label: 'Chance de Vitória', data: chartData.map(d => d.y), borderColor: '#22d3ee', backgroundColor: 'rgba(34, 211, 238, 0.2)', borderWidth: 3, tension: 0.4, fill: true }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probabilidade (%)', color: '#aaa' }, grid: { color: '#333' } }, x: { title: { display: true, text: 'XP Diff @ 12', color: '#aaa' }, grid: { color: '#333' } } }
        }
    });
}

// D. XP BOXPLOT (VERTICAL)
function renderizarImpactoXP(dados) {
    const ctx = document.getElementById('graficoImpactoXP');
    if (!ctx) return;
    if (charts.xpBox) charts.xpBox.destroy();

    const xpWins = dados.filter(d => d['Win Rate %'] === 1).map(d => d["XP Diff 12'"] || d["XP Diff 12"] || 0);
    const xpLosses = dados.filter(d => d['Win Rate %'] === 0).map(d => d["XP Diff 12'"] || d["XP Diff 12"] || 0);
    const statsWin = calcularQuartis(xpWins);
    const statsLoss = calcularQuartis(xpLosses);

    const boxPlotRenderer = {
        id: 'boxPlotRenderer',
        afterDatasetsDraw(chart) {
            const { ctx, scales: { x, y } } = chart;
            const dataset = chart.data.datasets[0];
            const statsArray = dataset.customStats;
            chart.getDatasetMeta(0).data.forEach((bar, index) => {
                const stats = statsArray[index];
                if (!stats) return;
                const xPos = bar.x; const width = bar.width;
                const yMin = y.getPixelForValue(stats.min); const yQ1 = y.getPixelForValue(stats.q1);
                const yMedian = y.getPixelForValue(stats.median); const yQ3 = y.getPixelForValue(stats.q3);
                const yMax = y.getPixelForValue(stats.max);
                ctx.save(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(xPos - width/1.5, yMedian); ctx.lineTo(xPos + width/1.5, yMedian); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(xPos, yMin); ctx.lineTo(xPos, yQ1); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(xPos - width/3, yMin); ctx.lineTo(xPos + width/3, yMin); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(xPos, yQ3); ctx.lineTo(xPos, yMax); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(xPos - width/3, yMax); ctx.lineTo(xPos + width/3, yMax); ctx.stroke();
                ctx.restore();
            });
        }
    };

    charts.xpBox = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Vitórias', 'Derrotas'],
            datasets: [{
                label: 'Distribuição XP',
                data: [[statsWin ? statsWin.q1 : 0, statsWin ? statsWin.q3 : 0], [statsLoss ? statsLoss.q1 : 0, statsLoss ? statsLoss.q3 : 0]],
                customStats: [statsWin, statsLoss],
                backgroundColor: ['rgba(0, 191, 255, 0.5)', 'rgba(255, 69, 0, 0.5)'], borderColor: ['#00BFFF', '#FF4500'], borderWidth: 1, borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'x', responsive: true, maintainAspectRatio: false,
            scales: { y: { grid: { color: '#333' }, ticks: { color: '#eee' }, title: { display: true, text: 'XP Diff (Valor)', color: '#aaa' } }, x: { grid: { display: false }, ticks: { color: '#eee', font: { weight: 'bold' } } } }
        },
        plugins: [boxPlotRenderer]
    });
}

// =========================================================
// E. GRÁFICOS RELACIONAIS (SCATTER + REGRESSÃO) - NOVO!
// =========================================================
function renderizarRelacionais(dados) {
    // Configuração dos 6 gráficos
    const configs = [
        { id: 'relChart1', xKey: "Deaths até 12min", yKey: 'Deaths', labelX: 'Mortes @ 12', labelY: 'Mortes Totais' },
        { id: 'relChart2', xKey: 'Vision Score/Min', yKey: 'Kill Participation', labelX: 'Visão/Min', labelY: 'Kill Part (0-1)' },
        { id: 'relChart3', xKey: "Deaths até 12min", yKey: "XP Diff 12'", labelX: 'Mortes @ 12', labelY: 'XP Diff @ 12' },
        { id: 'relChart4', xKey: 'Kill Participation', yKey: "XP Diff 12'", labelX: 'Kill Part', labelY: 'XP Diff @ 12' },
        { id: 'relChart5', xKey: "Gold Diff 12'", yKey: "CS Diff 12'", labelX: 'Gold Diff @ 12', labelY: 'CS Diff @ 12' },
        { id: 'relChart6', xKey: 'Deaths', yKey: 'Kill Participation', labelX: 'Mortes Totais', labelY: 'Kill Part' }
    ];

    // Mapeamento de instância para destruir
    const chartInstances = ['rel1', 'rel2', 'rel3', 'rel4', 'rel5', 'rel6'];

    configs.forEach((cfg, index) => {
        const ctx = document.getElementById(cfg.id);
        if(!ctx) return;
        
        const chartKey = chartInstances[index];
        if (charts[chartKey]) charts[chartKey].destroy();

        // 1. Extrair pontos (X, Y)
        const points = dados.map(d => {
            // Tratamento para chaves que podem variar (com ou sem aspas, acentos)
            // Se a chave não existir direto, tenta buscar variantes conhecidas
            let xVal = d[cfg.xKey] || 0;
            let yVal = d[cfg.yKey] || 0;
            return { x: xVal, y: yVal };
        });

        // 2. Calcular Regressão Linear
        const reg = calcularRegressaoLinear(points);

        // 3. Criar a Linha de Tendência (Do min X ao max X)
        // Precisamos ordenar os pontos por X para saber onde a linha começa e termina visualmente
        const sortedX = points.map(p => p.x).sort((a,b) => a - b);
        const minX = sortedX[0];
        const maxX = sortedX[sortedX.length - 1];

        const trendLine = [
            { x: minX, y: (reg.m * minX) + reg.b },
            { x: maxX, y: (reg.m * maxX) + reg.b }
        ];

        // 4. Renderizar
        charts[chartKey] = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Partidas',
                        data: points,
                        backgroundColor: '#00BFFF', // Pontos Azuis
                        radius: 4,
                        hoverRadius: 6
                    },
                    {
                        type: 'line',
                        label: `Tendência (R²=${reg.r2})`,
                        data: trendLine,
                        borderColor: '#a1a1aa', // Linha Cinza
                        borderWidth: 2,
                        pointRadius: 0, // Sem bolinhas na linha
                        borderDash: [5, 5], // Linha tracejada
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#ccc' } },
                    title: { display: true, text: `R² = ${reg.r2}`, color: '#aaa', font: { size: 10 } }
                },
                scales: {
                    x: { title: { display: true, text: cfg.labelX, color: '#666' }, grid: { color: '#333' }, ticks: { color: '#aaa' } },
                    y: { title: { display: true, text: cfg.labelY, color: '#666' }, grid: { color: '#333' }, ticks: { color: '#aaa' } }
                }
            }
        });
    });
}

// ---------------------------------------------------------
// FUNÇÕES MATEMÁTICAS AUXILIARES
// ---------------------------------------------------------

// Calcula Quartis para o Boxplot
function calcularQuartis(arr) {
    if (!arr || arr.length === 0) return null;
    arr.sort((a, b) => a - b);
    const quantile = (arr, q) => {
        const pos = (arr.length - 1) * q;
        const base = Math.floor(pos);
        const rest = pos - base;
        if (arr[base + 1] !== undefined) return Math.floor(arr[base] + rest * (arr[base + 1] - arr[base]));
        return Math.floor(arr[base]);
    };
    return { min: arr[0], q1: quantile(arr, 0.25), median: quantile(arr, 0.50), q3: quantile(arr, 0.75), max: arr[arr.length - 1] };
}

// Calcula Regressão Linear (y = mx + b) e R²
function calcularRegressaoLinear(points) {
    const n = points.length;
    if (n < 2) return { m: 0, b: 0, r2: 0 }; // Precisa de pelo menos 2 pontos

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

    points.forEach(p => {
        sumX += p.x;
        sumY += p.y;
        sumXY += (p.x * p.y);
        sumX2 += (p.x * p.x);
        sumY2 += (p.y * p.y);
    });

    // Inclinação (m) e Intercepto (b)
    const divisor = (n * sumX2) - (sumX * sumX);
    if (divisor === 0) return { m: 0, b: 0, r2: 0 }; // Evita divisão por zero (linha vertical)

    const m = ((n * sumXY) - (sumX * sumY)) / divisor;
    const b = (sumY - (m * sumX)) / n;

    // Cálculo do R² (Coeficiente de Determinação)
    // R² = (Correlação)²
    // Correlação (r) = [ n(∑xy) - (∑x)(∑y) ] / sqrt( [n∑x² - (∑x)²][n∑y² - (∑y)²] )
    
    const term1 = (n * sumXY) - (sumX * sumY);
    const term2 = (n * sumX2) - (sumX * sumX);
    const term3 = (n * sumY2) - (sumY * sumY);
    
    let r = 0;
    if (term2 * term3 > 0) {
        r = term1 / Math.sqrt(term2 * term3);
    }
    const r2 = (r * r).toFixed(3); // 3 casas decimais

    return { m, b, r2 };
}

// Utilitário de Imagens
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
