import sqlite3
import os

# `estimate_app/` のルートディレクトリを取得
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))  
DB_PATH = os.path.abspath("database/estimates.db")

def connect_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

if __name__ == "__main__":
    conn = connect_db()
    if conn:
        print(f"✅ SQLite に接続成功！DBパス: {DB_PATH}")
        conn.close()

def insert_estimate(project_name, customer_name, total_cost, total_list_price):
    """見積データを追加する関数"""
    conn = connect_db()
    cursor = conn.cursor()
    
    # 利益額・利益率・値引率を計算
    total_profit = total_list_price - total_cost
    profit_rate_cost = (total_profit / total_cost * 100) if total_cost > 0 else 0
    profit_rate_list = (total_profit / total_list_price * 100) if total_list_price > 0 else 0
    discount_rate = ((total_list_price - total_cost) / total_list_price * 100) if total_list_price > 0 else 0

    # データを挿入
    cursor.execute("""
        INSERT INTO estimates (project_name, customer_name, total_cost, total_list_price, total_profit, 
                               profit_rate_cost, profit_rate_list, discount_rate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (project_name, customer_name, total_cost, total_list_price, total_profit, profit_rate_cost, profit_rate_list, discount_rate))

    conn.commit()
    conn.close()
    print("✅ データ追加成功！")

if __name__ == "__main__":
    # テストデータを追加
    insert_estimate("空調設備工事", "サンプル株式会社", 500000, 800000)
