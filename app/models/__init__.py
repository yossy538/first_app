from app import db

class Estimate(db.Model):
    __tablename__ = 'estimates'

    id = db.Column(db.Integer, primary_key=True)
    project_name = db.Column(db.String(255))
    customer_name = db.Column(db.String(255))
    total_cost = db.Column(db.Integer)
    total_list_price = db.Column(db.Integer)
    quantity = db.Column(db.Integer)
    created_at = db.Column(db.String(10))
    year_month = db.Column(db.String(7))

    def to_dict(self):
        return {
            "id": self.id,
            "project_name": self.project_name,
            "customer_name": self.customer_name,
            "total_cost": self.total_cost,
            "total_list_price": self.total_list_price,
            "quantity": self.quantity,
            "created_at": self.created_at,
            "year_month": self.year_month,
        }

    @classmethod
    def from_dict(cls, data):
        from datetime import datetime
        now = datetime.now()
        return cls(
            project_name=data.get("project_name"),
            customer_name=data.get("customer_name"),
            total_cost=data.get("total_cost"),
            total_list_price=data.get("total_list_price"),
            quantity=data.get("quantity"),
            created_at=now.strftime("%Y-%m-%d"),
            year_month=now.strftime("%Y-%m"),
        )

    def update_from_dict(self, data):
        for field in ["project_name", "customer_name", "total_cost", "total_list_price", "quantity", "created_at", "year_month"]:
            if field in data:
                setattr(self, field, data[field])

# ここ重要！！
class EstimateDetail(db.Model):
    __tablename__ = 'estimate_details'

    id = db.Column(db.Integer, primary_key=True)
    estimate_id = db.Column(db.Integer, db.ForeignKey('estimates.id'))
    item = db.Column(db.String(255))
    model = db.Column(db.String(255))
    quantity = db.Column(db.Integer)
    unit = db.Column(db.String(50))
    cost_price = db.Column(db.Integer)
    sale_price = db.Column(db.Integer)
    cost_subtotal = db.Column(db.Integer)
    subtotal = db.Column(db.Integer)
