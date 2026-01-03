// ==========================================
// CONFIGURAÇÃO GERAL
// ==========================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const THEME = { 
    gold: '#c8aa6e', 
    red: '#e84057', 
    blue: '#5383e8', 
    text: '#8a92a3', 
    grid: 'rgba(255, 255, 255, 0.05)',
    benchmark: '#ffffff'
};

// Defaults do Chart.js
Chart.defaults.font.family = "'Segoe UI', sans-serif"; 
Chart.defaults.color = THEME.text; 
Chart.defaults.borderColor = THEME.grid;

// Armazena instâncias de gráfico para update/destroy
let charts = { bubble: null, bar: null, xpLine: null, xpBox: null, rels: {} };

// ==========================================
// 1. DADOS MOCKADOS: CHALLENGER KR (Benchmark)
// ==========================================
const KR_BENCHMARK = {
    avgCsMin: 9.8,
    avgVisionScore: 2.1,
    avgDpm: 680,
    goldAt14: 4950,
    objParticipation: 3.5, 
    survivalScore: 92,
    powerCurve: [100, 1200, 2500, 4800], // 5, 11, 14, 20 min
    carrySweetSpot: { x: 550, y: 700 } 
};

// Dados simulados do Usuário (para teste dos novos gráficos)
const USER_MOCK = {
    csHistory: [7.2, 8.5, 6.9, 9.1, 8.0, 7.5, 8.8, 9.2, 6.5, 7.8, 8.2, 8.5, 9.0, 8.1, 7.9, 8.3, 8.6, 9.5, 7.0, 8.4],
    stats: {
        dpm: 590,
        csMin: 8.2,
        visMin: 1.5,
        gold14: 4200,
        objPart: 2.1,
        survival: 78
    },
    matchups: [
        {x: -800, y: 0}, {x: 200, y: 1}, {x: 1500, y: 1}, {x: -200, y: 0}, 
        {x: 600, y: 1}, {x: -1200, y: 0}, {x: 300, y: 1}, {x: 0, y: 0}
    ],
    powerCurve: [-100, 400, 800, 1200]
};

// ==========================================
// 2. INICIALIZAÇÃO
// ==========================================
async function init() {
    document.getElementById('playerSearch').addEventListener('keydown', (e) => { if(e.key === 'Enter') buscarDados(e.target.value); });
    document.getElementById('logoutBtn').addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.href = "index.html"; });
    
    // Inicia gráficos existentes com dados do Supabase (Vazio ou Default)
    buscarDados(""); 

    // Inicia os NOVOS gráficos de Benchmark (Mockados)
    initBenchmarkCharts();
}

// ==========================================
// 3. LÓGICA DE DADOS REAIS (SUPABASE)
// ==========================================
async function buscarDados(nick) {
    // 1. Dados Recentes (Limitado a 50) para Scatter/Farm
    const { data: rawData } = await supabaseClient.from('partidas_br').select('*').ilike('Player Name', `%${nick}%`).order('Game Start Time', { ascending: false }).limit(50);
    if (rawData?.length > 0) renderizarScatterFarm(rawData.reverse());

    // 2. Dados Globais (Tabelas de Resumo)
    await carregarEstatisticasGlobais();
}

