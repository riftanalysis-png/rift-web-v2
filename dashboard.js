// =========================================================
// 1. CONFIGURAÇÃO E VARIÁVEIS GLOBAIS
// =========================================================
const SUPABASE_URL = "https://fkhvdxjeikswyxwhvdpg.supabase.co";
const SUPABASE_ANON_KEY = "SUA_ANON_KEY_AQUI";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Elementos da UI
const UI = {
  search: document.getElementById("playerSearch"),
  logout: document.getElementById("logoutBtn"),
  loading: document.getElementById("loadingIndicator"),
  statsContainer: document.getElementById("stats-container"),
};

let chartGold = null;
let chartDamage = null;

// =========================================================
// 2. INICIALIZAÇÃO
// =========================================================
function init() {
  console.log("🚀 Dashboard iniciado");

  UI.logout?.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
  });

  UI.search?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      buscarDados(UI.search.value.trim());
    }
  });
}

// =========================================================
// 3. BUSCA DE DADOS (CORRIGIDA)
// =========================================================
async function buscarDados(nick) {
  if (!nick) return;

  console.clear();
  console.log(`🔎 Buscando dados para: ${nick}`);

  try {
    const { data, error } = await supabaseClient
      .from("partidas_br")
      .select("*")
      .ilike('"Player Name"', `%${nick}%`)
      .order('"Game Start Time"', { ascending: true });

    if (error) throw error;

    if (!data?.length) {
      alert("Jogador não encontrado.");
      return;
    }

    // Remove duplicatas por Match ID
    const partidasUnicas = [
      ...new Map(
        data.map((row) => [row["Match ID"], row])
      ).values(),
    ];

    console.log(`✅ ${partidasUnicas.length} partidas únicas`);

    const dadosFormatados = partidasUnicas.map((d) => ({
      ...d,
      DataFormatada: formatarData(d["Game Start Time"]),
      KDA_Calculado:
        (Number(d.Kills) + Number(d.Assists)) /
        Math.max(Number(d.Deaths), 1),
      venceu:
        d.Win === true ||
        d.Win === 1 ||
        d.Result === "victory",
    }));

    atualizarInterface(dadosFormatados);
  } catch (err) {
    console.error("❌ Erro:", err);
  }
}

// =========================================================
// 4. RENDERIZAÇÃO
// =========================================================
function atualizarInterface(dados) {
  renderizarGraficos(dados);
}

async function renderizarGraficos(dados) {
  const dadosRecentes = dados.slice(-20);
  const imagensMap = await carregarImagensCampeoes(dadosRecentes);

  // =======================
  // GRÁFICO BOLHAS
  // =======================
  const ctx1 = document.getElementById("graficoPrincipal");
  if (!ctx1) return;

  chartGold?.destroy();

  const bubbleData = dadosRecentes.map((d) => {
    const rawSize = (Number(d["Gold/Min"]) / 450) * 100;
    return {
      x: Number(d["Damage/Min"]),
      y: Number(d["Gold/Min"]),
      r: rawSize / 4,
      champion: d.Champion,
      win: d.venceu,
    };
  });

  chartGold = new Chart(ctx1, {
    type: "bubble",
    data: {
      datasets: [
        {
          data: bubbleData,
          pointStyle: bubbleData.map(
            (d) => imagensMap[d.champion] || "circle"
          ),
          borderColor: bubbleData.map((d) =>
            d.win ? "#00BFFF" : "#FF4500"
          ),
          borderWidth: 3,
          backgroundColor: bubbleData.map((d) =>
            d.win
              ? "rgba(0,191,255,0.2)"
              : "rgba(255,69,0,0.2)"
          ),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const d = ctx.raw;
              return `${d.champion} — ${d.x.toFixed(
                0
              )} DPM | ${d.y.toFixed(0)} GPM`;
            },
          },
        },
      },
    },
  });

  // =======================
  // GRÁFICO FARM
  // =======================
  const ctx2 = document.getElementById("graficoFarm");
  if (!ctx2) return;

  chartDamage?.destroy();

  chartDamage = new Chart(ctx2, {
    type: "bar",
    data: {
      labels: dadosRecentes.map((d) => d.Champion),
      datasets: [
        {
          label: "CS / Min",
          data: dadosRecentes.map((d) => Number(d["Farm/Min"])),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

// =========================================================
// 5. IMAGENS DOS CAMPEÕES
// =========================================================
async function carregarImagensCampeoes(dados) {
  const map = {};
  await Promise.all(
    dados.map((d) => {
      return new Promise((resolve) => {
        const img = new Image();
        let champ = d.Champion === "FiddleSticks"
          ? "Fiddlesticks"
          : d.Champion;

        img.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${champ}.png`;
        img.onload = () => {
          map[d.Champion] = img;
          resolve();
        };
        img.onerror = () => {
          map[d.Champion] = "circle";
          resolve();
        };
      });
    })
  );
  return map;
}

// =========================================================
init();
