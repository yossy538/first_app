import sqlite3
import os

# `estimate_app/` のルートディレクトリを取得
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DB_PATH = os.path.join(BASE_DIR, "database", "estimates.db")

def connect_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def insert_estimate(project_name, customer_name, total_cost, total_list_price):
    conn = connect_db()
    cursor = conn.cursor()
    
    total_profit = total_list_price - total_cost
    profit_rate_cost = (total_profit / total_cost * 100) if total_cost else 0
    profit_rate_list = (total_profit / total_list_price * 100) if total_list_price else 0
    discount_rate = ((total_list_price - total_cost) / total_list_price * 100) if total_list_price else 0

    cursor.execute("""
        INSERT INTO estimates (project_name, customer_name, total_cost, total_list_price, total_profit, 
                               profit_rate_cost, profit_rate_list, discount_rate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (project_name, customer_name, total_cost, total_list_price, total_profit, profit_rate_cost, profit_rate_list, discount_rate))

    conn.commit()
    conn.close()
