// =========================================================
// 1. CONFIGURAÇÃO & TEMA (SESSHOMARU)
// =========================================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// CORES DA PALETA
const THEME = {
    gold: '#D4AF37',
    red:  '#B22222',
    blue: '#2C4F7C',
    text: '#8A8F98', // Texto secundário
    grid: '#23262E'  // Grade sutil
};

// Defaults do Chart.js para o estilo Minimalista
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.color = THEME.text;
Chart.defaults.borderColor = THEME.grid;

const UI = {
    search: document.getElementById('playerSearch'),
    logout: document.getElementById('logoutBtn')
};

let charts = {
    bubble: null, bar: null, xpLine: null, xpBox: null,
    rel1: null, rel2: null, rel3: null, rel4: null, rel5: null, rel6: null
};

// =========================================================
// 2. INICIALIZAÇÃO
// =========================================================
function init() {
    console.log("🚀 Nexus Analytics Iniciado");

    if (UI.logout) UI.logout.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
    });

    if (UI.search) UI.search.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') buscarDados(UI.search.value);
    });
}

// =========================================================
// 3. BUSCA
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
            alert("Jogador não encontrado.");
            return;
        }

        const dadosDoJogador = data.filter(linha => 
            linha['Player Name'].toLowerCase().includes(nick.toLowerCase())
        );

        const dadosUnicos = Array.from(
            new Map(dadosDoJogador.map(item => [item['Match ID'], item])).values()
        );

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
    renderizarImpactoXP(dadosCompletos);
    renderizarRelacionais(dadosCompletos);
}

