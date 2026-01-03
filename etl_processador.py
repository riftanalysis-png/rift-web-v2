import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from scipy import stats
import os
import sys

# --- CONFIGURAÇÃO ---
DB_URL = os.environ.get("DB_URL") # Sua URL de conexão do Supabase

if not DB_URL:
    print("ERRO: Configure a variável de ambiente DB_URL")
    sys.exit(1)

engine = create_engine(DB_URL)

def carregar_dados():
    """Carrega TODAS as partidas do banco para análise estatística."""
    print("📥 Carregando histórico completo do banco...")
    query = text('SELECT * FROM partidas_br')
    with engine.connect() as conn:
        df = pd.read_sql(query, conn)
    print(f"✅ {len(df)} partidas carregadas para processamento.")
    return df

def calcular_boxplot(df):
    """Calcula os Quartis para o Gráfico de Boxplot (XP Diff)."""
    print("📊 Calculando Boxplot...")
    
    # Garante que é numérico e preenche nulos com 0
    df["XP Diff 12'"] = pd.to_numeric(df["XP Diff 12'"], errors='coerce').fillna(0)
    
    resultados = []
    
    for status, win_code in [('Vitória', 1), ('Derrota', 0)]:
        filtro = df[df['Win Rate %'] == win_code]["XP Diff 12'"]
        
        if len(filtro) > 0:
            desc = filtro.describe(percentiles=[.25, .5, .75])
            resultados.append({
                'categoria': status,
                'min': int(desc['min']),
                'q1': int(desc['25%']),
                'mediana': int(desc['50%']),
                'q3': int(desc['75%']),
                'max': int(desc['max'])
            })
            
    return pd.DataFrame(resultados)

def calcular_probabilidade_xp(df):
    """Calcula a curva de probabilidade de vitória por XP Diff."""
    print("📈 Calculando Curva de Probabilidade...")
    
    # Arredonda para buckets de 500 em 500
    df['xp_bucket'] = (df["XP Diff 12'"] / 500).round() * 500
    
    # Agrupa e conta
    agrupado = df.groupby('xp_bucket').agg(
        total_games=('Match ID', 'count'), # <--- MUDANÇA AQUI: de 'total' para 'total_games'
        wins=('Win Rate %', 'sum')
    ).reset_index()
    
    # Calcula % de vitória
    agrupado['win_rate'] = (agrupado['wins'] / agrupado['total_games']) * 100
    
    # Filtra amostras muito pequenas
    agrupado = agrupado[agrupado['total_games'] > 5] 
    
    # Retorna com as colunas certas para o banco
    return agrupado[['xp_bucket', 'win_rate', 'total_games']]

def calcular_regressoes(df):
    """Calcula R², Inclinação e Intercepto para os 6 gráficos relacionais."""
    print("g🧮 Calculando Regressões Lineares...")
    
    configs = [
        ("Deaths até 12min", "Deaths", "rel1"),
        ("Vision Score/Min", "Kill Participation", "rel2"),
        ("Deaths até 12min", "XP Diff 12'", "rel3"),
        ("Kill Participation", "XP Diff 12'", "rel4"),
        ("Gold Diff 12'", "CS Diff 12'", "rel5"),
        ("Deaths", "Kill Participation", "rel6")
    ]
    
    resultados = []
    
    for x_col, y_col, chart_id in configs:
        # Limpeza de dados
        sub_df = df[[x_col, y_col]].dropna()
        # Remove infinitos se houver
        sub_df = sub_df[np.isfinite(sub_df).all(1)]
        
        if len(sub_df) > 2:
            slope, intercept, r_value, p_value, std_err = stats.linregress(sub_df[x_col], sub_df[y_col])
            r_squared = r_value**2
            
            # Gera 50 pontos para desenhar a linha no frontend (reduz carga)
            x_min, x_max = sub_df[x_col].min(), sub_df[x_col].max()
            # Salva os params da reta
            resultados.append({
                'chart_id': chart_id,
                'slope': slope,
                'intercept': intercept,
                'r2': round(r_squared, 3),
                'x_min': x_min,
                'x_max': x_max
            })
            
    return pd.DataFrame(resultados)

def salvar_no_banco(df, nome_tabela):
    """Salva DataFrame no Supabase substituindo dados antigos."""
    try:
        with engine.connect() as conn:
            # Limpa tabela antiga (opcional, ou usa upsert)
            conn.execute(text(f"TRUNCATE TABLE {nome_tabela}"))
            conn.commit()
            
        df.to_sql(nome_tabela, engine, if_exists='append', index=False)
        print(f"💾 Tabela '{nome_tabela}' atualizada com sucesso!")
    except Exception as e:
        print(f"❌ Erro ao salvar {nome_tabela}: {e}")

def main():
    df = carregar_dados()
    if df.empty: return

    # 1. Processa Boxplot
    df_box = calcular_boxplot(df)
    salvar_no_banco(df_box, 'analise_boxplot')

    # 2. Processa Winrate
    df_win = calcular_probabilidade_xp(df)
    salvar_no_banco(df_win, 'analise_probabilidade')

    # 3. Processa Regressões
    df_reg = calcular_regressoes(df)
    salvar_no_banco(df_reg, 'analise_regressao')
    
    print("\n🚀 PROCESSAMENTO CONCLUÍDO! O Frontend agora lerá apenas os resumos.")

if __name__ == "__main__":
    main()
