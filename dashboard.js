// =========================================================
// SETUP BÁSICO
// 1. CONFIGURAÇÃO E VARIÁVEIS GLOBAIS
// =========================================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos da UI
const UI = {
    search: document.getElementById('playerSearch'),
    logout: document.getElementById('logoutBtn')
    logout: document.getElementById('logoutBtn'),
    loading: document.getElementById('loadingIndicator'), // Se tiver um loading
    statsContainer: document.getElementById('stats-container') // Container dos gráficos
};

// Variáveis para guardar as instâncias dos gráficos (para poder destruir e recriar)
let chartGold = null;
let chartDamage = null;

// =========================================================
// INICIALIZAÇÃO
// 2. INICIALIZAÇÃO
// =========================================================
function init() {
    console.log("Modo de Debug Ativado 🛠️");
    console.log("🚀 Dashboard Iniciado - Versão Final com Gráficos");

    // Logout
    UI.logout.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
    });
    if(UI.logout) {
        UI.logout.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.href = "index.html";
        });
    }

    // Evento de Busca (Enter)
    UI.search.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const termo = UI.search.value;
            console.clear(); // Limpa o console para facilitar a leitura
            console.log(`🔎 Iniciando busca por: "${termo}"...`);
            fetchAndLogMatches(termo);
        }
    });
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
// FUNÇÃO DE DIAGNÓSTICO
// 3. BUSCA E TRATAMENTO DE DADOS
// =========================================================
async function fetchAndLogMatches(nick) {
async function buscarDados(nick) {
    console.clear();
    console.log(`🔎 Buscando dados para: "${nick}"...`);

    try {
        // 1. Busca ampla no banco
        const { data, error } = await supabaseClient
            .from('partidas_br')
            .select('*')
            .ilike('Player Name', `%${nick}%`);

        if (error) {
            console.error("❌ Erro no Supabase:", error);
            return;
        }
            .ilike('Player Name', `%${nick}%`)
            .order('Game Start Time', { ascending: true }); // Pega do mais antigo pro mais novo para o gráfico ficar cronológico

        if (error) throw error;
        if (!data || data.length === 0) {
            console.warn("⚠️ Nenhum dado bruto encontrado no banco.");
            console.warn("Nenhum dado encontrado.");
            alert("Jogador não encontrado ou sem partidas processadas.");
            return;
        }

        console.log(`📦 Dados brutos recebidos: ${data.length} linhas.`);

        // 2. Filtro Rigoroso (Lógica Excel)
        // Só aceita se o nome do jogador contiver o termo pesquisado
        // --- FILTRO DE NOME ---
        const dadosDoJogador = data.filter(linha => 
            linha['Player Name'].toLowerCase().includes(nick.toLowerCase())
        );

        console.log(`👤 Linhas correspondentes ao nick "${nick}" (antes da limpeza): ${dadosDoJogador.length}`);

        // =========================================================
        // 2.5. REMOÇÃO DE DUPLICATAS (NOVO CÓDIGO)
        // =========================================================
        // Criamos um Map onde a chave é o 'Match ID'.
        // Como o Map não aceita chaves repetidas, ele mantém apenas uma versão de cada partida.
        // --- REMOÇÃO DE DUPLICATAS (A CORREÇÃO) ---
        // Usa Match ID como chave única
        const dadosUnicos = Array.from(
            new Map(dadosDoJogador.map(item => [item['Match ID'], item])).values()
        );

        console.log(`✨ Linhas ÚNICAS após remover duplicatas: ${dadosUnicos.length}`);
        // =========================================================

        // 3. Extração dos Dados Solicitados (Match ID e Champion)
        // AGORA USAMOS 'dadosUnicos' EM VEZ DE 'dadosDoJogador'
        const resultadoLimpo = dadosUnicos.map(linha => {
            return {
                MatchID: linha['Match ID'],
                Champion: linha['Champion'],
                // Adicionei o PlayerName só para vc confirmar que é o cara certo
                PlayerName: linha['Player Name'] 
            };
        });
        console.log(`✅ ${dadosUnicos.length} partidas únicas encontradas.`);

        // 4. Exibe a tabela no Console
        console.table(resultadoLimpo);
        // --- FORMATAÇÃO FINAL PARA O DASHBOARD ---
        const dadosFormatados = dadosUnicos.map(linha => ({
            ...linha,
            DataFormatada: formatarData(linha['Game Start Time']),
            KDA_Calculado: (linha['Kills'] + linha['Assists']) / (linha['Deaths'] === 0 ? 1 : linha['Deaths'])
        }));

        // Verifica se tem duplicatas visuais (Agora deve dar sucesso ✅)
        verificarDuplicatas(resultadoLimpo);
        // Renderiza tudo na tela
        atualizarInterface(dadosFormatados);

    } catch (err) {
        console.error("Erro fatal:", err);
        console.error("Erro na busca:", err);
    }
}

function verificarDuplicatas(lista) {
    const ids = lista.map(item => item.MatchID);
    const unicos = new Set(ids);
// =========================================================
// 4. FUNÇÕES DE RENDERIZAÇÃO (GRÁFICOS E DOM)
// =========================================================
function atualizarInterface(dados) {
    // Aqui você pode atualizar cards de texto (Média de KDA, Winrate, etc) se tiver
    // Exemplo: document.getElementById('kda-display').innerText = calcularMediaKDA(dados);

    // Renderizar os Gráficos
    renderizarGraficos(dados);
}

function renderizarGraficos(dados) {
    // Prepara os arrays para o Chart.js
    // Pegamos os últimos 10 jogos para não poluir demais o gráfico
    const dadosRecentes = dados.slice(-10); 

    if (ids.length !== unicos.size) {
        console.warn(`⚠️ ATENÇÃO: Há ${ids.length - unicos.size} Match IDs duplicados nesta lista!`);
    } else {
        console.log("✅ Não foram encontradas duplicatas de Match ID na lista filtrada.");
    const labels = dadosRecentes.map(d => `${d.Champion} (${d.DataFormatada.split(' ')[0]})`);
    const goldData = dadosRecentes.map(d => d['Gold Earned']);
    const damageData = dadosRecentes.map(d => d['Total Damage Dealt']);
    const csData = dadosRecentes.map(d => d['Farm/Min']);

    // --- GRÁFICO 1: OURO E DANO ---
    const ctx1 = document.getElementById('graficoPrincipal'); // Verifique se tem esse ID no HTML
    if (ctx1) {
        if (chartGold) chartGold.destroy(); // Destrói anterior se existir

        chartGold = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Ouro Total',
                        data: goldData,
                        borderColor: '#FFD700', // Dourado
                        backgroundColor: 'rgba(255, 215, 0, 0.1)',
                        yAxisID: 'y',
                        tension: 0.3
                    },
                    {
                        label: 'Dano Causado',
                        data: damageData,
                        borderColor: '#FF4500', // Laranja Avermelhado
                        backgroundColor: 'rgba(255, 69, 0, 0.1)',
                        yAxisID: 'y1', // Eixo separado
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Ouro' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'Dano' },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    }

    // --- GRÁFICO 2: FARM POR MINUTO ---
    const ctx2 = document.getElementById('graficoFarm'); // Verifique se tem esse ID no HTML
    if (ctx2) {
        if (chartDamage) chartDamage.destroy();

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
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'CS/Min' }
                    }
                }
            }
        });
    }
}

// =========================================================
// 5. UTILITÁRIOS
// =========================================================
function formatarData(timestamp) {
    if (!timestamp) return "";
    const data = new Date(timestamp);
    return data.toLocaleString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit'
    });
}

// Inicia
init();