async function renderizarScatterFarm(dados) {
    const imagensMap = await carregarImagens(dados);
    const ctx1 = document.getElementById('graficoPrincipal');
    if (charts.bubble) charts.bubble.destroy();
    
    charts.bubble = new Chart(ctx1, {
        type: 'bubble',
        data: {
            datasets: [{
                data: dados.map(d => ({ x: d['Damage/Min'], y: d['Gold/Min'], r: ((d['Gold Earned']/(d['Game Duration']||1))/450)*45, champion: d['Champion'], win: d['Win Rate %']===1 })),
                backgroundColor: 'transparent', borderColor: 'transparent'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: {display:false} }, scales: { x: {title:{display:true,text:'Dano/Min'}}, y: {title:{display:true,text:'Ouro/Min'}} } },
        plugins: [{
            id: 'customAvatar', afterDatasetDraw(chart) {
                const { ctx } = chart;
                chart.getDatasetMeta(0).data.forEach((pt, i) => {
                    const d = chart.data.datasets[0].data[i];
                    const img = imagensMap[d.champion]; if(!img) return;
                    const {x, y} = pt.tooltipPosition();
                    ctx.save(); ctx.beginPath(); ctx.arc(x,y,pt.options.radius,0,Math.PI*2); ctx.closePath(); ctx.clip();
                    ctx.drawImage(img,x-pt.options.radius,y-pt.options.radius,pt.options.radius*2,pt.options.radius*2); ctx.restore();
                    ctx.beginPath(); ctx.arc(x,y,pt.options.radius,0,Math.PI*2); ctx.lineWidth=2; ctx.strokeStyle=d.win?THEME.blue:THEME.red; ctx.stroke();
                });
            }
        }]
    });

    const ctx2 = document.getElementById('graficoFarm');
    if(charts.bar) charts.bar.destroy();
    charts.bar = new Chart(ctx2, {
        type: 'bar',
        data: { labels: dados.map(d=>d.Champion), datasets: [{ label: 'CS/Min', data: dados.map(d=>d['Farm/Min']), backgroundColor: THEME.gold, borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: {display: false} }, plugins: { legend: {display:false} } }
    });
}

async function carregarEstatisticasGlobais() {
    const { data: boxData } = await supabaseClient.from('analise_boxplot').select('*');
    if (boxData) renderizarBoxplot(boxData);

    const { data: probData } = await supabaseClient.from('analise_probabilidade').select('*').order('xp_bucket');
    if (probData) renderizarProbabilidade(probData);

    const { data: regData } = await supabaseClient.from('analise_regressao').select('*');
    const { data: sample } = await supabaseClient.from('partidas_br').select('*').limit(50);
    if (regData && sample) renderizarRelacionais(regData, sample);
}

function renderizarBoxplot(stats) {
    const ctx = document.getElementById('graficoImpactoXP');
    if (charts.xpBox) charts.xpBox.destroy();
    const win = stats.find(s=>s.categoria==='Vitória'); const loss = stats.find(s=>s.categoria==='Derrota');
    
    charts.xpBox = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Vitória', 'Derrota'],
            datasets: [{
                data: [[win?.q1, win?.q3], [loss?.q1, loss?.q3]], customStats: [win, loss],
                backgroundColor: [THEME.blue+'66', THEME.red+'66'], borderColor: [THEME.blue, THEME.red], borderWidth: 1, borderSkipped: false, barThickness: 60
            }]
        },
        options: { indexAxis: 'x', responsive: true, maintainAspectRatio: false, plugins: {legend:{display:false}} },
        plugins: [{
            id: 'boxPlotRenderer', afterDatasetsDraw(chart) {
                const {ctx, scales:{x,y}} = chart;
                chart.getDatasetMeta(0).data.forEach((bar,i) => {
                    const st = chart.data.datasets[0].customStats[i]; if(!st) return;
                    const xP = bar.x, w = bar.width, yMin = y.getPixelForValue(st.min), yQ1 = y.getPixelForValue(st.q1), yMed = y.getPixelForValue(st.mediana), yQ3 = y.getPixelForValue(st.q3), yMax = y.getPixelForValue(st.max);
                    ctx.save(); ctx.strokeStyle='#fff'; ctx.lineWidth=1.5;
                    ctx.beginPath(); ctx.moveTo(xP-w/2,yMed); ctx.lineTo(xP+w/2,yMed); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(xP,yMin); ctx.lineTo(xP,yQ1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(xP-w/4,yMin); ctx.lineTo(xP+w/4,yMin); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(xP,yQ3); ctx.lineTo(xP,yMax); ctx.stroke(); ctx.beginPath(); ctx.moveTo(xP-w/4,yMax); ctx.lineTo(xP+w/4,yMax); ctx.stroke();
                    ctx.restore();
                });
            }
        }]
    });
}

function renderizarProbabilidade(data) {
    const ctx = document.getElementById('graficoXPWinrate');
    if (charts.xpLine) charts.xpLine.destroy();
    charts.xpLine = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.xp_bucket > 0 ? `+${d.xp_bucket}` : d.xp_bucket),
            datasets: [{ label: 'Win Rate %', data: data.map(d=>d.win_rate), borderColor: THEME.gold, backgroundColor: 'rgba(200,170,110,0.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: {max: 100, beginAtZero: true} } }
    });
}

