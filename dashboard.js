/**
 * LEAGUE OF LEGENDS DASHBOARD - VERSÃO ROBUSTA (FINAL)
 * Correção: Busca flexível (ilike) + Filtro Rígido (JS)
 */

// ==========================================
// 1. CONFIGURAÇÃO & CONSTANTES
// ==========================================
const CONFIG = {
    SUPABASE: {
        URL: "https://fkhvdxjeikswyxwhvdpg.supabase.co",
        KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHZkeGplaWtzd3l4d2h2ZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MjA0NTcsImV4cCI6MjA4MjI5NjQ1N30.AwbRlm7mR8_Uqy97sQ7gfI5zWvO-ZLR1UDkqm3wMbDc"
    },
    CDRAGON_URL: "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/",
    SUGGESTED_NICKS: [
        "Zekas#2002", "han dao#EGC", "Pilot#br11", "Celo#br2", "Gatovisck#愛憎の影"
    ]
};

// Elementos da Tela
const UI = {
    loading: document.getElementById('loadingScreen'),
    welcome: document.getElementById('welcomeMsg'),
    userNick: document.getElementById('userNickDisplay'),
    logoutBtn: document.getElementById('logoutBtn'),
    search: document.getElementById('playerSearch'),
    suggestions: document.getElementById('suggestionsBox'),
    stats: {
        winrate: document.querySelector('.card:nth-child(1) .big-number'),
        kda: document.querySelector('.card:nth-child(2) .big-number'),
        mainChampName: document.querySelector('.champ-badge span'),
        mainChampImg: document.querySelector('.champ-badge img'),
        mainChampCount: document.querySelector('.card:nth-child(3) p'),
    },
    chartCtx: document.getElementById('resourceChart').getContext('2d')
};

const supabaseClient = supabase.createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.KEY);
let chartInstance = null;

// ==========================================
// 2. SERVIÇO DE DADOS (DATA SERVICE)
// ==========================================
const DataService = {
    async fetchPlayerHistory(inputNick) {
        console.log(`[DataService] Iniciando busca para: "${inputNick}"`);
        
        try {
            // 1. Busca "Grosseira" no Banco (Traz tudo que parece com o nick)
            // Usamos .ilike para ignorar maiúsculas/minúsculas (Zekas = zekas)
            const { data, error } = await supabaseClient
                .from('partidas_br')
                .select('*')
                .ilike('Player Name', `%${inputNick}%`);

            if (error) throw error;
            
            if (!data || data.length === 0) {
                console.warn("[DataService] Nenhum dado retornado do Supabase.");
                return [];
            }

            console.log(`[DataService] Supabase retornou ${data.length} linhas brutas.`);

            // 2. Passa o "Pente Fino" para limpar sujeira
            const cleanData = this.refineData(data, inputNick);
            
            console.log(`[DataService] Após limpeza: ${cleanData.length} partidas válidas.`);
            return cleanData;

        } catch (err) {
            console.error("[DataService] Erro Fatal:", err);
            throw err;
        }
    },

    // A Mágica do Filtro
    refineData(rawData, targetNick) {
        const uniqueMatches = [];
        const seenSignatures = new Set();
        
        // Normaliza o nick buscado (remove espaços, tudo minusculo)
        // Se o usuário digitou "Zekas#2002", o alvo é "zekas#2002"
        // Se digitou "Zekas", o alvo é "zekas"
        const normalizedTarget = targetNick.toLowerCase().trim();
        const searchingTag = normalizedTarget.includes('#');

        rawData.forEach(row => {
            // A. Verificação de Integridade (Fantasma)
            if (!row['Champion'] || !row['Damage/Min'] || !row['Player Name']) {
                return; // Pula linha quebrada
            }

            // B. Verificação de Nome (Intruso)
            const rowPlayerName = row['Player Name'].toLowerCase();
            
            // Se buscou com TAG (#), o nome tem que conter a busca exata.
            // Se buscou sem TAG, verificamos se o nome inclui a busca.
            if (!rowPlayerName.includes(normalizedTarget)) {
                // Proteção extra: Se buscou "Zekas" e veio "ZekasFake", aceitamos por enquanto,
                // mas removemos "Persona Nongrata" que não tem nada a ver.
                return; 
            }

            // C. Verificação de Duplicata (Repetido)
            // Cria uma assinatura única para a partida
            const signature = row['Match ID'] || `${row['Champion']}_${row['Game Start Time']}_${row['KDA']}`;

            if (!seenSignatures.has(signature)) {
                seenSignatures.add(signature);
                uniqueMatches.push(row);
            }
        });

        return uniqueMatches;
    },

    async getSession() {
        const { data } = await supabaseClient.auth.getSession();
        return data.session;
    },

    async signOut() {
        return await supabaseClient.auth.signOut();
    }
};

