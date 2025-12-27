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

// Variáveis Globais para guardar as instâncias dos gráficos
let chartBubble = null;
let chartBar = null;
let chartXP = null;
let chartImpacto = null;

// =========================================================
// 2. INICIALIZAÇÃO
// =========================================================
function init() {
    console.log("🚀 Dashboard Completo Iniciado");

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
// 3. BUSCA E TRATAMENTO DE DADOS
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

        // Remove duplicatas usando Match ID como chave
        const dadosUnicos = Array.from(
            new Map(dadosDoJogador.map(item => [item['Match ID'], item])).values()
        );

        console.log(`✅ ${dadosUnicos.length} partidas únicas carregadas.`);
        
        renderizarGraficos(dadosUnicos);

    } catch (err) {
        console.error("Erro:", err);
    }
}

// =========================================================
// 4. RENDERIZAÇÃO DOS GRÁFICOS
// =========================================================
async function renderizarGraficos(dados) {
    // Para Bolhas e Barras de Farm: Apenas os últimos 20 jogos (Visual limpo)
    const dadosRecentes = dados.slice(-20);
    
    // Para Probabilidade e Impacto (Estatísticas): Usa TODOS os dados
    const dadosCompletos = dados; 

    // Carrega imagens antes de desenhar (necessário para o Bubble Chart)
    const imagensMap = await carregarImagensCampeoes(dadosRecentes);

    // Renderiza cada gráfico
    renderizarBubble(dadosRecentes, imagensMap);
    renderizarFarm(dadosRecentes);
    renderizarXPProbability(dadosCompletos);
    renderizarImpactoXP(dadosCompletos);
}

// ---------------------------------------------------------
// A. GRÁFICO DE BOLHAS (Carry Efficiency)
// ---------------------------------------------------------
function renderizarBubble(dados, imagensMap) {
    const ctx = document.getElementById('graficoPrincipal');
    if (!ctx) return;
    if (chartBubble) chartBubble.destroy();

    const bubbleData = dados.map(d => {
        let duracao = d['Game Duration'] || (d['Gold Earned'] / (d['Gold/Min'] || 1));
        const gpm = d['Gold Earned'] / duracao;

        // --- ESCALA DO TAMANHO ---
        // Se GPM for 450, o raio da bolha será 45px (grande e visível)
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

                // Borda Colorida
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
                    callbacks: {
                        label: (ctx) => `${ctx.raw.champion}: ${ctx.raw.rawDamage} Dano | ${ctx.raw.gpm} GPM`
                    }
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
// B. GRÁFICO DE BARRAS (Farm)
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
// C. GRÁFICO DE LINHA (Probabilidade XP Diff)
// ---------------------------------------------------------
function renderizarXPProbability(dados) {
    const ctx = document.getElementById('graficoXPWinrate');
    if (!ctx) return;
    if (chartXP) chartXP.destroy();

    // Buckets de 500 em 500
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
                x: {
                    title: { display: true, text: 'Vantagem de XP aos 12 min', color: '#aaa' },
                    grid: { color: '#333' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Chance: ${ctx.raw.y.toFixed(1)}% (${ctx.raw.total} jogos)`
                    }
                }
            }
        }
    });
}

// ---------------------------------------------------------
// D. GRÁFICO DE BARRAS (Impacto XP Win vs Loss)
// ---------------------------------------------------------
function renderizarImpactoXP(dados) {
    const ctx = document.getElementById('graficoImpactoXP');
    if (!ctx) return;
    if (chartImpacto) chartImpacto.destroy();

    const vitorias = dados.filter(d => d['Win Rate %'] === 1);
    const derrotas = dados.filter(d => d['Win Rate %'] === 0);

    const somaXP = (lista) => lista.reduce((acc, curr) => {
        const val = curr["XP Diff 12'"] || curr["XP Diff 12"] || 0;
        return acc + val;
    }, 0);

    const mediaWin = vitorias.length > 0 ? somaXP(vitorias) / vitorias.length : 0;
    const mediaLoss = derrotas.length > 0 ? somaXP(derrotas) / derrotas.length : 0;

    chartImpacto = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Vitórias', 'Derrotas'],
            datasets: [{
                label: 'Média XP Diff @ 12 min',
                data: [mediaWin, mediaLoss],
                backgroundColor: ['rgba(0, 191, 255, 0.6)', 'rgba(255, 69, 0, 0.6)'],
                borderColor: ['#00BFFF', '#FF4500'],
                borderWidth: 2,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // 'y' para barras horizontais (como na sua imagem), remova para verticais
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: (ctx) => `Média: ${ctx.raw.toFixed(0)} XP` }
                }
            },
            scales: {
                x: {
                    grid: { color: '#333' },
                    ticks: { color: '#eee' },
                    title: { display: true, text: 'Diferença de XP Média', color: '#aaa' }
                },
                y: { grid: { display: false }, ticks: { color: '#eee', font: { weight: 'bold' } } }
            }
        }
    });
}

// ---------------------------------------------------------
// UTILITÁRIO: CARREGAMENTO DE IMAGENS
// ---------------------------------------------------------
async function carregarImagensCampeoes(dados) {
    const map = {};
    const promessas = dados.map(d => {
        return new Promise((resolve) => {
            const img = new Image();
            let champName = d.Champion;
            // Exceções conhecidas do DataDragon
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
