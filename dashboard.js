// ==========================================
// MODO DE DIAGNÓSTICO
// ==========================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos
const welcomeMsg = document.getElementById('welcomeMsg');
const loadingScreen = document.getElementById('loadingScreen');

// Função que roda ao abrir
async function runDiagnostic() {
    try {
        // Tira a tela de loading pra gente ver o erro
        if(loadingScreen) loadingScreen.style.display = 'none';
        
        welcomeMsg.innerText = "Tentando conectar ao Supabase...";
        welcomeMsg.style.color = "yellow";

        // TESTE 1: Buscar qualquer coisa na tabela 'partidas_br'
        // Usamos .limit(1) só pra ver se o banco responde
        const { data, error } = await supabaseClient
            .from('partidas_br')
            .select('*')
            .limit(1);

        // SE DER ERRO NO BANCO
        if (error) {
            throw new Error(`ERRO DO SUPABASE: ${error.message} (Código: ${error.code})`);
        }

        // SE O BANCO RESPONDER, MAS VIER VAZIO
        if (!data || data.length === 0) {
            throw new Error("CONEXÃO OK, MAS TABELA VAZIA. Verifique se importou o CSV corretamente.");
        }

        welcomeMsg.innerText = "✅ CONEXÃO BEM SUCEDIDA! O banco está respondendo.";
        welcomeMsg.style.color = "#4ade80"; // Verde
        
        console.log("Dados recebidos:", data);
        alert("Sucesso! O banco conectou. Agora podemos voltar para o código do gráfico.");

    } catch (err) {
        // MOSTRA O ERRO NA TELA
        console.error(err);
        welcomeMsg.innerHTML = `❌ FALHA CRÍTICA:<br>${err.message}`;
        welcomeMsg.style.color = "#ff4d4d"; // Vermelho
    }
}

// Roda o teste
runDiagnostic();
