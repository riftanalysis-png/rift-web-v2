// =========================================================
// 1. CONFIGURAÇÃO E CONSTANTES
// =========================================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "SUA_ANON_KEY_AQUI";

// Inicializa cliente Supabase
const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Lista de nicks sugeridos
const SUGGESTED_NICKS = [
  "Zekas#2002",
  "han dao#EGC",
  "Pilot#br11",
  "Celo#br2",
  "Gatovisck#愛憎の影"
];

// Correção oficial de nomes da Riot
const CHAMP_FIX = {
  "Kai'Sa": "Kaisa",
  "Kha'Zix": "Khazix",
  "Cho'Gath": "Chogath",
  "Vel'Koz": "Velkoz",
  "Bel'Veth": "Belveth"
};

// Cache UI
const UI = {
  loading: document.getElementById("loadingScreen"),
  welcome: document.getElementById("welcomeMsg"),
  userDisplay: document.getElementById("userNickDisplay"),
  search: document.getElementById("playerSearch"),
  suggestions: document.getElementById("suggestionsBox"),
  logout: document.getElementById("logoutBtn"),

  winrate: document.getElementById("valWinrate"),
  kda: document.getElementById("valKDA"),
  champName: document.getElementById("txtMainChamp"),
  champImg: document.getElementById("imgMainChamp"),
  champStats: document.getElementById("txtMainChampStats"),

  chartCanvas: document.getElementById("resourceChart")
};

let chartInstance = null;

// =========================================================
// 2. INIT / AUTH
// =========================================================
async function init() {
  setupEventListeners();
  await checkSession();
}

function setupEventListeners() {
  UI.logout.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
  });

  UI.search.addEventListener("input", e =>
    handleSearchInput(e.target.value)
  );

  UI.search.addEventListener("focus", e =>
    handleSearchInput(e.target.value)
  );

  document.addEventListener("click", e => {
    if (
      !UI.search.contains(e.target) &&
      !UI.suggestions.contains(e.target)
    ) {
      UI.suggestions.style.display = "none";
    }
  });
}

async function checkSession() {
  const { data } = await supabaseClient.auth.getSession();

  if (!data.session) {
    window.location.href = "index.html";
    return;
  }

  const user = data.session.user;
  const nick = user.user_metadata?.lol_nick || "Sem Nick";

  UI.userDisplay.innerText =
    user.user_metadata?.full_name || "Invocador";

  UI.welcome.innerText = `Bem-vindo, ${nick}`;
  UI.loading.style.display = "none";

  fetchPlayerData("Zekas#2002");
}

// =========================================================
// 3. AUTOCOMPLETE
// =========================================================
function handleSearchInput(termo) {
  termo = termo.toLowerCase();

  const filtrados =
    termo === ""
      ? SUGGESTED_NICKS
      : SUGGESTED_NICKS.filter(n =>
          n.toLowerCase().includes(termo)
        );

  UI.suggestions.innerHTML = "";

  if (!filtrados.length) {
    UI.suggestions.style.display = "none";
    return;
  }

  filtrados.forEach(nick => {
    const div = document.createElement("div");
    div.className = "suggestion-item";

    const [name, tag] = nick.split("#");
    div.innerHTML = `<span>${name}</span><strong>#${tag}</strong>`;

    div.onclick = () => {
      UI.search.value = nick;
      UI.suggestions.style.display = "none";
      fetchPlayerData(nick);
    };

    UI.suggestions.appendChild(div);
  });

  UI.suggestions.style.display = "block";
}

// =========================================================
// 4. FETCH DATA (CORRIGIDO)
// =========================================================
async function fetchPlayerData(nick) {
  const normalizedNick = nick.trim().toLowerCase();
  UI.welcome.innerText = `Carregando dados de ${nick}...`;

  try {
    const { data, error } = await supabaseClient
      .from("partidas_br")
      .select("*")
      .ilike("Player Name", normalizedNick);

    if (error) throw error;

    if (!data || data.length === 0) {
      UI.welcome.innerText = `Sem dados para ${nick}`;
      alert("Nenhuma partida encontrada.");
      return;
    }

    const cleanData = removeDuplicates(data);
    const stats = calculateStats(cleanData);
    updateDashboard(nick, stats, cleanData);

  } catch (err) {
    console.error(err);
    alert("Erro ao buscar dados.");
  }
}

// =========================================================
// 5. PROCESSAMENTO
// =========================================================
function removeDuplicates(data) {
  const seen = new Set();
  return data.filter(m => {
    if (seen.has(m["Match ID"])) return false;
    seen.add(m["Match ID"]);
    return true;
  });
}

function calculateStats(matches) {
  const total = matches.length;

  const wins = matches.filter(
    m => m["Win Rate %"] == 1
  ).length;

  const winrate = ((wins / total) * 100).toFixed(1);

  let kdaSum = 0;
  let kdaCount = 0;

  const champCount = {};

  matches.forEach(m => {
    const kda = parseFloat(m["KDA"]);
    if (!isNaN(kda)) {
      kdaSum += kda;
      kdaCount++;
    }

    if (m["Champion"]) {
      champCount[m["Champion"]] =
        (champCount[m["Champion"]] || 0) + 1;
    }
  });

  const champs = Object.keys(champCount);
  const mainChamp = champs.length
    ? champs.reduce((a, b) =>
        champCount[a] > champCount[b] ? a : b
      )
    : "Desconhecido";

  return {
    winrate: winrate + "%",
    kda: kdaCount ? (kdaSum / kdaCount).toFixed(2) : "-",
    mainChamp,
    mainChampGames: champCount[mainChamp] || 0
  };
}

// =========================================================
// 6. UI + GRÁFICO
// =========================================================
function updateDashboard(nick, stats, matches) {
  UI.welcome.innerText = `Análise: ${nick}`;
  UI.winrate.innerText = stats.winrate;
  UI.kda.innerText = stats.kda;

  UI.champName.innerText = stats.mainChamp;
  UI.champStats.innerText = `${stats.mainChampGames} partidas`;

  const champImg =
    CHAMP_FIX[stats.mainChamp] ||
    stats.mainChamp.replace(/[^a-zA-Z0-9]/g, "");

  UI.champImg.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${champImg}.png`;

  renderBubbleChart(matches);
}

// (renderBubbleChart permanece IGUAL ao seu original)

init();
