import os
import sys
from flask import Flask, Response, jsonify, render_template, request  # ← `request` を追加！
import json

# `models/` ディレクトリを `sys.path` に追加
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from models.database import connect_db  # データベース接続

app = Flask(__name__)

@app.route("/")
def home():
    """見積データをWebページで表示"""
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM estimates")
    estimates = cursor.fetchall()
    conn.close()
    return render_template("index.html", estimates=estimates)

@app.route("/api/estimates", methods=["GET"])
def get_estimates():
    """見積一覧を取得するAPI"""
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM estimates")
        estimates = cursor.fetchall()
        conn.close()

        # データがない場合は空リストを返す
        if not estimates:
            return jsonify([]), 200

        # データをJSON形式に変換
        estimates_list = [
            dict(id=row[0], project_name=row[1], customer_name=row[2],
                 total_cost=row[3], total_list_price=row[4],
                 total_profit=row[5], profit_rate_cost=row[6],
                 profit_rate_list=row[7], discount_rate=row[8],
                 created_at=row[9])
            for row in estimates
        ]

        return Response(
            json.dumps(estimates_list, ensure_ascii=False),
            mimetype="application/json; charset=utf-8"
        )
    except Exception as e:
        return Response(
            json.dumps({"error": str(e)}, ensure_ascii=False),
            mimetype="application/json; charset=utf-8"
        ), 500

@app.route("/api/estimates", methods=["POST"])
def add_estimate():
    """見積データを追加するAPI"""
    try:
        data = request.json  # リクエストのJSONデータを取得

        # 必要なデータが含まれているかチェック
        required_fields = ["project_name", "customer_name", "total_cost", "total_list_price"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # データの取得
        project_name = data["project_name"]
        customer_name = data["customer_name"]
        total_cost = float(data["total_cost"])
        total_list_price = float(data["total_list_price"])

        # 利益計算
        total_profit = total_list_price - total_cost
        profit_rate_cost = (total_profit / total_cost * 100) if total_cost > 0 else 0
        profit_rate_list = (total_profit / total_list_price * 100) if total_list_price > 0 else 0
        discount_rate = ((total_list_price - total_cost) / total_list_price * 100) if total_list_price > 0 else 0

        # データベースに追加
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO estimates (project_name, customer_name, total_cost, total_list_price, total_profit, 
                                   profit_rate_cost, profit_rate_list, discount_rate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (project_name, customer_name, total_cost, total_list_price, total_profit, profit_rate_cost, profit_rate_list, discount_rate))
        conn.commit()
        conn.close()

        return jsonify({"message": "✅ 見積データが追加されました！"}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/estimates/<int:estimate_id>", methods=["DELETE"])
def delete_estimate(estimate_id):
    """指定したIDの見積データを削除するAPI"""
    try:
        conn = connect_db()
        cursor = conn.cursor()

        # 指定したIDの見積データが存在するか確認
        cursor.execute("SELECT * FROM estimates WHERE id = ?", (estimate_id,))
        estimate = cursor.fetchone()

        if not estimate:
            return jsonify({"error": "指定された見積データが見つかりません"}), 404

        # データを削除
        cursor.execute("DELETE FROM estimates WHERE id = ?", (estimate_id,))
        conn.commit()
        conn.close()

        return jsonify({"message": f"✅ 見積データ（ID: {estimate_id}）を削除しました！"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route("/api/estimates/<int:estimate_id>", methods=["PUT"])
def update_estimate(estimate_id):
    """指定したIDの見積データを更新するAPI"""
    try:
        data = request.json  # クライアントからのJSONデータを取得

        # 必要なデータがあるかチェック
        required_fields = ["project_name", "customer_name", "total_cost", "total_list_price"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # 既存の見積データを取得（存在チェック）
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM estimates WHERE id = ?", (estimate_id,))
        existing_estimate = cursor.fetchone()

        if not existing_estimate:
            conn.close()
            return jsonify({"error": "指定された見積データが見つかりません"}), 404

        # 新しいデータを取得
        project_name = data["project_name"]
        customer_name = data["customer_name"]
        total_cost = float(data["total_cost"])
        total_list_price = float(data["total_list_price"])

        # 利益計算
        total_profit = total_list_price - total_cost
        profit_rate_cost = (total_profit / total_cost * 100) if total_cost > 0 else 0
        profit_rate_list = (total_profit / total_list_price * 100) if total_list_price > 0 else 0
        discount_rate = ((total_list_price - total_cost) / total_list_price * 100) if total_list_price > 0 else 0

        # データベースを更新
        cursor.execute("""
            UPDATE estimates
            SET project_name=?, customer_name=?, total_cost=?, total_list_price=?, 
                total_profit=?, profit_rate_cost=?, profit_rate_list=?, discount_rate=?
            WHERE id=?
        """, (project_name, customer_name, total_cost, total_list_price, 
              total_profit, profit_rate_cost, profit_rate_list, discount_rate, estimate_id))
        conn.commit()
        conn.close()

        return jsonify({"message": f"✅ 見積データ（ID: {estimate_id}）を更新しました！"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 🔥 `app.run()` を最後の1回だけに修正！
if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5002)
