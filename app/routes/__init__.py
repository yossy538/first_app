# app/routes/main.py
from flask import Blueprint, render_template

main_bp = Blueprint("main", __name__)

@main_bp.route("/")
def index():
    return render_template("index.html")

@main_bp.route("/templates")
def show_templates():
    return render_template("templates.html")