function renderizarRelacionais(regressoes, amostra) {
    const configs = [
        { id: 'relChart1', key: 'rel1', x: "Deaths até 12min", y: 'Deaths' },
        { id: 'relChart2', key: 'rel2', x: 'Vision Score/Min', y: 'Kill Participation' },
        { id: 'relChart3', key: 'rel3', x: "Deaths até 12min", y: "XP Diff 12'" },
        { id: 'relChart4', key: 'rel4', x: 'Kill Participation', y: "XP Diff 12'" },
        { id: 'relChart5', key: 'rel5', x: "Gold Diff 12'", y: "CS Diff 12'" },
        { id: 'relChart6', key: 'rel6', x: 'Deaths', y: 'Kill Participation' }
    ];
    configs.forEach(cfg => {
        const ctx = document.getElementById(cfg.id); if(!ctx) return;
        const reg = regressoes.find(r => r.chart_id === cfg.key); if(!reg) return;
        const lineData = [{x: reg.x_min, y: (reg.slope*reg.x_min)+reg.intercept}, {x: reg.x_max, y: (reg.slope*reg.x_max)+reg.intercept}];
        const points = amostra.map(d => ({x: d[cfg.x]||0, y: d[cfg.y]||0}));
        new Chart(ctx, {
            type: 'scatter',
            data: { datasets: [{label:'Amostra', data: points, backgroundColor: THEME.blue, radius: 2}, {type:'line', label:`R²=${reg.r2}`, data: lineData, borderColor: '#fff', borderWidth: 2, pointRadius:0}] },
            options: { responsive: true, maintainAspectRatio: false, plugins: {legend:{display:false}, title:{display:true, text:`R²=${reg.r2}`}}, scales: {x:{display:false}, y:{grid:{color: THEME.grid}}} }
        });
    });
}

