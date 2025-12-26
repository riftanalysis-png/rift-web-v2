// ==========================================
// 1. CONFIGURAÇÃO DO SUPABASE
// ==========================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc";

// Inicializa o cliente (usei 'supabaseClient' para evitar conflitos de nome)
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 2. SELEÇÃO DE ELEMENTOS DO HTML
// ==========================================
const authForm = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

// Novos campos de Nome e Nick
const extraFields = document.getElementById('extraFields');
const nameInput = document.getElementById('fullName');
const nickInput = document.getElementById('nick');

const submitBtn = document.getElementById('submitBtn');
const toggleLink = document.getElementById('toggleLink');
const toggleText = document.getElementById('toggleText');
const errorMsg = document.getElementById('errorMessage');

// Variável de controle: Começa como TRUE (Modo Login)
let isLoginMode = true;

// ==========================================
// 3. LÓGICA DE ALTERNAR (LOGIN <-> CADASTRO)
// ==========================================
toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    
    isLoginMode = !isLoginMode; // Inverte o modo
    errorMsg.innerText = "";    // Limpa erros antigos

    if (isLoginMode) {
        // --- MODO LOGIN ---
        submitBtn.innerText = "Entrar";
        toggleText.innerText = "Não tem uma conta?";
        toggleLink.innerText = "Cadastre-se";
        
        // Esconde os campos extras
        extraFields.style.display = "none";
        nameInput.required = false;
        nickInput.required = false;
    } else {
        // --- MODO CADASTRO ---
        submitBtn.innerText = "Cadastrar";
        toggleText.innerText = "Já tem uma conta?";
        toggleLink.innerText = "Fazer Login";
        
        // Mostra os campos extras
        extraFields.style.display = "block";
        nameInput.required = true;
        nickInput.required = true;
    }
});

// ==========================================
// 4. LÓGICA DE ENVIO DO FORMULÁRIO
// ==========================================
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.innerText = ""; // Limpa erros

    // Pega os valores
    const email = emailInput.value;
    const password = passwordInput.value;
    const name = nameInput.value;
    const nick = nickInput.value;

    // Feedback visual (botão carregando)
    const originalBtnText = submitBtn.innerText;
    submitBtn.innerText = "Carregando...";
    submitBtn.disabled = true;

    try {
        if (isLoginMode) {
            // ===========================
            // TENTATIVA DE LOGIN
            // ===========================
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;

            // 🔒 VERIFICAÇÃO DE APROVAÇÃO 🔒
            // Se o campo 'approved' nos metadados não for TRUE, bloqueia o acesso
            if (data.user.user_metadata.approved !== true) {
                // Desloga o usuário imediatamente para impedir acesso
                await supabaseClient.auth.signOut();
                throw new Error("ACCOUNT_NOT_APPROVED");
            }

            // Se passou, redireciona
            window.location.href = "dashboard.html";

        } else {
            // ===========================
            // TENTATIVA DE CADASTRO
            // ===========================
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: name,   // Salva o Nome
                        lol_nick: nick,    // Salva o Nick
                        approved: false    // ⛔ Define como BLOQUEADO por padrão
                    }
                }
            });

            if (error) throw error;

            // Sucesso
            alert("Solicitação enviada! Aguarde a aprovação do Administrador para acessar.");
            
            // Volta para a tela de login para ele esperar
            toggleLink.click();
        }

    } catch (error) {
        // ===========================
        // TRADUÇÃO DE ERROS
        // ===========================
        let mensagem = error.message;

        if (mensagem === "ACCOUNT_NOT_APPROVED") {
            mensagem = "⚠️ Sua conta ainda está em análise pelo Admin.";
        }
        else if (mensagem.includes("Invalid login credentials")) {
            mensagem = "E-mail ou senha incorretos.";
        } 
        else if (mensagem.includes("User already registered")) {
            mensagem = "Este e-mail já está cadastrado.";
        }
        else if (mensagem.includes("Password should be")) {
            mensagem = "A senha precisa ter pelo menos 6 caracteres.";
        }
        else if (mensagem.includes("valid email")) {
            mensagem = "Digite um e-mail válido.";
        }

        errorMsg.innerText = mensagem;

    } finally {
        // Restaura o botão
        submitBtn.innerText = isLoginMode ? "Entrar" : "Cadastrar";
        submitBtn.disabled = false;
    }
});
