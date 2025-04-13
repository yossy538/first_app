from flask import Blueprint, request, jsonify, send_file
from app.models import Estimate, EstimateDetail
from app import db
from openpyxl import load_workbook
from openpyxl.worksheet.pagebreak import Break
from io import BytesIO
import os
from datetime import datetime

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

# ✅ 新規見積＋明細登録
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

# ✅ 見積＋明細まとめて更新
@api_bp.route('/estimates/<int:estimate_id>', methods=['PUT'])
def update_estimate(estimate_id):
    data = request.get_json()
    estimate = Estimate.query.get(estimate_id)
    if not estimate:
        return jsonify({"message": "見積が存在しません"}), 404

    # 見積ヘッダー更新
    estimate.project_name = data.get("project_name")
    estimate.customer_name = data.get("customer_name")
    estimate.total_cost = data.get("total_cost")
    estimate.total_list_price = data.get("total_list_price")
    estimate.quantity = data.get("quantity")

    # 明細を一旦削除して新規登録
    EstimateDetail.query.filter_by(estimate_id=estimate_id).delete()
    for d in data.get("details", []):
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

    return jsonify({"message": "見積＆明細 更新完了！"})

# ✅ 特定IDの見積取得
@api_bp.route('/estimates/<int:estimate_id>', methods=['GET'])
def get_estimate(estimate_id):
    estimate = Estimate.query.get(estimate_id)
    if not estimate:
        return jsonify({"message": "見積が存在しません"}), 404

    return jsonify({
        "id": estimate.id,
        "project_name": estimate.project_name,
        "customer_name": estimate.customer_name,
        "total_cost": estimate.total_cost,
        "total_list_price": estimate.total_list_price,
        "quantity": estimate.quantity
    })

# ✅ Excel出力
# ✅ Excel出力
@api_bp.route('/export_excel/<int:estimate_id>', methods=['GET'])
def export_excel(estimate_id):
    try:
        estimate = Estimate.query.get(estimate_id)
        if not estimate:
            return jsonify({"error": "見積データが見つかりません"}), 404

        details = EstimateDetail.query.filter_by(estimate_id=estimate_id).all()

        template_path = os.path.join(os.path.dirname(__file__), '../../Excel原紙.xlsx')
        wb = load_workbook(template_path)
        ws = wb.active

        # 🔥 すべての結合セルを解除する
        merged_ranges = list(ws.merged_cells.ranges)
        for merged_range in merged_ranges:
            ws.unmerge_cells(str(merged_range))

        # ✅ お客様名・案件名
        ws["F4"] = estimate.customer_name or ""
        ws["F16"] = estimate.project_name or ""

        # ✅ 明細データ
        start_row = 21
        for idx, d in enumerate(details):
            row = start_row + idx

            ws[f"A{row}"] = f"{d.item}（{d.model}）" if d.model else d.item
            ws[f"G{row}"] = d.quantity
            ws[f"H{row}"] = d.sale_price
            ws[f"I{row}"] = d.subtotal

        # ✅ 合計金額
        total = sum(d.subtotal for d in details)
        ws["I39"] = total
        ws["F12"] = total

        # 🔥 保存
        output_stream = BytesIO()
        wb.save(output_stream)
        output_stream.seek(0)

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
