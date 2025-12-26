// ==========================================
// 1. CONFIGURAÇÃO (SUAS CHAVES)
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
// 2. VERIFICAÇÃO DE SESSÃO
// ==========================================
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = "index.html";
    } else {
        const user = session.user;
        const nome = user.user_metadata.full_name || "Invocador";
        const nick = user.user_metadata.lol_nick || "Sem Nick";

        welcomeMsg.innerText = `Bem-vindo ao Rift, ${nick}.`;
        userNickDisplay.innerText = nome;
        loadingScreen.style.display = 'none';
        
        // Só carrega o gráfico depois que a tela abre
        carregarGrafico(); 
    }
}

// ==========================================
// 3. LOGOUT
// ==========================================
logoutBtn.addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (!error) window.location.href = "index.html";
});

// Inicializa
checkSession();

// ==========================================
// 4. LÓGICA DO GRÁFICO DE BOLHAS (PREMIUM)
// ==========================================

function carregarGrafico() {
    
    // Função Auxiliar: Carrega imagem da Riot
    const carregarImg = (nome) => {
        const img = new Image();
        img.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${nome}.png`;
        return img;
    };

    // DADOS MOCKADOS (Exemplo)
    // x: Dano/min | y: Gold/min | r: Tamanho (Eficiência) | champ: Nome exato
    const rawData = [
        // Vitórias (Azul)
        { x: 750, y: 500, r: 25, champ: 'Jhin', win: true },
        { x: 920, y: 550, r: 30, champ: 'Zed', win: true },
        { x: 600, y: 480, r: 20, champ: 'LeeSin', win: true },
        { x: 550, y: 400, r: 15, champ: 'Thresh', win: true },

        // Derrotas (Vermelho)
        { x: 400, y: 350, r: 10, champ: 'Yasuo', win: false },
        { x: 850, y: 420, r: 28, champ: 'Jinx', win: false }, // Muito dano, pouco gold
        { x: 450, y: 380, r: 12, champ: 'Ahri', win: false }
    ];

    // Prepara os dados adicionando o objeto de imagem
    const vitorias = rawData.filter(d => d.win).map(d => ({ ...d, image: carregarImg(d.champ) }));
    const derrotas = rawData.filter(d => !d.win).map(d => ({ ...d, image: carregarImg(d.champ) }));

    const ctx = document.getElementById('resourceChart').getContext('2d');

    // PLUGIN CUSTOMIZADO: Desenha a imagem dentro da bolha
    const imagePlugin = {
        id: 'customImage',
        afterDatasetDraw(chart, args, options) {
            const { ctx } = chart;
            const meta = args.meta;
            
            meta.data.forEach((element, index) => {
                const dataPoint = chart.data.datasets[meta.index].data[index];
                const { x, y } = element.getProps(['x', 'y'], true);
                const radius = element.options.radius;
                
                // Só desenha se a imagem já carregou do servidor da Riot
                if(dataPoint.image && dataPoint.image.complete) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2, true);
                    ctx.closePath();
                    ctx.clip(); // Corta em círculo
                    
                    // Desenha imagem centralizada
                    ctx.drawImage(dataPoint.image, x - radius, y - radius, radius * 2, radius * 2);
                    
                    // Borda extra interna para acabamento
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = dataPoint.win ? 'rgba(83, 131, 232, 0.3)' : 'rgba(232, 64, 87, 0.3)';
                    ctx.stroke();
                    
                    ctx.restore();
                }
            });
        }
    };

    // Configuração do Chart.js
    new Chart(ctx, {
        type: 'bubble',
        plugins: [imagePlugin],
        data: {
            datasets: [
                {
                    label: 'Vitória',
                    data: vitorias,
                    backgroundColor: 'rgba(83, 131, 232, 0.1)', // Fundo bem transparente
                    borderColor: '#5383e8', // Borda Azul
                    borderWidth: 2,
                    hoverRadius: 0 // Evita distorção no hover
                },
                {
                    label: 'Derrota',
                    data: derrotas,
                    backgroundColor: 'rgba(232, 64, 87, 0.1)',
                    borderColor: '#e84057', // Borda Vermelha
                    borderWidth: 2,
                    hoverRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }, // Legenda customizada no HTML
                tooltip: {
                    backgroundColor: '#13161d',
                    titleColor: '#c8aa6e',
                    bodyColor: '#fff',
                    borderColor: '#333',
                    borderWidth: 1,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            const d = context.raw;
                            return ` ${d.champ} | Dano: ${d.x} | Gold: ${d.y}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Dano por Minuto (DPM)', color: '#555' },
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#8a92a3' }
                },
                y: {
                    title: { display: true, text: 'Gold por Minuto (GPM)', color: '#555' },
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#8a92a3' }
                }
            },
            animation: {
                onComplete: function() {
                    // Força redesenho caso as imagens demorem a carregar
                    // Isso evita bolhas vazias na primeira carga
                }
            }
        }
    });
}
