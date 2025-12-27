// =========================================================
// SETUP BÁSICO & CONFIGURAÇÃO
// =========================================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const UI = {
    search: document.getElementById('playerSearch'),
    logout: document.getElementById('logoutBtn')
};

let chartBubble = null;
let chartBar = null;

// =========================================================
// INICIALIZAÇÃO
// =========================================================
function init() {
    console.log("🚀 Dashboard de Bolhas Iniciado");

    if(UI.logout) {
        UI.logout.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.href = "index.html";
        });
    }

    if(UI.search) {
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
    console.log(`🔎 Buscando: "${nick}"...`);

    try {
        // Ordena por data para pegar os mais recentes
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

        // Filtra pelo nome exato (case insensitive)
        const dadosDoJogador = data.filter(linha => 
            linha['Player Name'].toLowerCase().includes(nick.toLowerCase())
        );

        // Remove duplicatas de Match ID
        const dadosUnicos = Array.from(
            new Map(dadosDoJogador.map(item => [item['Match ID'], item])).values()
        );

        console.log(`✅ ${dadosUnicos.length} partidas carregadas.`);
        
        // Renderiza
        renderizarGraficos(dadosUnicos);

    } catch (err) {
        console.error("Erro:", err);
    }
}

// =========================================================
// RENDERIZAÇÃO DOS GRÁFICOS (COM PLUGIN DE CÍRCULOS)
// =========================================================
async function renderizarGraficos(dados) {
    // Pegamos as últimas 20 partidas
    const dadosRecentes = dados.slice(-20);

    // 1. Carrega imagens
    const imagensMap = await carregarImagensCampeoes(dadosRecentes);

    // --- GRÁFICO 1: BUBBLE CHART (PERSONALIZADO) ---
    const ctx1 = document.getElementById('graficoPrincipal');
    
    if (ctx1) {
        if (chartBubble) chartBubble.destroy();

        // Preparar dados
        const bubbleData = dadosRecentes.map(d => {
            // Sua Fórmula: (Gold Earned / Duration) = GPM.
            // (GPM / 450 * 100) -> Isso gera números como 80, 100, 120.
            // Para pixels na tela, isso é muito grande (raio 100 = 200px largura).
            // Vou dividir por 3.5 para ficar visualmente agradável (bolhas de ~30px a ~60px).
            
            let duracao = d['Game Duration'] || (d['Gold Earned'] / (d['Gold/Min'] || 1));
            const gpm = d['Gold Earned'] / duracao;
            const rawSize = (gpm / 450) * 100; 
            const radiusPixel = rawSize / 3.5; 

            return {
                x: d['Damage/Min'],
                y: d['Gold/Min'],
                r: radiusPixel, // O raio exato em pixels
                champion: d['Champion'],
                win: d['Win Rate %'] === 1,
                gpm: gpm.toFixed(0)
            };
        });

        // --- O SEGREDO: PLUGIN CUSTOMIZADO ---
        // Esse bloco ensina o Chart.js a desenhar imagens redondas
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
                    const radius = element.options.radius; // Pega o raio calculado

                    ctx.save();
                    
                    // 1. Cria o caminho do Círculo
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.closePath();
                    
                    // 2. Recorta (Clip) tudo que estiver fora do círculo
                    ctx.clip();
                    
                    // 3. Desenha a imagem esticada para caber no quadrado do círculo
                    // (x - radius) é o canto superior esquerdo
                    ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
                    
                    // 4. Restaura para poder desenhar a borda por cima sem cortar
                    ctx.restore();

                    // 5. Desenha a Borda Colorida (Vitória/Derrota)
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.lineWidth = 3; // Grossura da borda
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
                    // Deixamos a cor de fundo transparente pois o plugin vai desenhar a imagem
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
                            label: function(context) {
                                const d = context.raw;
                                const status = d.win ? "Vitória" : "Derrota";
                                return `${d.champion} (${status}) | Dano: ${d.x.toFixed(0)} | GPM: ${d.gpm}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Dano por Minuto', color: '#aaa' },
                        grid: { color: '#333' },
                        ticks: { color: '#eee' }
                    },
                    y: {
                        title: { display: true, text: 'Ouro por Minuto', color: '#aaa' },
                        grid: { color: '#333' },
                        ticks: { color: '#eee' }
                    }
                }
            },
            // IMPORTANTE: Registrar o plugin aqui
            plugins: [imageProfilePlugin]
        });
    }

    // --- GRÁFICO 2: MANTIDO IGUAL ---
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
}

// =========================================================
// UTILITÁRIO: CARREGADOR DE IMAGENS
// =========================================================
async function carregarImagensCampeoes(dados) {
    const map = {};
    // Cria uma lista de promessas para carregar todas as imagens em paralelo
    const promessas = dados.map(d => {
        return new Promise((resolve) => {
            const img = new Image();
            
            // Tratamento de nomes especiais da Riot
            let champName = d.Champion;
            if(champName === "FiddleSticks") champName = "Fiddlesticks"; 
            if(champName === "Renata") champName = "RenataGlasc"; 
            
            // URL do DataDragon (Ícone quadrado)
            img.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${champName}.png`;
            
            // Tamanho base da imagem desenhada (não afeta o raio da bolha diretamente, mas a resolução)
            img.width = 50; 
            img.height = 50;
            
            img.onload = () => {
                map[d.Champion] = img;
                resolve();
            };
            img.onerror = () => {
                // Se der erro (ex: campeão novo não listado na versão 14.1.1), desenha uma bolha normal
                map[d.Champion] = 'circle'; 
                resolve();
            };
        });
    });

    await Promise.all(promessas);
    return map;
}

// Inicia
init();
