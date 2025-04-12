from flask import Blueprint, request, jsonify
from app.models import Estimate, EstimateDetail
from app import db
from flask import send_file
from openpyxl import load_workbook
import io
from datetime import datetime
import os
from io import BytesIO  # ← これを追加！


api_bp = Blueprint('api', __name__, url_prefix='/api')

# ✅ 見積一覧取得
@api_bp.route('/estimates', methods=['GET'])
def get_estimates():
    estimates = Estimate.query.all()
    result = []
    for e in estimates:
        result.append({
            "id": e.id,
            "project_name": e.project_name,
            "customer_name": e.customer_name,
            "total_cost": e.total_cost,
            "total_list_price": e.total_list_price,
            "quantity": e.quantity,
        })
    return jsonify(result)

# ✅ 明細データ取得
@api_bp.route('/estimate_details/<int:estimate_id>', methods=['GET'])
def get_estimate_details(estimate_id):
    details = EstimateDetail.query.filter_by(estimate_id=estimate_id).all()
    result = []
    for d in details:
        result.append({
            "id": d.id,
            "estimate_id": d.estimate_id,
            "item": d.item,
            "model": d.model,
            "quantity": d.quantity,
            "unit": d.unit,
            "cost_price": d.cost_price,
            "sale_price": d.sale_price,
            "cost_subtotal": d.cost_subtotal,
            "subtotal": d.subtotal,
        })
    return jsonify(result)

# ✅ 見積＋明細を新規保存
@api_bp.route('/estimates', methods=['POST'])
def create_estimate():
    data = request.get_json()

    now = datetime.now()
    new_estimate = Estimate(
        project_name=data.get("project_name"),
        customer_name=data.get("customer_name"),
        total_cost=data.get("total_cost"),
        total_list_price=data.get("total_list_price"),
        quantity=data.get("quantity"),
        created_at=now.strftime("%Y-%m-%d"),
        year_month=now.strftime("%Y-%m")
    )

    db.session.add(new_estimate)
    db.session.commit()

    # 🌟 明細も保存する！！
    details = data.get("details", [])
    for d in details:
        detail = EstimateDetail(
            estimate_id=new_estimate.id,
            item=d.get("item"),
            model=d.get("model"),
            quantity=d.get("quantity"),
            unit=d.get("unit"),
            cost_price=d.get("cost_price"),
            sale_price=d.get("sale_price"),
            cost_subtotal=d.get("cost_subtotal"),
            subtotal=d.get("subtotal")
        )
        db.session.add(detail)

    db.session.commit()

    return jsonify({"message": "見積保存完了！", "id": new_estimate.id})


# ✅ 見積だけを更新
@api_bp.route('/estimates/<int:estimate_id>', methods=['PUT'])
def update_estimate(estimate_id):
    data = request.get_json()
    estimate = Estimate.query.get(estimate_id)
    if not estimate:
        return jsonify({"message": "見積が存在しません"}), 404

    estimate.project_name = data.get("project_name")
    estimate.customer_name = data.get("customer_name")
    estimate.total_cost = data.get("total_cost")
    estimate.total_list_price = data.get("total_list_price")
    estimate.quantity = data.get("quantity")

    db.session.commit()
    return jsonify({"message": "見積更新完了！"})


# ✅ 明細を更新
@api_bp.route('/estimate_details/<int:estimate_id>', methods=['PUT'])
def update_estimate_details(estimate_id):
    data = request.get_json()
    # まず古い明細全部削除
    EstimateDetail.query.filter_by(estimate_id=estimate_id).delete()

    # 新しい明細を保存
    for d in data.get('details', []):
        detail = EstimateDetail(
            estimate_id=estimate_id,
            item=d.get("item"),
            model=d.get("model"),
            quantity=d.get("quantity"),
            unit=d.get("unit"),
            cost_price=d.get("cost_price"),
            sale_price=d.get("sale_price"),
            cost_subtotal=d.get("cost_subtotal"),
            subtotal=d.get("subtotal")
        )
        db.session.add(detail)

    db.session.commit()
    return jsonify({"message": "明細更新完了！"})

# ✅ 見積＋明細を削除
# ✅ 特定IDの見積データ取得
# --- 追加API ---
@api_bp.route('/export_excel/<int:estimate_id>', methods=['GET'])
def export_excel(estimate_id):
    try:
        # 見積ヘッダー情報を取得
        estimate = Estimate.query.get(estimate_id)
        if not estimate:
            return jsonify({"error": "見積データが見つかりません"}), 404
        
        # 明細情報を取得
        details = EstimateDetail.query.filter_by(estimate_id=estimate_id).all()
        
         # 🔥 ここ！！この直後にprintを入れる！！！
        print("案件名:", estimate.project_name)
        print("お客様名:", estimate.customer_name)
        print("明細件数:", len(details))

        # Excelテンプレートを開く
        template_path = os.path.join(os.path.dirname(__file__), '../../Excel原紙.xlsx')
        wb = load_workbook(template_path)
        ws = wb.active

        # 案件名・お客様名を書く
        ws["E15"] = estimate.project_name
        ws["A4"] = estimate.customer_name

        # 明細を書く
        start_row = 20
        for idx, d in enumerate(details):
            row = start_row + idx
            ws[f"C{row}"] = f"{d.item}（{d.model}）"
            ws[f"U{row}"] = d.quantity
            ws[f"Y{row}"] = d.sale_price
            ws[f"AE{row}"] = d.subtotal

        # 保存用バッファ
        output_stream = BytesIO()
        wb.save(output_stream)
        output_stream.seek(0)

        # ファイル名を動的に（案件名_日付）
        from datetime import datetime
        today_str = datetime.now().strftime("%Y%m%d")
        filename = f"{estimate.project_name}_{today_str}.xlsx"

        return send_file(
            output_stream,
            as_attachment=True,
            download_name=filename,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    except Exception as e:
        print("エクセル出力エラー:", e)
        return jsonify({"error": str(e)}), 500


