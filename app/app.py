from flask import Flask, Response
import json

app = Flask(__name__)

@app.route("/")
def home():
    response_data = {"message": "🚀 Flask API is running!"}
    return Response(
        json.dumps(response_data, ensure_ascii=False), 
        mimetype="application/json; charset=utf-8"
    )

if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5002)
