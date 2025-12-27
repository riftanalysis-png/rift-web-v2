// =========================================================
// SETUP BÁSICO
// =========================================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const UI = {
    search: document.getElementById('playerSearch'),
    logout: document.getElementById('logoutBtn')
};

// =========================================================
// INICIALIZAÇÃO
// =========================================================
function init() {
    console.log("Modo de Debug Ativado 🛠️");

    // Logout
    UI.logout.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
    });

    // Evento de Busca (Enter)
    UI.search.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const termo = UI.search.value;
            console.clear(); // Limpa o console para facilitar a leitura
            console.log(`🔎 Iniciando busca por: "${termo}"...`);
            fetchAndLogMatches(termo);
        }
    });
}

// =========================================================
// FUNÇÃO DE DIAGNÓSTICO
// =========================================================
async function fetchAndLogMatches(nick) {
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

        if (!data || data.length === 0) {
            console.warn("⚠️ Nenhum dado bruto encontrado no banco.");
            return;
        }

        console.log(`📦 Dados brutos recebidos: ${data.length} linhas.`);

        // 2. Filtro Rigoroso (Lógica Excel)
        // Só aceita se o nome do jogador contiver o termo pesquisado
        const dadosDoJogador = data.filter(linha => 
            linha['Player Name'].toLowerCase().includes(nick.toLowerCase())
        );

        console.log(`👤 Linhas correspondentes ao nick "${nick}": ${dadosDoJogador.length}`);

        // 3. Extração dos Dados Solicitados (Match ID e Champion)
        // Mapeamos para um objeto simples para facilitar a leitura no console
        const resultadoLimpo = dadosDoJogador.map(linha => {
            return {
                MatchID: linha['Match ID'],
                Champion: linha['Champion'],
                // Adicionei o PlayerName só para vc confirmar que é o cara certo
                PlayerName: linha['Player Name'] 
            };
        });

        // 4. Exibe a tabela no Console
        console.table(resultadoLimpo);

        // Verifica se tem duplicatas visuais
        verificarDuplicatas(resultadoLimpo);

    } catch (err) {
        console.error("Erro fatal:", err);
    }
}

function verificarDuplicatas(lista) {
    const ids = lista.map(item => item.MatchID);
    const unicos = new Set(ids);
    
    if (ids.length !== unicos.size) {
        console.warn(`⚠️ ATENÇÃO: Há ${ids.length - unicos.size} Match IDs duplicados nesta lista!`);
    } else {
        console.log("✅ Não foram encontradas duplicatas de Match ID na lista filtrada.");
    }
}

init();