// A. SCATTER HERO (Carry)
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
                
                ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); 
                ctx.lineWidth = 2;
                ctx.strokeStyle = dataPoint.win ? THEME.gold : THEME.red; 
                ctx.stroke();
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
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.raw.champion} | ${ctx.raw.rawDamage} Dano` } } },
            scales: { 
                x: { title: { display: true, text: 'Dano/Min' }, grid: { color: THEME.grid } }, 
                y: { title: { display: true, text: 'Ouro/Min' }, grid: { color: THEME.grid } } 
            }
        },
        plugins: [imageProfilePlugin]
    });
}

// B. FARM CHART
function renderizarFarm(dados) {
    const ctx = document.getElementById('graficoFarm');
    if (!ctx) return;
    if (charts.bar) charts.bar.destroy();

    charts.bar = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dados.map(d => d.Champion),
            datasets: [{ 
                label: 'CS/Min', 
                data: dados.map(d => d['Farm/Min']), 
                backgroundColor: THEME.blue, 
                borderRadius: 2,
                barThickness: 'flex',
                maxBarThickness: 30
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { beginAtZero: true, grid: { color: THEME.grid } }, 
                x: { display: false, grid: { display: false } } // Limpeza visual
            }
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
            datasets: [{ 
                label: 'Win Rate %', 
                data: chartData.map(d => d.y), 
                borderColor: THEME.gold, 
                backgroundColor: 'rgba(212, 175, 55, 0.05)', 
                borderWidth: 2, 
                tension: 0.4, 
                fill: true,
                pointBackgroundColor: '#0F1115',
                pointBorderColor: THEME.gold,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probabilidade (%)' } }, 
                x: { title: { display: true, text: 'XP Diff @ 12' }, grid: { display: false } } 
            }
        }
    });
}

// D. XP BOXPLOT (Vertical)
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
                
                ctx.save(); ctx.strokeStyle = '#F5F5F2'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(xPos - width/2, yMedian); ctx.lineTo(xPos + width/2, yMedian); ctx.stroke(); // Mediana
                ctx.beginPath(); ctx.moveTo(xPos, yMin); ctx.lineTo(xPos, yQ1); ctx.stroke(); // Bigode Baixo
                ctx.beginPath(); ctx.moveTo(xPos - width/4, yMin); ctx.lineTo(xPos + width/4, yMin); ctx.stroke(); // Cap Baixo
                ctx.beginPath(); ctx.moveTo(xPos, yQ3); ctx.lineTo(xPos, yMax); ctx.stroke(); // Bigode Cima
                ctx.beginPath(); ctx.moveTo(xPos - width/4, yMax); ctx.lineTo(xPos + width/4, yMax); ctx.stroke(); // Cap Cima
                ctx.restore();
            });
        }
    };

    charts.xpBox = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Vitória', 'Derrota'],
            datasets: [{
                label: 'Distribuição XP',
                data: [[statsWin ? statsWin.q1 : 0, statsWin ? statsWin.q3 : 0], [statsLoss ? statsLoss.q1 : 0, statsLoss ? statsLoss.q3 : 0]],
                customStats: [statsWin, statsLoss],
                backgroundColor: [THEME.gold + '66', THEME.red + '66'], 
                borderColor: [THEME.gold, THEME.red], 
                borderWidth: 1, borderSkipped: false,
                barThickness: 60
            }]
        },
        options: {
            indexAxis: 'x', responsive: true, maintainAspectRatio: false,
            scales: { 
                y: { grid: { color: THEME.grid }, title: { display: true, text: 'Vantagem XP' } }, 
                x: { grid: { display: false } } 
            },
            plugins: { legend: { display: false } }
        },
        plugins: [boxPlotRenderer]
    });
}

// E. RELACIONAIS
function renderizarRelacionais(dados) {
    const configs = [
        { id: 'relChart1', xKey: "Deaths até 12min", yKey: 'Deaths', labelX: 'Mortes @ 12', labelY: 'Total' },
        { id: 'relChart2', xKey: 'Vision Score/Min', yKey: 'Kill Participation', labelX: 'Visão/Min', labelY: 'KP%' },
        { id: 'relChart3', xKey: "Deaths até 12min", yKey: "XP Diff 12'", labelX: 'Mortes @ 12', labelY: 'XP Diff' },
        { id: 'relChart4', xKey: 'Kill Participation', yKey: "XP Diff 12'", labelX: 'KP%', labelY: 'XP Diff' },
        { id: 'relChart5', xKey: "Gold Diff 12'", yKey: "CS Diff 12'", labelX: 'Gold Diff', labelY: 'CS Diff' },
        { id: 'relChart6', xKey: 'Deaths', yKey: 'Kill Participation', labelX: 'Mortes', labelY: 'KP%' }
    ];

    const chartInstances = ['rel1', 'rel2', 'rel3', 'rel4', 'rel5', 'rel6'];

    configs.forEach((cfg, index) => {
        const ctx = document.getElementById(cfg.id);
        if(!ctx) return;
        const chartKey = chartInstances[index];
        if (charts[chartKey]) charts[chartKey].destroy();

        const points = dados.map(d => ({ x: d[cfg.xKey] || 0, y: d[cfg.yKey] || 0 }));
        const reg = calcularRegressaoLinear(points);
        const sortedX = points.map(p => p.x).sort((a,b) => a - b);
        const trendLine = [{ x: sortedX[0], y: (reg.m * sortedX[0]) + reg.b }, { x: sortedX[sortedX.length - 1], y: (reg.m * sortedX[sortedX.length - 1]) + reg.b }];

        charts[chartKey] = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Jogo', data: points,
                        backgroundColor: THEME.blue,
                        radius: 2, hoverRadius: 4
                    },
                    {
                        type: 'line', label: `R²=${reg.r2}`,
                        data: trendLine,
                        borderColor: THEME.text,
                        borderWidth: 1, pointRadius: 0, borderDash: [3, 3], fill: false
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, title: { display: true, text: `R² = ${reg.r2}`, color: THEME.text, font: { size: 9 } } },
                scales: { 
                    x: { title: { display: true, text: cfg.labelX }, grid: { display: false } }, 
                    y: { title: { display: true, text: cfg.labelY }, grid: { color: THEME.grid } } 
                }
            }
        });
    });
}

// Funções Auxiliares
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

function calcularRegressaoLinear(points) {
    const n = points.length;
    if (n < 2) return { m: 0, b: 0, r2: 0 };
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    points.forEach(p => { sumX += p.x; sumY += p.y; sumXY += (p.x * p.y); sumX2 += (p.x * p.x); sumY2 += (p.y * p.y); });
    const divisor = (n * sumX2) - (sumX * sumX);
    if (divisor === 0) return { m: 0, b: 0, r2: 0 };
    const m = ((n * sumXY) - (sumX * sumY)) / divisor;
    const b = (sumY - (m * sumX)) / n;
    const term1 = (n * sumXY) - (sumX * sumY); const term2 = (n * sumX2) - (sumX * sumX); const term3 = (n * sumY2) - (sumY * sumY);
    let r = 0; if (term2 * term3 > 0) r = term1 / Math.sqrt(term2 * term3);
    return { m, b, r2: (r * r).toFixed(3) };
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