// ==========================================
// 3. LÓGICA DE CÁLCULO (CALCULATOR)
// ==========================================
const Calculator = {
    getWinrate(matches) {
        if (!matches.length) return "0%";
        // Verifica 1 (Vitória) ou 100 (alguns formatos salvam 100%)
        const wins = matches.filter(m => m['Win Rate %'] == 1 || m['Win Rate %'] == 100).length;
        return ((wins / matches.length) * 100).toFixed(1) + "%";
    },

    getKDA(matches) {
        let total = 0, count = 0;
        matches.forEach(m => {
            const kda = parseFloat(m['KDA']);
            if (!isNaN(kda)) {
                total += kda;
                count++;
            }
        });
        return count ? (total / count).toFixed(1) : "-";
    },

    getMainChamp(matches) {
        if (!matches.length) return { name: '-', count: 0, id: '' };
        const counts = {};
        matches.forEach(m => {
            const c = m['Champion'];
            counts[c] = (counts[c] || 0) + 1;
        });
        const best = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
        // Remove caracteres especiais para URL da imagem
        const cleanId = best.replace(/[^a-zA-Z0-9]/g, '');
        return { name: best, count: counts[best], id: cleanId };
    },

    prepareChartData(matches) {
        return matches.map(m => {
            const dpm = parseFloat(m['Damage/Min']) || 0;
            const gpm = parseFloat(m['Gold/Min']) || 1;
            const eff = (dpm / gpm) * 100;
            
            // Define cor e status
            const isWin = (m['Win Rate %'] == 1 || m['Win Rate %'] == 100);
            
            // Tamanho da bolha (controlado)
            let r = eff / 6;
            if (r < 5) r = 5;
            if (r > 30) r = 30;

            return {
                x: gpm,
                y: dpm,
                r: r,
                champ: m['Champion'],
                win: isWin,
                efficiency: eff.toFixed(0)
            };
        });
    }
};

