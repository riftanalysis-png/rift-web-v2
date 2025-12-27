// =========================================================
// 1. SETUP INICIAL
// =========================================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cache dos Elementos da Tela (Para não ficar buscando o tempo todo)
const UI = {
    loading: document.getElementById('loadingScreen'),
    welcome: document.getElementById('welcomeMsg'),
    userDisplay: document.getElementById('userNickDisplay'),
    search: document.getElementById('playerSearch'),
    suggestions: document.getElementById('suggestionsBox'),
    logout: document.getElementById('logoutBtn'),
    
    // Cards de Stats
    winrate: document.getElementById('valWinrate'),
    kda: document.getElementById('valKDA'),
    champName: document.getElementById('txtMainChamp'),
    champImg: document.getElementById('imgMainChamp'),
    champStats: document.getElementById('txtMainChampStats'),
    
    // Canvas do Gráfico
    chartCanvas: document.getElementById('resourceChart')
};

let chartInstance = null; // Guardará o gráfico futuro

// =========================================================
// 2. CICLO DE VIDA
// =========================================================

// Função principal que roda ao abrir a página
async function init() {
    console.log("Sistema iniciando...");
    setupEvents();
    await checkSession();
}

// Configura cliques e teclas
function setupEvents() {
    // Botão Sair
    UI.logout.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
    });

    // Barra de Pesquisa (Apenas logs por enquanto)
    UI.search.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const termo = UI.search.value;
            console.log(`Usuário apertou Enter buscando: ${termo}`);
            // AQUI ENTRARÁ A FUNÇÃO DE BUSCA FUTURAMENTE
            alert(`Você digitou: ${termo}. (Busca ainda não implementada)`);
        }
    });
}

// Verifica Login e Tira o Loading
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        // Se não tiver logado, chuta pra fora
        window.location.href = "index.html";
        return;
    }

    // Se logou, atualiza a UI básica
    const user = session.user;
    const nick = user.user_metadata.lol_nick || "Jogador";
    
    UI.userDisplay.innerText = user.user_metadata.full_name || "Conectado";
    UI.welcome.innerText = `Olá, ${nick}.`;
    
    // Some com a tela de carregamento
    setTimeout(() => {
        UI.loading.style.display = 'none';
    }, 500);
}

// Inicia o App
init();