async function carregarImagens(dados) {
    const map = {}; await Promise.all(dados.map(d => new Promise(resolve => {
        const img = new Image(); let name = d.Champion==="FiddleSticks"?"Fiddlesticks":d.Champion;
        img.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${name}.png`; img.onload = () => { map[d.Champion]=img; resolve(); }; img.onerror=resolve;
    }))); return map;
}

// ==========================================
// 4. LÓGICA DE BENCHMARK KR (NOVOS GRÁFICOS)
// ==========================================
function initBenchmarkCharts() {
    const normalize = (val, max) => Math.min((val / max) * 100, 120);

    // Cores auxiliares
    const colorGoldAlpha = 'rgba(200, 170, 110, 0.2)';
    const colorBlueAlpha = 'rgba(83, 131, 232, 0.2)';
    
    // 1. MATCHUP SCATTER
    const ctxMatchup = document.getElementById('chartMatchup');
    if (ctxMatchup) {
        new Chart(ctxMatchup, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Suas Partidas',
                        data: USER_MOCK.matchups.map(m => ({ x: m.x, y: m.y === 1 ? 100 : 0 })),
                        backgroundColor: (ctx) => ctx.raw?.y === 100 ? THEME.gold : THEME.red,
                        pointRadius: 6
                    },
                    {
                        label: 'Zona KR',
                        data: [{x: 1000, y: 55}], 
                        pointStyle: 'crossRot', borderColor: '#fff', pointRadius: 10
                    }
                ]
            },
            options: {
                maintainAspectRatio: false,
                scales: {
                    x: { title: {display: true, text: 'Gold Diff @ 14', color: '#fff'}, grid: {color: c=>c.tick.value===0?'#fff':THEME.grid} },
                    y: { min: -10, max: 110, display: false }
                },
                plugins: { legend: {display: false} }
            }
        });
    }

    // 2. EVOLUÇÃO FARM
    const ctxFarmEvo = document.getElementById('chartFarmEvo');
    if (ctxFarmEvo) {
        new Chart(ctxFarmEvo, {
            type: 'line',
            data: {
                labels: Array.from({length: 20}, (_, i) => i + 1),
                datasets: [
                    {
                        label: 'Média KR', data: Array(20).fill(KR_BENCHMARK.avgCsMin),
                        borderColor: '#fff', borderWidth: 2, borderDash: [5, 5], pointRadius: 0, tension: 0
                    },
                    {
                        label: 'Você', data: USER_MOCK.csHistory,
                        borderColor: THEME.gold, backgroundColor: colorGoldAlpha, fill: true, tension: 0.3, pointRadius: 3
                    }
                ]
            },
            options: { maintainAspectRatio: false, scales: { y: { beginAtZero: false, min: 4 } }, plugins: { legend: {display: false} } }
        });
    }

    // 3. RADAR
    const ctxRadar = document.getElementById('chartRadar');
    if (ctxRadar) {
        new Chart(ctxRadar, {
            type: 'radar',
            data: {
                labels: ['Dano', 'Farm', 'Visão', 'Gold@14', 'Objetivos', 'Sobrev.'],
                datasets: [
                    {
                        label: 'KR Benchmark', data: [100, 100, 100, 100, 100, 100],
                        borderColor: '#fff', borderWidth: 1, pointRadius: 0, backgroundColor: 'transparent'
                    },
                    {
                        label: 'Você',
                        data: [
                            normalize(USER_MOCK.stats.dpm, KR_BENCHMARK.avgDpm),
                            normalize(USER_MOCK.stats.csMin, KR_BENCHMARK.avgCsMin),
                            normalize(USER_MOCK.stats.visMin, KR_BENCHMARK.avgVisionScore),
                            normalize(USER_MOCK.stats.gold14, KR_BENCHMARK.goldAt14),
                            normalize(USER_MOCK.stats.objPart, KR_BENCHMARK.objParticipation),
                            normalize(USER_MOCK.stats.survival, KR_BENCHMARK.survivalScore)
                        ],
                        borderColor: THEME.blue, backgroundColor: 'rgba(83, 131, 232, 0.4)', pointBackgroundColor: THEME.blue
                    }
                ]
            },
            options: {
                maintainAspectRatio: false,
                scales: { r: { angleLines: {color: THEME.grid}, grid: {color: THEME.grid}, pointLabels: {color: '#fff', font: {size: 11}}, ticks: {display: false}, suggestedMin: 0, suggestedMax: 100 } }
            }
        });
    }

    // 4. BUBBLE CARRY
    const ctxCarry = document.getElementById('chartCarryBenchmark');
    if (ctxCarry) {
        new Chart(ctxCarry, {
            type: 'bubble',
            data: {
                datasets: [
                    {
                        label: 'KR Ideal', data: [{x: KR_BENCHMARK.carrySweetSpot.x, y: KR_BENCHMARK.carrySweetSpot.y, r: 15}],
                        backgroundColor: '#fff', borderColor: '#fff', pointStyle: 'star'
                    },
                    {
                        label: 'Você', data: [{x: 450, y: 500, r: 8}, {x: 520, y: 600, r: 10}, {x: 400, y: 350, r: 6}],
                        backgroundColor: THEME.gold, borderColor: 'transparent'
                    }
                ]
            },
            options: {
                maintainAspectRatio: false,
                scales: { x: {title: {display: true, text: 'Ouro/Min', color: THEME.text}}, y: {title: {display: true, text: 'Dano/Min', color: THEME.text}} },
                plugins: { legend: {display: false} }
            }
        });
    }

    // 5. DNA (BAR)
    const ctxDNA = document.getElementById('chartDNA');
    if (ctxDNA) {
        const dnaData = [
            USER_MOCK.stats.csMin - KR_BENCHMARK.avgCsMin,
            (USER_MOCK.stats.gold14 - KR_BENCHMARK.goldAt14)/100,
            (USER_MOCK.stats.dpm - KR_BENCHMARK.avgDpm)/50,
            USER_MOCK.stats.visMin - KR_BENCHMARK.avgVisionScore,
            USER_MOCK.stats.objPart - KR_BENCHMARK.objParticipation
        ];
        new Chart(ctxDNA, {
            type: 'bar',
            data: {
                labels: ['CS', 'Gold', 'Dano', 'Visão', 'Obj'],
                datasets: [{ data: dnaData, backgroundColor: c => c.raw >= 0 ? THEME.gold : THEME.red, borderRadius: 4 }]
            },
            options: {
                indexAxis: 'y', maintainAspectRatio: false,
                scales: { x: { grid: { color: c=>c.tick.value===0?'#fff':'transparent' }, ticks: {display: false} }, y: { grid: {display: false} } },
                plugins: { legend: {display: false} }
            }
        });
    }

    // 6. POWER SPIKE (LINE)
    const ctxPower = document.getElementById('chartPowerSpike');
    if (ctxPower) {
        new Chart(ctxPower, {
            type: 'line',
            data: {
                labels: ['5 min', '11 min', '14 min', '20 min'],
                datasets: [
                    { label: 'KR Ritmo', data: KR_BENCHMARK.powerCurve, borderColor: '#fff', borderDash: [5, 5], tension: 0.4 },
                    { label: 'Você', data: USER_MOCK.powerCurve, borderColor: THEME.blue, backgroundColor: colorBlueAlpha, fill: true, tension: 0.4 }
                ]
            },
            options: { maintainAspectRatio: false, scales: { y: { title: {display: true, text: 'Gold Diff Acumulado'} } }, plugins: { legend: {display: false} } }
        });
    }
}

init();
