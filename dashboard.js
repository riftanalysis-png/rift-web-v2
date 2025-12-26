// ==========================================
// 1. CONFIGURAÇÃO (COLE AS MESMAS CHAVES AQUI)
// ==========================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos da tela
const loadingScreen = document.getElementById('loadingScreen');
const welcomeMsg = document.getElementById('welcomeMsg');
const userNickDisplay = document.getElementById('userNickDisplay');
const logoutBtn = document.getElementById('logoutBtn');

// ==========================================
// 2. VERIFICAÇÃO DE SEGURANÇA (O GUARDIÃO)
// ==========================================
async function checkSession() {
    // Pergunta pro Supabase: "Tem alguém logado?"
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        // Se não tem sessão, chuta pro login
        window.location.href = "index.html";
    } else {
        // Se tem sessão, carrega os dados
        const user = session.user;
        
        // Pega os dados que salvamos no cadastro (Metadata)
        const nome = user.user_metadata.full_name || "Invocador";
        const nick = user.user_metadata.lol_nick || "Sem Nick";

        // Agora a mensagem principal usa o NICK
        welcomeMsg.innerText = `Bem-vindo ao Rift, ${nick}.`; 

        userNickDisplay.innerText = nick; // Ou deixe 'nick' aqui tbm se preferir esconder o nome real

        // Atualiza a tela
        welcomeMsg.innerText = `Bem-vindo, ${nome}.`;
        userNickDisplay.innerText = nick;

        // Tira a tela de carregamento
        loadingScreen.style.display = 'none';
    }
}

// Roda a verificação assim que abre a página
checkSession();

// ==========================================
// 3. FUNÇÃO DE SAIR (LOGOUT)
// ==========================================
logoutBtn.addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (!error) {
        window.location.href = "index.html";
    } else {
        alert("Erro ao sair.");
    }
});
