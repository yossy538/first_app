# ==== 1. 標準ライブラリ ====
import os
import sys
import re
import subprocess
import sqlite3
from datetime import datetime

# ==== 2. 外部ライブラリ ====
import openpyxl
from flask import Flask, jsonify, send_file, render_template, Response, request

# ==== 3. 自作モジュール ====
from app.models import db
from app.routes.main import main_bp
from app.routes.api import api_bp

# ==== 4. Flaskアプリ初期化 ====
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///../database/estimates.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

app.register_blueprint(main_bp)
app.register_blueprint(api_bp)

# ==== 5. 定数・共通関数 ====
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "database", "estimates.db")

def connect_db():
    conn = sqlite3.connect(DB_PATH)
    return conn

def generate_filename(estimate_id, project_name, customer_name):
    today = datetime.now().strftime("%Y-%m-%d")  # ← 日付を 2025-04-15形式に！

    def clean_name(name):
        name = re.sub(r'[\\/:*?"<>|]', '_', name)
        return name.strip()

    clean_project_name = clean_name(project_name) or "未入力案件"
    clean_customer_name = clean_name(customer_name) or "未入力顧客"

    company_name = "株式会社サンクウ"

    # 🔥 ファイル名を作る
    filename = f"{estimate_id:04d}_{clean_customer_name}_{clean_project_name}_{today}_見積書_{company_name}.pdf"
    return filename



# ==== 6. ルーティング ====

@app.route("/")
def home():
    estimates = db.session.query(db.Model).all()
    estimates_list = [{
        "id": e.id,
        "project_name": e.project_name,
        "customer_name": e.customer_name,
        "total_cost": e.total_cost,
        "total_list_price": e.total_list_price,
        "total_profit": e.total_profit,
        "profit_rate_cost": e.profit_rate_cost,
        "profit_rate_list": e.profit_rate_list,
        "discount_rate": e.discount_rate,
        "quantity": e.quantity
    } for e in estimates]

    return render_template("index.html", estimates=estimates_list)

@app.route("/api/export_excel/<int:estimate_id>")
def export_excel(estimate_id):
    # --- データ取得 ---
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT project_name, customer_name FROM estimates WHERE id = ?", (estimate_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "指定された見積データが見つかりません"}), 404

    project_name, customer_name = row

    # --- ファイル名作成 ---
    base_filename = generate_filename(estimate_id, project_name, customer_name)  # ✅理想のファイル名
    target_pdf_path = f"./{base_filename}"
    temp_excel_path = "./temp_output.xlsx"   # Excel仮ファイル
    temp_pdf_path = "./temp_output.pdf"       # PDF仮ファイル（LibreOfficeが勝手に作る）


    # --- Excelファイル作成 ---
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "見積書"
    ws["A1"] = "案件名"
    ws["B1"] = project_name
    ws["A2"] = "お客様名"
    ws["B2"] = customer_name
    wb.save(excel_path)

    print(f"✅ Excel保存完了: {excel_path}")

    # --- LibreOfficeでExcel → PDF変換 ---
    subprocess.run([
        "soffice",
        "--headless",
        "--convert-to", "pdf",
        "--outdir", ".",  # 出力先フォルダ（カレントディレクトリ）
        excel_path
    ], check=True)

    print(f"✅ PDF変換完了: {pdf_path}")

    # --- PDFを返す ---
    return send_file(pdf_path, as_attachment=True)




# ==== 7. 最後にアプリ起動 ====
if __name__ == "__main__":
    print(f"\U0001F4C1 使用しているDBパス: {DB_PATH}")
    app.run(debug=True, host="127.0.0.1", port=5002)