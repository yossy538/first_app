from flask import Blueprint, request, jsonify
from app.models import Estimate, EstimateDetail  # models からちゃんとインポート！
from app import db

api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.route('/estimates', methods=['GET'])
def get_estimates():
    estimates = Estimate.query.all()
    result = [e.to_dict() for e in estimates]
    return jsonify(result)
