/**
 * LEAGUE OF LEGENDS DASHBOARD SCRIPT
 * Refatorado para modularidade e limpeza.
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

// Seletores DOM centralizados
const UI_ELEMENTS = {
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
    chartCanvas: document.getElementById('resourceChart').getContext('2d')
};

const supabaseClient = supabase.createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.KEY);
let chartInstance = null;

// ==========================================
// 2. SERVIÇOS (DADOS) - CORRIGIDO
// ==========================================
const PlayerService = {
    async fetchHistory(nick) {
        try {
            const isExactMatch = nick.includes('#');
            
            // 1. Busca no Banco
            let query = supabaseClient
                .from('partidas_br')
                .select('*');

            if (isExactMatch) {
                // Se tem #, usa igualdade exata para evitar pegar "ZekasFake"
                query = query.eq('Player Name', nick);
            } else {
                query = query.ilike('Player Name', `%${nick}%`);
            }

            const { data, error } = await query;

            if (error) throw error;
            if (!data) return [];

            // 2. Limpeza PESADA de dados (A mágica acontece aqui)
            // Passamos o 'nick' original para filtrar intrusos
            const cleanedData = this.cleanData(data, nick);
            
            console.log(`Dados brutos: ${data.length} | Dados limpos: ${cleanedData.length}`);
            return cleanedData;

        } catch (err) {
            console.error("Erro Supabase:", err);
            throw err; // Repassa o erro para a UI mostrar alerta
        }
    },

    cleanData(matches, targetNick) {
        const uniqueMatches = [];
        const seenIds = new Set();
        // Normaliza o nick buscado para comparar (remove espaços, lowercase)
        const safeTarget = targetNick.toLowerCase().trim().split('#')[0]; 

        matches.forEach(match => {
            // A. FILTRO DE INTRUSOS: 
            // Garante que o nome do jogador na linha contém o nome buscado.
            // Isso remove o "Persona nongrata" que apareceu no seu gráfico.
            const playerName = (match['Player Name'] || '').toLowerCase();
            if (!playerName.includes(safeTarget)) return;

            // B. FILTRO DE FANTASMAS: 
            // Ignora linhas sem Campeão ou Dano (aquelas bolhas vermelhas escuras)
            if (!match['Champion'] || !match['Damage/Min']) return;

            // C. FILTRO DE DUPLICATAS:
            // Usa ID da partida ou cria uma assinatura única
            const signature = match['Match ID'] || 
                              `${match['Champion']}-${match['KDA']}-${match['Gold/Min']}`;

            if (!seenIds.has(signature)) {
                seenIds.add(signature);
                uniqueMatches.push(match);
            }
        });

        return uniqueMatches;
    },

    async checkSession() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        return session;
    },

    async logout() {
        return await supabaseClient.auth.signOut();
    }
};

// ==========================================
// 3. CALCULADORA (LÓGICA DE NEGÓCIO)
// ==========================================
const StatsCalculator = {
    calculateWinrate(matches) {
        if (!matches.length) return "0%";
        const wins = matches.filter(m => m['Win Rate %'] == 1 || m['Win Rate %'] == 100).length;
        return ((wins / matches.length) * 100).toFixed(1) + "%";
    },

    calculateAvgKDA(matches) {
        let total = 0, count = 0;
        matches.forEach(m => {
            const val = parseFloat(m['KDA']);
            if (!isNaN(val)) { total += val; count++; }
        });
        return count > 0 ? (total / count).toFixed(1) : "-";
    },

    findMainChamp(matches) {
        if (!matches.length) return { name: '-', count: 0 };
        
        const counts = {};
        matches.forEach(m => {
            const c = m['Champion'];
            counts[c] = (counts[c] || 0) + 1;
        });
        
        const bestChamp = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
        return { name: bestChamp, count: counts[bestChamp] };
    },

    processChartData(matches) {
        return matches.map(match => {
            const dpm = parseFloat(match['Damage/Min']) || 0;
            const gpm = parseFloat(match['Gold/Min']) || 1;
            const efficiency = (dpm / gpm) * 100;
            const radius = Math.max(5, efficiency / 6); // Garante tamanho mínimo
            
            return {
                x: gpm,
                y: dpm,
                r: radius,
                champ: match['Champion'],
                win: (match['Win Rate %'] == 1 || match['Win Rate %'] == 100),
                efficiency: efficiency.toFixed(0)
            };
        });
    }
};

// ==========================================
// 4. GERENCIADOR DE GRÁFICO (CHART.JS)
// ==========================================
const ChartManager = {
    // Plugin customizado extraído para clareza
    championImagePlugin: {
        id: 'customImage',
        afterDatasetDraw(chart, args) {
            const { ctx } = chart;
            const meta = args.meta;
            
            meta.data.forEach((element, index) => {
                const dataPoint = chart.data.datasets[meta.index].data[index];
                const { x, y } = element.getProps(['x', 'y'], true);
                const radius = element.options.radius;

                if (dataPoint.image && dataPoint.image.complete && dataPoint.image.naturalHeight !== 0) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2, true);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(dataPoint.image, x - radius, y - radius, radius * 2, radius * 2);
                    
                    // Borda baseada em vitória/derrota
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = dataPoint.win ? '#5383e8' : '#e84057';
                    ctx.stroke();
                    ctx.restore();
                }
            });
        }
    },

    preloadImages(dataPoints, onReady) {
        let loaded = 0;
        const total = dataPoints.length;
        
        return dataPoints.map(point => {
            const img = new Image();
            const cleanName = point.champ.replace(/[^a-zA-Z0-9]/g, '');
            img.src = `${CONFIG.CDRAGON_URL}${cleanName}.png`;
            
            // Simples mecanismo para atualizar o gráfico quando as imagens carregarem
            img.onload = () => {
                loaded++;
                if (loaded === total || loaded % 5 === 0) onReady(); 
            };
            return { ...point, image: img };
        });
    },

    render(rawData) {
        if (chartInstance) chartInstance.destroy();

        // Separa dados e pré-carrega imagens
        const dataWithImages = this.preloadImages(rawData, () => chartInstance?.update());
        
        const vitorias = dataWithImages.filter(d => d.win);
        const derrotas = dataWithImages.filter(d => !d.win);

        chartInstance = new Chart(UI_ELEMENTS.chartCanvas, {
            type: 'bubble',
            plugins: [this.championImagePlugin],
            data: {
                datasets: [
                    { label: 'Vitória', data: vitorias, backgroundColor: 'rgba(83, 131, 232, 0.1)', hoverRadius: 0 },
                    { label: 'Derrota', data: derrotas, backgroundColor: 'rgba(232, 64, 87, 0.1)', hoverRadius: 0 }
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
                            label: c => {
                                const d = c.raw;
                                return [` ${d.champ}`, ` Eficiência: ${d.efficiency}%`, ` Dano/min: ${d.y.toFixed(0)}`, ` Gold/min: ${d.x.toFixed(0)}`];
                            }
                        }
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'Gold/Min', color: '#8a92a3' }, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8a92a3' } },
                    y: { title: { display: true, text: 'Damage/Min', color: '#8a92a3' }, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8a92a3' } }
                }
            }
        });
    }
};

// ==========================================
// 5. INTERFACE (UI & EVENTOS)
// ==========================================
const UIManager = {
    updateHeader(nick, stats) {
        UI_ELEMENTS.welcome.innerText = `Análise: ${nick}`;
        UI_ELEMENTS.stats.winrate.innerText = stats.winrate;
        UI_ELEMENTS.stats.kda.innerText = stats.kda;
        UI_ELEMENTS.stats.mainChampName.innerText = stats.mainChamp.name;
        UI_ELEMENTS.stats.mainChampCount.innerText = `${stats.mainChamp.count} Partidas`;
        
        const cleanName = stats.mainChamp.name.replace(/[^a-zA-Z0-9]/g, '');
        UI_ELEMENTS.stats.mainChampImg.src = `${CONFIG.CDRAGON_URL}${cleanName}.png`;
    },

    renderSuggestions(list) {
        UI_ELEMENTS.suggestions.innerHTML = '';
        list.forEach(nick => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            const [name, tag] = nick.split('#');
            div.innerHTML = `<span>${name}</span><strong style="font-size:0.8rem; color:#666;">#${tag || ''}</strong>`;
            
            div.addEventListener('click', () => App.loadPlayer(nick));
            UI_ELEMENTS.suggestions.appendChild(div);
        });
    },

    toggleSuggestions(show) {
        UI_ELEMENTS.suggestions.style.display = show ? 'block' : 'none';
    }
};

// ==========================================
// 6. CONTROLADOR PRINCIPAL (APP)
// ==========================================
const App = {
    async init() {
        // Verifica sessão
        const session = await PlayerService.checkSession();
        if (!session) {
            window.location.href = "index.html";
            return;
        }

        const userMeta = session.user.user_metadata;
        UI_ELEMENTS.welcome.innerText = `Bem-vindo ao Rift, ${userMeta.lol_nick || "Sem Nick"}.`;
        UI_ELEMENTS.userNick.innerText = userMeta.full_name || "Invocador";
        UI_ELEMENTS.loading.style.display = 'none';

        // Carrega player padrão
        this.loadPlayer("Zekas#2002");
        this.setupListeners();
    },

    setupListeners() {
        // Busca
        UI_ELEMENTS.search.addEventListener('focus', () => this.handleSearchInput());
        UI_ELEMENTS.search.addEventListener('input', () => this.handleSearchInput());
        
        // Fechar sugestões ao clicar fora
        document.addEventListener('click', (e) => {
            if (!UI_ELEMENTS.search.contains(e.target) && !UI_ELEMENTS.suggestions.contains(e.target)) {
                UIManager.toggleSuggestions(false);
            }
        });

        // Logout
        UI_ELEMENTS.logoutBtn.addEventListener('click', async () => {
            const { error } = await PlayerService.logout();
            if (!error) window.location.href = "index.html";
        });
    },

    handleSearchInput() {
        const term = UI_ELEMENTS.search.value.toLowerCase();
        const list = term === "" 
            ? CONFIG.SUGGESTED_NICKS 
            : CONFIG.SUGGESTED_NICKS.filter(n => n.toLowerCase().includes(term));
        
        if (list.length > 0) {
            UIManager.renderSuggestions(list);
            UIManager.toggleSuggestions(true);
        } else {
            UIManager.toggleSuggestions(false);
        }
    },

    async loadPlayer(nick) {
        UI_ELEMENTS.search.value = nick;
        UIManager.toggleSuggestions(false);
        UI_ELEMENTS.welcome.innerText = `Carregando dados de ${nick}...`;

        try {
            const matches = await PlayerService.fetchHistory(nick);
            
            if (matches.length === 0) {
                alert("Nenhuma partida encontrada.");
                UI_ELEMENTS.welcome.innerText = `Sem dados: ${nick}`;
                return;
            }

            // Calcula Estatísticas
            const stats = {
                winrate: StatsCalculator.calculateWinrate(matches),
                kda: StatsCalculator.calculateAvgKDA(matches),
                mainChamp: StatsCalculator.findMainChamp(matches)
            };

            // Atualiza UI e Gráfico
            UIManager.updateHeader(nick, stats);
            
            const chartData = StatsCalculator.processChartData(matches);
            ChartManager.render(chartData);

        } catch (err) {
            alert("Erro ao processar dados.");
        }
    }
};

// Iniciar Aplicação
App.init();