// ==========================================
// 4. GERENCIADOR DE GRÁFICO (CHART)
// ==========================================
const ChartSystem = {
    // Plugin Customizado: Desenha Imagem na Bolha
    imagePlugin: {
        id: 'champImages',
        afterDatasetDraw(chart, args) {
            const { ctx } = chart;
            const meta = args.meta;

            meta.data.forEach((element, index) => {
                const dp = chart.data.datasets[meta.index].data[index];
                if (!dp.image || !dp.image.complete || dp.image.naturalHeight === 0) return;

                const { x, y } = element.getProps(['x', 'y'], true);
                const r = element.options.radius;

                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(dp.image, x - r, y - r, r * 2, r * 2);

                // Borda (Azul/Vermelha)
                ctx.lineWidth = 3;
                ctx.strokeStyle = dp.win ? '#5383e8' : '#e84057';
                ctx.stroke();
                ctx.restore();
            });
        }
    },

    // Carregador de Imagens
    loadImages(dataPoints, callback) {
        let loadedCount = 0;
        const total = dataPoints.length;
        if (total === 0) { callback(); return []; }

        return dataPoints.map(point => {
            const img = new Image();
            // Limpa nome para URL (ex: "K'Sante" -> "KSante")
            const cleanName = point.champ.replace(/[^a-zA-Z0-9]/g, '');
            // Tratamento especial para Wukong/Renata se necessário, mas regex costuma bastar
            img.src = `${CONFIG.CDRAGON_URL}${cleanName}.png`;
            
            img.onload = () => {
                loadedCount++;
                if (loadedCount === total || loadedCount % 5 === 0) callback();
            };
            img.onerror = () => { loadedCount++; }; // Não trava se falhar
            
            return { ...point, image: img };
        });
    },

    render(rawData) {
        if (chartInstance) chartInstance.destroy();

        // 1. Prepara dados com imagens
        const dataWithImages = this.loadImages(rawData, () => {
            if (chartInstance) chartInstance.update();
        });

        // 2. Separa vitórias e derrotas
        const wins = dataWithImages.filter(d => d.win);
        const losses = dataWithImages.filter(d => !d.win);

        // 3. Cria o Gráfico
        chartInstance = new Chart(UI.chartCtx, {
            type: 'bubble',
            plugins: [this.imagePlugin],
            data: {
                datasets: [
                    {
                        label: 'Vitória',
                        data: wins,
                        backgroundColor: 'rgba(83, 131, 232, 0.1)', // Fundo azul claro
                        borderColor: 'transparent',
                        hoverRadius: 0
                    },
                    {
                        label: 'Derrota',
                        data: losses,
                        backgroundColor: 'rgba(232, 64, 87, 0.1)', // Fundo vermelho claro
                        borderColor: 'transparent',
                        hoverRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#13161d',
                        titleColor: '#c8aa6e',
                        bodyColor: '#fff',
                        callbacks: {
                            label: (ctx) => {
                                const d = ctx.raw;
                                return [
                                    ` ${d.champ}`,
                                    ` Eficiência: ${d.efficiency}%`,
                                    ` Dano/Min: ${d.y}`,
                                    ` Gold/Min: ${d.x}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Gold por Minuto', color: '#8a92a3' },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#8a92a3' }
                    },
                    y: {
                        title: { display: true, text: 'Dano por Minuto', color: '#8a92a3' },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#8a92a3' }
                    }
                }
            }
        });
    }
};

// ==========================================
// 5. APLICAÇÃO PRINCIPAL (APP)
// ==========================================
const App = {
    async init() {
        // Verifica Login
        const session = await DataService.getSession();
        if (!session) {
            window.location.href = "index.html";
            return;
        }

        // Configura Tela Inicial
        const meta = session.user.user_metadata;
        UI.welcome.innerText = `Olá, ${meta.lol_nick || "Invocador"}`;
        UI.userNick.innerText = meta.full_name || "Usuário";
        UI.loading.style.display = 'none';

        // Event Listeners
        this.setupEvents();

        // Carrega Jogador Padrão (Ex: Zekas)
        this.loadPlayer("Zekas#2002");
    },

    setupEvents() {
        // Busca Dinâmica
        UI.search.addEventListener('input', (e) => this.handleSuggestion(e.target.value));
        UI.search.addEventListener('focus', (e) => this.handleSuggestion(e.target.value));
        
        // Fechar sugestões ao clicar fora
        document.addEventListener('click', (e) => {
            if (!UI.search.contains(e.target) && !UI.suggestions.contains(e.target)) {
                UI.suggestions.style.display = 'none';
            }
        });

        // Logout
        UI.logoutBtn.addEventListener('click', async () => {
            await DataService.signOut();
            window.location.href = "index.html";
        });
    },

    handleSuggestion(text) {
        const term = text.toLowerCase();
        const matches = CONFIG.SUGGESTED_NICKS.filter(n => n.toLowerCase().includes(term));
        
        if (matches.length > 0) {
            UI.suggestions.innerHTML = matches.map(nick => {
                const [n, t] = nick.split('#');
                return `<div class="suggestion-item" onclick="App.loadPlayer('${nick}')">
                            <span>${n}</span><small>#${t||''}</small>
                        </div>`;
            }).join('');
            UI.suggestions.style.display = 'block';
        } else {
            UI.suggestions.style.display = 'none';
        }
    },

    // Ação Principal: Carregar Jogador
    async loadPlayer(nick) {
        UI.search.value = nick;
        UI.suggestions.style.display = 'none';
        UI.welcome.innerText = `Analisando: ${nick}...`;

        try {
            const matches = await DataService.fetchPlayerHistory(nick);

            if (matches.length === 0) {
                alert(`Nenhuma partida encontrada para "${nick}".\nVerifique se o nome está correto ou se há dados no banco.`);
                UI.welcome.innerText = "Sem dados encontrados.";
                return;
            }

            // Atualiza Dashboard
            const stats = {
                win: Calculator.getWinrate(matches),
                kda: Calculator.getKDA(matches),
                main: Calculator.getMainChamp(matches)
            };

            UI.welcome.innerText = `Relatório: ${nick}`;
            UI.stats.winrate.innerText = stats.win;
            UI.stats.kda.innerText = stats.kda;
            UI.stats.mainChampName.innerText = stats.main.name;
            UI.stats.mainChampCount.innerText = `${stats.main.count} Jogos`;
            
            if (stats.main.id) {
                UI.stats.mainChampImg.src = `${CONFIG.CDRAGON_URL}${stats.main.id}.png`;
            }

            // Renderiza Gráfico
            const chartData = Calculator.prepareChartData(matches);
            ChartSystem.render(chartData);

        } catch (error) {
            console.error(error);
            alert("Ocorreu um erro ao carregar os dados. Veja o console (F12).");
        }
    }
};

// Torna global para o HTML acessar (onclick)
window.App = App;

// Iniciar
App.init();
