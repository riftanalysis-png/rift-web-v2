// =========================================================
// 1. CONFIGURAÇÃO E VARIÁVEIS GLOBAIS
// =========================================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const UI = {
    search: document.getElementById('playerSearch'),
    logout: document.getElementById('logoutBtn')
};

// Variáveis para guardar os gráficos e poder destruí-los ao recarregar
let chartBubble = null;
let chartBar = null;

// =========================================================
// 2. INICIALIZAÇÃO
// =========================================================
function init() {
    console.log("🚀 Dashboard Final Iniciado");

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
    console.log(`🔎 Buscando dados para: "${nick}"...`);

    try {
        // Ordena por data para pegar a evolução cronológica
        const { data, error } = await supabaseClient
            .from('partidas_br')
            .select('*')
            .ilike('Player Name', `%${nick}%`)
            .order('Game Start Time', { ascending: true });

        if (error) throw error;
        if (!data || data.length === 0) {
            alert("Jogador não encontrado ou sem partidas processadas.");
            return;
        }

        // Filtro exato de nome
        const dadosDoJogador = data.filter(linha => 
            linha['Player Name'].toLowerCase().includes(nick.toLowerCase())
        );

        // --- REMOÇÃO DE DUPLICATAS ---
        // Usa o Match ID como chave única para garantir que não haja repetições
        const dadosUnicos = Array.from(
            new Map(dadosDoJogador.map(item => [item['Match ID'], item])).values()
        );

        console.log(`✅ ${dadosUnicos.length} partidas únicas carregadas.`);

        // Renderiza os gráficos
        renderizarGraficos(dadosUnicos);

    } catch (err) {
        console.error("Erro na busca:", err);
    }
}

// =========================================================
// 4. RENDERIZAÇÃO DOS GRÁFICOS
// =========================================================
async function renderizarGraficos(dados) {
    // Pega as últimas 20 partidas para não poluir demais a tela
    const dadosRecentes = dados.slice(-20);

    // Carrega as imagens dos campeões ANTES de desenhar
    const imagensMap = await carregarImagensCampeoes(dadosRecentes);

    // --- GRÁFICO 1: BUBBLE CHART (PERSONALIZADO) ---
    const ctx1 = document.getElementById('graficoPrincipal');
    
    if (ctx1) {
        if (chartBubble) chartBubble.destroy();

        // Mapeamento dos dados para o formato do Chart.js
        const bubbleData = dadosRecentes.map(d => {
            // Cálculo da duração (com proteção para dados legados)
            let duracao = d['Game Duration'] || (d['Gold Earned'] / (d['Gold/Min'] || 1));
            
            // GPM Exato
            const gpm = d['Gold Earned'] / duracao;

            // --- AJUSTE DE ESCALA (TAMANHO DA BOLHA) ---
            // ESCALA_BASE define o tamanho em pixels (raio) se o jogador tiver 450 de GPM.
            // 45px de raio = 90px de diâmetro (Bem visível)
            const ESCALA_BASE = 45; 
            const radiusPixel = (gpm / 450) * ESCALA_BASE;

            return {
                x: d['Damage/Min'],
                y: d['Gold/Min'],
                r: radiusPixel,     // Raio calculado
                champion: d['Champion'],
                win: d['Win Rate %'] === 1,
                gpm: gpm.toFixed(0),
                rawDamage: d['Damage/Min'].toFixed(0)
            };
        });

        // --- PLUGIN CUSTOMIZADO: DESENHA IMAGEM REDONDA ---
        const imageProfilePlugin = {
            id: 'customAvatar',
            afterDatasetDraw(chart, args, options) {
                const { ctx } = chart;
                const meta = chart.getDatasetMeta(0);
                
                meta.data.forEach((element, index) => {
                    const dataPoint = bubbleData[index];
                    const img = imagensMap[dataPoint.champion];
                    
                    if (!img) return;

                    const { x, y } = element.tooltipPosition();
                    const radius = element.options.radius; // Pega o raio que calculamos acima

                    ctx.save();
                    
                    // 1. Cria o caminho do Círculo
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.closePath();
                    
                    // 2. Recorta (Clip) tudo que estiver fora
                    ctx.clip();
                    
                    // 3. Desenha a imagem esticada para preencher o círculo
                    ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
                    
                    // 4. Restaura o contexto (sai do modo "recorte")
                    ctx.restore();

                    // 5. Desenha a Borda Colorida por cima
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.lineWidth = 3; 
                    ctx.strokeStyle = dataPoint.win ? '#00BFFF' : '#FF4500'; // Azul ou Vermelho
                    ctx.stroke();
                });
            }
        };

        chartBubble = new Chart(ctx1, {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Performance',
                    data: bubbleData,
                    backgroundColor: 'transparent', // Transparente para ver a imagem
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
                            label: function(context) {
                                const d = context.raw;
                                const status = d.win ? "Vitória" : "Derrota";
                                return `${d.champion} (${status}) | Dano: ${d.rawDamage} | GPM: ${d.gpm}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Dano por Minuto (DPM)', color: '#aaa' },
                        grid: { color: '#333' },
                        ticks: { color: '#eee' }
                    },
                    y: {
                        title: { display: true, text: 'Ouro por Minuto (GPM)', color: '#aaa' },
                        grid: { color: '#333' },
                        ticks: { color: '#eee' }
                    }
                }
            },
            // Registra o plugin nesta instância do gráfico
            plugins: [imageProfilePlugin]
        });
    }

    // --- GRÁFICO 2: BARRAS DE FARM (CS/Min) ---
    const ctx2 = document.getElementById('graficoFarm');
    if (ctx2) {
        if (chartBar) chartBar.destroy();
        
        const labels = dadosRecentes.map(d => d.Champion);
        const csData = dadosRecentes.map(d => d['Farm/Min']);

        chartBar = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'CS por Minuto',
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
                    x: { display: false } // Oculta labels do eixo X para ficar mais limpo
                }
            }
        });
    }
}

// =========================================================
// 5. UTILITÁRIOS (CARREGAMENTO DE IMAGENS)
// =========================================================
async function carregarImagensCampeoes(dados) {
    const map = {};
    const promessas = dados.map(d => {
        return new Promise((resolve) => {
            const img = new Image();
            
            // Tratamento de nomes (Exceções da API da Riot)
            let champName = d.Champion;
            if (champName === "FiddleSticks") champName = "Fiddlesticks"; 
            if (champName === "Renata") champName = "RenataGlasc"; 

            // URL DataDragon
            img.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${champName}.png`;
            
            img.onload = () => {
                map[d.Champion] = img;
                resolve();
            };
            img.onerror = () => {
                // Se der erro, não quebra o gráfico, apenas não desenha a imagem
                console.warn(`Imagem não encontrada para: ${champName}`);
                map[d.Champion] = null; 
                resolve();
            };
        });
    });

    await Promise.all(promessas);
    return map;
}

// Inicializa o script
init();
