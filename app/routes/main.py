# app/routes/main.py
from flask import Blueprint, render_template, redirect, url_for

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    return render_template('index.html')

@main_bp.route('/list')
def list_page():
    return render_template('list.html')

@main_bp.route('/templates')
def templates_page():
    return render_template('templates.html')
