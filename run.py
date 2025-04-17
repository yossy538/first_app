# run.py
from app.app import app  # ← appディレクトリ内のapp.pyを読み込む

if __name__ == "__main__":
    print("🚀 Flaskアプリ起動中...")
    app.run(debug=True, host="127.0.0.1", port=5002)
