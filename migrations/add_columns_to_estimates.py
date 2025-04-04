import sqlite3

DB_PATH = "data/estimate.db"  # SQLiteのデータベースのパス

def alter_table():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 追加するカラム
    new_columns = {
        "total_cost_sum": "REAL DEFAULT 0",
        "total_list_price_sum": "REAL DEFAULT 0",
        "total_profit": "REAL DEFAULT 0",
        "profit_rate": "REAL DEFAULT 0"
    }

    try:
        for column, col_type in new_columns.items():
            try:
                cursor.execute(f"ALTER TABLE estimates ADD COLUMN {column} {col_type}")
                print(f"✅ {column} カラムを追加しました！")
            except sqlite3.OperationalError:
                print(f"⚠️ {column} はすでに存在します。スキップします。")

        conn.commit()
        print("✅ テーブルの更新が完了しました！")

    except Exception as e:
        print(f"⚠️ エラー発生: {e}")

    finally:
        conn.close()

if __name__ == "__main__":
    alter_table()
