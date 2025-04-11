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

class EstimateDetail(db.Model):
    __tablename__ = 'estimate_details'

    id = db.Column(db.Integer, primary_key=True)
    estimate_id = db.Column(db.Integer, db.ForeignKey('estimates.id'), nullable=False)
    item = db.Column(db.String(255))
    model = db.Column(db.String(255))
    quantity = db.Column(db.Integer)
    unit = db.Column(db.String(50))
    cost_price = db.Column(db.Float)
    sale_price = db.Column(db.Float)
    cost_subtotal = db.Column(db.Float)
    subtotal = db.Column(db.Float)

    def to_dict(self):
        return {
            "id": self.id,
            "estimate_id": self.estimate_id,
            "item": self.item,
            "model": self.model,
            "quantity": self.quantity,
            "unit": self.unit,
            "cost_price": self.cost_price,
            "sale_price": self.sale_price,
            "cost_subtotal": self.cost_subtotal,
            "subtotal": self.subtotal,
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            estimate_id=data.get("estimate_id"),
            item=data.get("item"),
            model=data.get("model"),
            quantity=data.get("quantity"),
            unit=data.get("unit"),
            cost_price=data.get("cost_price"),
            sale_price=data.get("sale_price"),
            cost_subtotal=data.get("cost_subtotal"),
            subtotal=data.get("subtotal"),
        )

