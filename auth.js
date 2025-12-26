// ==========================================
// 1. CONFIGURAÇÃO 
// ==========================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";

// ATENÇÃO: Corrigi o nome da variável para bater com a linha de baixo
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc";

// Mudei de 'supabase' para 'supabaseClient' para não dar erro de conflito com a biblioteca
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 2. ELEMENTOS
// ==========================================
const authForm = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submitBtn');
const toggleLink = document.getElementById('toggleLink');
const toggleText = document.getElementById('toggleText');
const errorMsg = document.getElementById('errorMessage');

let isLoginMode = true;

// ==========================================
// 3. ALTERNAR LOGIN / CADASTRO
// ==========================================
toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    
    // Limpa mensagens de erro ao trocar de tela
    errorMsg.innerText = ""; 

    if (isLoginMode) {
        submitBtn.innerText = "Entrar";
        toggleText.innerText = "Não tem uma conta?";
        toggleLink.innerText = "Cadastre-se";
    } else {
        submitBtn.innerText = "Cadastrar";
        toggleText.innerText = "Já tem uma conta?";
        toggleLink.innerText = "Fazer Login";
    }
});

// ==========================================
// 4. ENVIO E TRATAMENTO DE ERROS
// ==========================================
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Limpa erro anterior
    errorMsg.innerText = "";
    
    const email = emailInput.value;
    const password = passwordInput.value;

    // Feedback de carregamento
    const originalBtnText = submitBtn.innerText;
    submitBtn.innerText = "Carregando...";
    submitBtn.disabled = true;

    try {
        if (isLoginMode) {
            // LOGIN (Usando supabaseClient agora)
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password,
            });
            if (error) throw error;
            window.location.href = "dashboard.html";

        } else {
            // CADASTRO (Usando supabaseClient agora)
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
            });
            if (error) throw error;
            
            alert("Cadastro realizado! Se o login não for automático, faça login agora.");
            if (data.session) window.location.href = "dashboard.html";
            else toggleLink.click(); // Volta pra tela de login
        }

    } catch (error) {
        // --- AQUI ACONTECE A TRADUÇÃO DOS ERROS ---
        let mensagem = error.message;

        // Erro de Login (Senha errada OU Email não existe)
        if (mensagem.includes("Invalid login credentials")) {
            mensagem = "E-mail ou senha incorretos.";
        } 
        // Erro de Cadastro (Email já existe)
        else if (mensagem.includes("User already registered")) {
            mensagem = "Este e-mail já está cadastrado.";
        }
        // Erro de Validação (Senha curta, email mal formatado)
        else if (mensagem.includes("Password should be")) {
            mensagem = "A senha precisa ter pelo menos 6 caracteres.";
        }
        else if (mensagem.includes("valid email")) {
            mensagem = "Digite um e-mail válido.";
        }

        // Mostra a mensagem traduzida no HTML
        errorMsg.innerText = mensagem;
        
    } finally {
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
    }
});
