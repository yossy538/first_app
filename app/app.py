from flask import Flask, Response, request, jsonify
import json
from models.database import connect_db  # データベース接続

app = Flask(__name__)

@app.route("/")
def home():
    response_data = {"message": "🚀 Flask API is running!"}
    return Response(
        json.dumps(response_data, ensure_ascii=False), 
        mimetype="application/json; charset=utf-8"
    )
    
    
@app.route("/api/estimates", methods=["GET"])
def get_estimates():
    """見積一覧を取得するAPI"""
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM estimates")
    estimates = cursor.fetchall()
    conn.close()

    # データをJSON形式に変換
    estimates_list = [
        dict(id=row["id"], project_name=row["project_name"], customer_name=row["customer_name"],
             total_cost=row["total_cost"], total_list_price=row["total_list_price"],
             total_profit=row["total_profit"], profit_rate_cost=row["profit_rate_cost"],
             profit_rate_list=row["profit_rate_list"], discount_rate=row["discount_rate"],
             created_at=row["created_at"])
        for row in estimates
    ]

    return Response(
        json.dumps(estimates_list, ensure_ascii=False),  # ← Unicode エスケープを無効化！
        mimetype="application/json; charset=utf-8"
    )

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


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5002)
