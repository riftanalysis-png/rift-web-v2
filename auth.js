// ==========================================
// 1. CONFIGURAÇÃO DO SUPABASE
// ==========================================

// Substitua pelos seus dados reais do Supabase Project Settings > API
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 2. SELEÇÃO DE ELEMENTOS DO HTML
// ==========================================

const authForm = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submitBtn');
const toggleLink = document.getElementById('toggleLink');
const toggleText = document.getElementById('toggleText');

// Variável de controle: Começa como TRUE (Modo Login)
let isLoginMode = true;

// ==========================================
// 3. LÓGICA DE ALTERNAR (LOGIN <-> CADASTRO)
// ==========================================

toggleLink.addEventListener('click', (e) => {
    e.preventDefault(); // Evita que a página recarregue ao clicar no link
    
    isLoginMode = !isLoginMode; // Inverte o valor (se era true vira false, e vice-versa)

    if (isLoginMode) {
        // MODO LOGIN
        submitBtn.innerText = "Entrar";
        toggleText.innerText = "Não tem uma conta?";
        toggleLink.innerText = "Cadastre-se";
    } else {
        // MODO CADASTRO
        submitBtn.innerText = "Cadastrar";
        toggleText.innerText = "Já tem uma conta?";
        toggleLink.innerText = "Fazer Login";
    }
});

// ==========================================
// 4. LÓGICA DE ENVIO DO FORMULÁRIO
// ==========================================

authForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Impede o recarregamento padrão do formulário

    const email = emailInput.value;
    const password = passwordInput.value;

    // Feedback visual de carregamento
    const originalBtnText = submitBtn.innerText;
    submitBtn.innerText = "Carregando...";
    submitBtn.disabled = true;

    try {
        if (isLoginMode) {
            // --- TENTATIVA DE LOGIN ---
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;

            // Se der certo, redireciona
            window.location.href = "dashboard.html";

        } else {
            // --- TENTATIVA DE CADASTRO ---
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
            });

            if (error) throw error;

            // Sucesso no cadastro
            alert("Cadastro realizado com sucesso! " + (data.session ? "Entrando..." : "Verifique seu e-mail se necessário."));
            
            // Se o login for automático após cadastro (depende da config do Supabase), já redireciona
            if (data.session) {
                window.location.href = "dashboard.html";
            } else {
                // Se precisar confirmar email, volta pra tela de login
                isLoginMode = true;
                submitBtn.innerText = "Entrar";
                toggleText.innerText = "Não tem uma conta?";
                toggleLink.innerText = "Cadastre-se";
            }
        }
    } catch (error) {
        // Mostra o erro na tela
        alert("Erro: " + error.message);
    } finally {
        // Restaura o botão ao estado normal
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
    }
});
