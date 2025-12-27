// =========================================================
// 1. CONFIGURAÇÃO E VARIÁVEIS GLOBAIS
// =========================================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos da UI
const UI = {
    search: document.getElementById('playerSearch'),
    logout: document.getElementById('logoutBtn'),
    loading: document.getElementById('loadingIndicator'), // Se tiver um loading
    statsContainer: document.getElementById('stats-container') // Container dos gráficos
};

// Variáveis para guardar as instâncias dos gráficos (para poder destruir e recriar)
let chartGold = null;
let chartDamage = null;

// =========================================================
// 2. INICIALIZAÇÃO
// =========================================================
function init() {
    console.log("🚀 Dashboard Iniciado - Versão Final com Gráficos");

    if(UI.logout) {
        UI.logout.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.href = "index.html";
        });
    }

    if(UI.search) {
        UI.search.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const termo = UI.search.value;
                buscarDados(termo);
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
        const { data, error } = await supabaseClient
            .from('partidas_br')
            .select('*')
            .ilike('Player Name', `%${nick}%`)
            .order('Game Start Time', { ascending: true }); // Pega do mais antigo pro mais novo para o gráfico ficar cronológico

        if (error) throw error;
        if (!data || data.length === 0) {
            console.warn("Nenhum dado encontrado.");
            alert("Jogador não encontrado ou sem partidas processadas.");
            return;
        }

        // --- FILTRO DE NOME ---
        const dadosDoJogador = data.filter(linha => 
            linha['Player Name'].toLowerCase().includes(nick.toLowerCase())
        );

        // --- REMOÇÃO DE DUPLICATAS (A CORREÇÃO) ---
        // Usa Match ID como chave única
        const dadosUnicos = Array.from(
            new Map(dadosDoJogador.map(item => [item['Match ID'], item])).values()
        );

        console.log(`✅ ${dadosUnicos.length} partidas únicas encontradas.`);

        // --- FORMATAÇÃO FINAL PARA O DASHBOARD ---
        const dadosFormatados = dadosUnicos.map(linha => ({
            ...linha,
            DataFormatada: formatarData(linha['Game Start Time']),
            KDA_Calculado: (linha['Kills'] + linha['Assists']) / (linha['Deaths'] === 0 ? 1 : linha['Deaths'])
        }));

        // Renderiza tudo na tela
        atualizarInterface(dadosFormatados);

    } catch (err) {
        console.error("Erro na busca:", err);
    }
}

// =========================================================
// 4. FUNÇÕES DE RENDERIZAÇÃO (ATUALIZADO PARA BOLHAS)
// =========================================================

function atualizarInterface(dados) {
    // Chama a função assíncrona de gráficos
    renderizarGraficos(dados);
}

async function renderizarGraficos(dados) {
    // 1. Prepara os dados (Limitando aos últimos 20 para não poluir visualmente)
    const dadosRecentes = dados.slice(-20);

    // 2. Carrega as imagens dos campeões ANTES de criar o gráfico
    // Precisamos disso porque o Chart.js precisa do objeto Image pronto
    const imagensMap = await carregarImagensCampeoes(dadosRecentes);

    // --- GRÁFICO 1: BOLHAS (DANO vs OURO) ---
    const ctx1 = document.getElementById('graficoPrincipal');
    
    if (ctx1) {
        if (chartGold) chartGold.destroy();

        // Configuração dos dados para o formato Bubble
        const bubbleData = dadosRecentes.map(d => {
            // Sua Fórmula de Tamanho: (GoldMin / 450 * 100)
            // Nota: Dividi por 5 no final para o raio ficar visualmente agradável na tela (entre 10px e 30px)
            const rawSize = (d['Gold/Min'] / 450) * 100;
            const visualSize = rawSize / 4; 

            return {
                x: d['Damage/Min'],
                y: d['Gold/Min'],
                r: visualSize, // Raio da bolha
                champion: d['Champion'], // Guardamos o nome para usar no tooltip
                win: d['Win Rate %'] === 1 // Guardamos se ganhou para a cor
            };
        });

        chartGold = new Chart(ctx1, {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Performance',
                    data: bubbleData,
                    // Lógica para colocar a IMAGEM no lugar da bolha
                    pointStyle: bubbleData.map(d => imagensMap[d.champion]), 
                    
                    // Cor da Borda (Azul = Win, Vermelho = Loss)
                    borderColor: bubbleData.map(d => d.win ? '#00BFFF' : '#FF4500'),
                    borderWidth: 3, // Borda grossa para ver bem a cor
                    
                    // Fundo levemente transparente caso a imagem falhe
                    backgroundColor: bubbleData.map(d => d.win ? 'rgba(0, 191, 255, 0.2)' : 'rgba(255, 69, 0, 0.2)'),
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Permite ajustar altura via CSS
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const d = context.raw;
                                return `${d.champion}: ${d.x.toFixed(0)} Dano/min, ${d.y.toFixed(0)} Gold/min`;
                            }
                        }
                    },
                    legend: { display: false } // Esconde legenda pois cada ponto é único
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Dano por Minuto', color: '#ccc' },
                        grid: { color: '#333' },
                        ticks: { color: '#aaa' }
                    },
                    y: {
                        title: { display: true, text: 'Ouro por Minuto', color: '#ccc' },
                        grid: { color: '#333' },
                        ticks: { color: '#aaa' }
                    }
                }
            }
        });
    }

    // --- GRÁFICO 2: MANTÉM O DE FARM ---
    const ctx2 = document.getElementById('graficoFarm');
    if (ctx2) {
        if (chartDamage) chartDamage.destroy();
        
        // Dados simples para o gráfico de barras
        const labels = dadosRecentes.map(d => `${d.Champion}`);
        const csData = dadosRecentes.map(d => d['Farm/Min']);

        chartDamage = new Chart(ctx2, {
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
                    x: { grid: { display: false } }
                }
            }
        });
    }
}

// =========================================================
// FUNÇÃO AUXILIAR: CARREGAR IMAGENS
// =========================================================
async function carregarImagensCampeoes(dados) {
    const map = {};
    const promessas = dados.map(d => {
        return new Promise((resolve) => {
            const img = new Image();
            // URL Oficial da Riot (DataDragon) - Versão 14.1.1 (pode atualizar se quiser)
            // Tratamento simples para nomes (Ex: Wukong no DB as vezes é MonkeyKing, mas geralmente a API já manda certo)
            let champName = d.Champion;
            if(champName === "FiddleSticks") champName = "Fiddlesticks"; 

            img.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${champName}.png`;
            img.width = 40; // Tamanho base
            img.height = 40;
            
            img.onload = () => {
                map[d.Champion] = img;
                resolve();
            };
            img.onerror = () => {
                // Se falhar (ex: novo champ), usa uma bolha padrão
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
