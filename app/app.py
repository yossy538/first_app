import os
import sys
from flask import Flask
from app.models import db    # ここでSQLAlchemyを使う！

# アプリ生成
app = Flask(__name__)

# SQLAlchemy設定
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///../database/estimates.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# DB初期化
db.init_app(app)

# Blueprint登録
from app.routes.main import main_bp
from app.routes.api import api_bp
app.register_blueprint(main_bp)
app.register_blueprint(api_bp)

# DBのパス
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "database", "estimates.db")





def alter_table():
    conn = connect_db()
    cursor = conn.cursor()

    # 必要なカラムがなければ追加する
    try:
        cursor.execute("ALTER TABLE estimates ADD COLUMN total_cost_sum REAL DEFAULT 0")
        cursor.execute("ALTER TABLE estimates ADD COLUMN total_list_price_sum REAL DEFAULT 0")
        cursor.execute("ALTER TABLE estimates ADD COLUMN total_profit REAL DEFAULT 0")
        cursor.execute("ALTER TABLE estimates ADD COLUMN profit_rate REAL DEFAULT 0")
        conn.commit()
        print("✅ テーブルを更新しました！")
    except sqlite3.OperationalError as e:
        print(f"⚠️ カラムの追加エラー: {e}")

    conn.close()

@app.route("/")
def home():
    estimates = Estimate.query.all()  # ← SQL書かなくても全部取得できる！

    estimates_list = [
        {
            "id": e.id,
            "project_name": e.project_name,
            "customer_name": e.customer_name,
            "total_cost": e.total_cost,
            "total_list_price": e.total_list_price,
            "total_profit": e.total_profit,
            "profit_rate_cost": e.profit_rate_cost,
            "profit_rate_list": e.profit_rate_list,
            "discount_rate": e.discount_rate,
            "quantity": e.quantity,
        }
        for e in estimates
    ]

    return render_template("index.html", estimates=estimates_list)


# app.py に追加
@app.route("/api/estimates", methods=["GET"])
def get_estimates():
    try:
        conn = connect_db()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT 
                id, project_name, customer_name, total_cost, total_list_price, quantity
            FROM estimates
            ORDER BY id DESC
        """)
        rows = cursor.fetchall()
        conn.close()

        estimates = [dict(
            id=row[0],
            project_name=row[1],
            customer_name=row[2],
            total_cost=row[3],
            total_list_price=row[4],
            quantity=row[5]
        ) for row in rows]

        return jsonify(estimates)

    except Exception as e:
        return jsonify({"error": str(e)}), 500



        # データをJSON形式に変換（🔥 `quantity` を追加！）
        estimates_list = [
            dict(id=row[0], project_name=row[1], customer_name=row[2],
                 total_cost=row[3], total_list_price=row[4],
                 total_profit=row[5], profit_rate_cost=row[6],
                 profit_rate_list=row[7], discount_rate=row[8],
                 quantity=row[9],  # 🔥 `quantity` を追加
                 created_at=row[10])
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
            conn.close()
            return jsonify({"error": "指定された見積データが見つかりません"}), 404

        # データを削除
        cursor.execute("DELETE FROM estimates WHERE id = ?", (estimate_id,))
        conn.commit()
        conn.close()

        return jsonify({"message": f"✅ 見積データ（ID: {estimate_id}）を削除しました！"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
    


    
@app.route("/api/estimates/<int:estimate_id>", methods=["PUT"])
def update_estimate(estimate_id):
    try:
        conn = connect_db()
        cursor = conn.cursor()

        data = request.get_json()
        print("PUT受信データ:", data)

        # 1. estimates（ヘッダー情報）を更新する
        cursor.execute("""
            UPDATE estimates
            SET project_name = ?, customer_name = ?, total_cost = ?, total_list_price = ?, quantity = ?
            WHERE id = ?
        """, (data["project_name"], data["customer_name"], data["total_cost"], data["total_list_price"], data["quantity"], estimate_id))

        # 2. 明細（estimate_details）を全部一回削除する
        cursor.execute("DELETE FROM estimate_details WHERE estimate_id = ?", (estimate_id,))

        # 3. 明細データ（複数行）を挿入する
        for detail in data["details"]:
            cursor.execute("""
                INSERT INTO estimate_details (estimate_id, item, model, quantity, unit, cost_price, sale_price, cost_subtotal, subtotal)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                estimate_id,
                detail.get("item", ""),
                detail.get("model", ""),
                detail.get("quantity", 0),
                detail.get("unit", ""),
                detail.get("cost_price", 0),
                detail.get("sale_price", 0),
                detail.get("cost_subtotal", 0),
                detail.get("subtotal", 0)
            ))

        conn.commit()
        conn.close()

        return jsonify({"message": "見積を更新しました！"})

    except Exception as e:
        print("更新エラー:", e)
        return jsonify({"error": str(e)}), 500

    
