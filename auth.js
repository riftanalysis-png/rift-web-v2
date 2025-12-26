// --- SUAS CHAVES AQUI ---
const SUPABASE_URL = "SUA_URL_DO_SUPABASE";
const SUPABASE_KEY = "SUA_CHAVE_ANON_PUBLICA";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Função de Login
async function fazerLogin(email, senha) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: senha
    });
    if (error) {
        alert("Erro: " + error.message);
    } else {
        window.location.href = "dashboard.html"; // Vai pro painel
    }
}

// Função de Logout
async function sair() {
    await supabase.auth.signOut();
    window.location.href = "index.html"; // Volta pro login
}

// Proteção (Colocar na dashboard)
async function protegerPagina() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
        window.location.href = "index.html"; // Expulsa invasor
    }
}

// Redirecionamento Inteligente (Colocar no login)
async function seJaLogadoVaiProDash() {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
        window.location.href = "dashboard.html"; // Já tá logado, adianta
    }
}
