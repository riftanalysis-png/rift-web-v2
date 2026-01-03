const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const THEME = { gold: '#c8aa6e', red: '#e84057', blue: '#5383e8', text: '#8a92a3', grid: 'rgba(255, 255, 255, 0.05)' };
Chart.defaults.font.family = "'Segoe UI', sans-serif"; Chart.defaults.color = THEME.text; Chart.defaults.borderColor = THEME.grid;

let charts = { bubble: null, bar: null, xpLine: null, xpBox: null, rels: {} };

async function init() {
    document.getElementById('playerSearch').addEventListener('keydown', (e) => { if(e.key === 'Enter') buscarDados(e.target.value); });
    document.getElementById('logoutBtn').addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.href = "index.html"; });
    buscarDados(""); // Busca inicial
}

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
init();