@app.route("/api/estimates", methods=["POST"])
def create_estimate():
    try:
        conn = connect_db()
        cursor = conn.cursor()

        data = request.get_json()
        print("POST受信データ:", data)

        total_profit = data["total_list_price"] - data["total_cost"]
        profit_rate_cost = (total_profit / data["total_list_price"] * 100) if data["total_list_price"] > 0 else 0
        profit_rate_list = (total_profit / data["total_cost"] * 100) if data["total_cost"] > 0 else 0  # ←これ追加！！
        discount_rate = ((data["total_list_price"] - data["total_cost"]) / data["total_list_price"] * 100) if data["total_list_price"] > 0 else 0


        cursor.execute("""
            INSERT INTO estimates (project_name, customer_name, total_cost, total_list_price, total_profit, profit_rate_cost, profit_rate_list, discount_rate, quantity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data["project_name"],
            data["customer_name"],
            data["total_cost"],
            data["total_list_price"],
            total_profit,
            profit_rate_cost,
            profit_rate_list,
            discount_rate,  # ここ忘れず！
            data["quantity"]
        ))


        new_estimate_id = cursor.lastrowid  # ← 新しいIDも取れる！

        # 明細（details）も登録する
        for detail in data["details"]:
            cursor.execute("""
                INSERT INTO estimate_details (estimate_id, item, model, quantity, unit, cost_price, sale_price, cost_subtotal, subtotal)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                new_estimate_id,
                detail.get("item", ""),
                detail.get("model", ""),
                detail.get("quantity", 0),
                detail.get("unit", ""),
                detail.get("cost_price", 0),
                detail.get("sale_price", 0),
                detail.get("cost_subtotal", 0),
                detail.get("subtotal", 0)
            ))

        conn.commit()
        conn.close()

        return jsonify({"message": "✅ 新しい見積を保存しました！"})

    except Exception as e:
        print("保存エラー:", e)
        return jsonify({"error": str(e)}), 500

function initializeButtons() {
  document.getElementById('add-row-btn').addEventListener('click', addRow);
  document.getElementById('save-btn').addEventListener('click', saveEstimate);
  document.getElementById('apply-profit-rate-btn').addEventListener('click', applyTargetProfitRate);

  // 🌟追加！利益率再計算ボタン
  document.getElementById('recalc-profit-rate-btn').addEventListener('click', recalcProfitRates);
}

function recalcProfitRates() {
  const rows = detailTable.getRows();  // 全行取得！
  rows.forEach(row => {
    const data = row.getData();
    const costPrice = data.cost_price || 0;
    const salePrice = data.sale_price || 0;
    let profitRate = "-";

    if (salePrice > 0) {
      profitRate = ((salePrice - costPrice) / salePrice) * 100;
      profitRate = profitRate.toFixed(1) + "%";
    }

    // 🌟row.updateで画面だけ更新！
    row.update({ profit_rate: profitRate });
  });

  console.log("✅ 項目ごとの利益率を再計算しました！");
}

    
    



    

print(f"📁 使用しているDBパス: {DB_PATH}")



# 🔥 `app.run()` を最後の1回だけに修正！
if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5002)
