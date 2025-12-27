// =========================================================
// SETUP BÁSICO & CONFIGURAÇÃO
// =========================================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "SUA_CHAVE_AQUI";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

const UI = {
    search: document.getElementById('playerSearch'),
    logout: document.getElementById('logoutBtn')
};

let chartBubble = null;
let chartBar = null;

// =========================================================
// INIT
// =========================================================
function init() {
    console.log("🚀 Dashboard iniciado");

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
// BUSCA DE DADOS
// =========================================================
async function buscarDados(nick) {
    console.clear();
    console.log(`🔎 Buscando jogador: ${nick}`);

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

        const dadosUnicos = Array.from(
            new Map(
                data.map(item => [item['Match ID'], item])
            ).values()
        );

        renderizarGraficos(dadosUnicos.slice(-20));

    } catch (err) {
        console.error("Erro ao buscar dados:", err);
    }
}

// =========================================================
// RENDERIZAÇÃO DOS GRÁFICOS
// =========================================================
async function renderizarGraficos(dados) {

    const imagensMap = await carregarImagensCampeoes(dados);

    // =====================================================
    // GRÁFICO 1 — CARRY VOLUME (BUBBLE)
    // =====================================================
    const ctx1 = document.getElementById('graficoPrincipal');
    if (!ctx1) return;

    if (chartBubble) chartBubble.destroy();

    const bubbleData = dados.map(d => {

        const gpm = d['Gold/Min'] 
            ? d['Gold/Min']
            : d['Gold Earned'] / ((d['Game Duration'] || 1800) / 60);

        const dpm = d['Damage/Min'];

        // NORMALIZAÇÃO DO RAIO (VISUALMENTE CORRETA)
        const minGPM = 300;
        const maxGPM = 600;

        const radius = Math.min(
            24,
            Math.max(
                8,
                ((gpm - minGPM) / (maxGPM - minGPM)) * 16 + 8
            )
        );

        return {
            x: dpm,
            y: gpm,
            r: radius,
            champion: d['Champion'],
            win: d['Win Rate %'] === 1,
            gpm: gpm.toFixed(0),
            dpm: dpm.toFixed(0)
        };
    });

    // =====================================================
    // PLUGIN DE AVATAR REDONDO
    // =====================================================
    const imageProfilePlugin = {
        id: 'customAvatar',
        afterDatasetDraw(chart) {
            const { ctx } = chart;
            const meta = chart.getDatasetMeta(0);

            meta.data.forEach((element, index) => {
                const d = bubbleData[index];
                const img = imagensMap[d.champion];
                if (!img || img === 'circle') return;

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
                ctx.strokeStyle = d.win ? '#00BFFF' : '#FF4500';
                ctx.stroke();
            });
        }
    };

    chartBubble = new Chart(ctx1, {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Carry Volume',
                data: bubbleData,
                backgroundColor: 'transparent',
                borderColor: 'transparent'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label(ctx) {
                            const d = ctx.raw;
                            return [
                                `${d.champion} (${d.win ? 'Vitória' : 'Derrota'})`,
                                `DPM: ${d.dpm}`,
                                `GPM: ${d.gpm}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Damage / Min', color: '#aaa' },
                    grid: { color: '#333' },
                    ticks: { color: '#eee' }
                },
                y: {
                    title: { display: true, text: 'Gold / Min', color: '#aaa' },
                    grid: { color: '#333' },
                    ticks: { color: '#eee' }
                }
            }
        },
        plugins: [imageProfilePlugin]
    });

    // =====================================================
    // GRÁFICO 2 — FARM
    // =====================================================
    const ctx2 = document.getElementById('graficoFarm');
    if (!ctx2) return;

    if (chartBar) chartBar.destroy();

    chartBar = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: dados.map(d => d.Champion),
            datasets: [{
                label: 'CS / Min',
                data: dados.map(d => d['Farm/Min']),
                backgroundColor: '#4BC0C0'
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

// =========================================================
// CARREGAMENTO DE IMAGENS
// =========================================================
async function carregarImagensCampeoes(dados) {
    const map = {};
    const promises = dados.map(d => new Promise(resolve => {

        const img = new Image();
        let champ = d.Champion;

        if (champ === "FiddleSticks") champ = "Fiddlesticks";
        if (champ === "Renata") champ = "RenataGlasc";

        img.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${champ}.png`;
        img.onload = () => {
            map[d.Champion] = img;
            resolve();
        };
        img.onerror = () => {
            map[d.Champion] = 'circle';
            resolve();
        };
    }));

    await Promise.all(promises);
    return map;
}

// =========================================================
// START
// =========================================================
init();
