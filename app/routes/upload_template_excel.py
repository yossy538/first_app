# app/routes/upload_template_excel.py
from flask import Blueprint, request, jsonify
import openpyxl
import os
from app.routes.api import connect_db  # connect_db を正しく import してね！

upload_bp = Blueprint("upload", __name__, url_prefix="/api")

@upload_bp.route("/upload_template_excel", methods=["POST"])
def upload_template_excel():
    try:
        # 📁 ファイル取得
        uploaded_file = request.files.get("file")
        if not uploaded_file or not uploaded_file.filename.endswith(".xlsx"):
            return jsonify({"error": "Excelファイル（.xlsx）をアップロードしてください"}), 400

        # 📖 Excelファイル読み込み
        wb = openpyxl.load_workbook(uploaded_file)
        ws = wb.active

        # 📄 明細抽出（2行目以降）
        details = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row or not row[0]:  # 空行なら終了
                break

            quantity = row[2] or 0
            cost_price = row[4] or 0
            sale_price = row[5] or 0

            details.append({
                "item": row[0],
                "model": row[1] or "",
                "quantity": quantity,
                "unit": row[3] or "",
                "cost_price": cost_price,
                "sale_price": sale_price,
                "cost_subtotal": quantity * cost_price,
                "subtotal": quantity * sale_price,
            })

        # 📦 テンプレート用データ生成
        payload = {
            "template_name": os.path.splitext(uploaded_file.filename)[0],
            "project_name": "",
            "customer_name": "",
            "target_profit_rate": 30,
            "category": "Excel読み込み",
            "details": details
        }

        print(f"🧾 アップロードテンプレート: {payload['template_name']}")
        for d in details:
            print("  -", d)

        # 💾 データベースへ保存
        conn = connect_db()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO estimate_templates (template_name, project_name, customer_name, target_profit_rate, category)
            VALUES (?, ?, ?, ?, ?)
        """, (
            payload["template_name"],
            payload["project_name"],
            payload["customer_name"],
            payload["target_profit_rate"],
            payload["category"]
        ))

        template_id = cursor.lastrowid

        for d in payload["details"]:
            cursor.execute("""
                INSERT INTO estimate_template_details (
                    template_id, item, model, quantity, unit, cost_price, sale_price, cost_subtotal, subtotal
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                template_id,
                d["item"],
                d["model"],
                d["quantity"],
                d["unit"],
                d["cost_price"],
                d["sale_price"],
                d["cost_subtotal"],
                d["subtotal"]
            ))

        conn.commit()
        conn.close()

        return jsonify({"message": "✅ テンプレート追加成功！"})

    except Exception as e:
        print("🚨 アップロード処理エラー:", e)
        return jsonify({"error": str(e)}), 500
