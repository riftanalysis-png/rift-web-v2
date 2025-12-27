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
// RENDERIZAÇÃO DOS GRÁFICOS
// =========================================================
async function renderizarGraficos(dados) {
    // Pegamos as últimas 20 partidas para o gráfico não ficar poluido demais
    const dadosRecentes = dados.slice(-20);

    // 1. Carregar imagens dos campeões (necessário para o Chart.js desenhar dentro da bolha)
    const imagensMap = await carregarImagensCampeoes(dadosRecentes);

    // --- GRÁFICO DE BOLHAS (SCATTER / BUBBLE) ---
    const ctx1 = document.getElementById('graficoPrincipal');
    
    if (ctx1) {
        if (chartBubble) chartBubble.destroy();

        // Mapeando os dados para o formato X, Y, R
        const bubbleData = dadosRecentes.map(d => {
            // --- CÁLCULO DO TAMANHO (RAIO) ---
            // Fórmula solicitada: (Gold Earned / Duração em Minutos) / 450 * 100
            // Nota: No banco, 'Game Duration' já está em minutos.
            
            let duracaoMinutos = d['Game Duration']; 
            
            // Fallback: Se for uma partida antiga sem 'Game Duration', calculamos aproximado pelo Gold/Min
            if (!duracaoMinutos || duracaoMinutos === 0) {
                duracaoMinutos = d['Gold Earned'] / (d['Gold/Min'] || 1);
            }

            // GPM = Gold Per Minute
            const gpm = d['Gold Earned'] / duracaoMinutos;
            
            // Valor Bruto da fórmula do usuário
            const tamanhoBruto = (gpm / 450) * 100; 

            // AJUSTE VISUAL: 
            // Um raio (r) de 100px gera uma bolha de 200px de largura. Isso cobriria o gráfico todo.
            // Dividimos por 5 para manter a proporção mas caber na tela.
            // Você pode remover o "/ 5" se quiser bolhas gigantes reais.
            const tamanhoVisual = tamanhoBruto / 5; 

            return {
                x: d['Damage/Min'], // Eixo X
                y: d['Gold/Min'],   // Eixo Y
                r: tamanhoVisual,   // Tamanho da Bolha
                
                // Dados extras para cor e imagem
                champion: d['Champion'],
                win: d['Win Rate %'] === 1,
                
                // Dados originais para o Tooltip
                rawGpm: gpm.toFixed(0),
                rawDamage: d['Damage/Min'].toFixed(0)
            };
        });

        chartBubble = new Chart(ctx1, {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Performance Recente',
                    data: bubbleData,
                    
                    // --- IMAGEM DENTRO DA BOLHA ---
                    pointStyle: bubbleData.map(d => imagensMap[d.champion]), 
                    
                    // --- CORES (Azul = Vitória, Vermelho = Derrota) ---
                    borderColor: bubbleData.map(d => d.win ? '#00BFFF' : '#FF4500'), // Ciano ou Laranja/Vermelho
                    borderWidth: 3, // Borda grossa para identificar fácil
                    
                    // Fundo translúcido da cor da borda (caso a imagem tenha transparência)
                    backgroundColor: bubbleData.map(d => d.win ? 'rgba(0, 191, 255, 0.1)' : 'rgba(255, 69, 0, 0.1)'),
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }, // Não precisa de legenda, cada bolha é um jogo
                    tooltip: {
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                const d = context.raw;
                                const resultado = d.win ? "Vitória" : "Derrota";
                                return `${d.champion} (${resultado}) | Dano/min: ${d.rawDamage} | Gold/min: ${d.rawGpm}`;
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
            }
        });
    }

    // --- GRÁFICO 2: BARRAS DE FARM (MANTIDO) ---
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
                    x: { ticks: { color: '#aaa' }, grid: { display: false } }
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
