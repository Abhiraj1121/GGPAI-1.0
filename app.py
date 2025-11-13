import os
import json
from flask import Flask, render_template, request, jsonify
import requests
from dotenv import load_dotenv
from flask_cors import CORS

# 🌐 Load environment variables
load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

# 🏫 Configuration
AI_API_URL = os.getenv("AI_API_URL")
AI_API_KEY = os.getenv("AI_API_KEY")
SCHOOL_NAME = "Guru Gobind Singh Public School (GGPS)"

# 📚 Load Local Q&A File
LOCAL_QA_PATH = os.path.join(os.path.dirname(__file__), "data", "school_data.txt")
local_qa = {}
if os.path.exists(LOCAL_QA_PATH):
    with open(LOCAL_QA_PATH, "r", encoding="utf-8") as f:
        content = f.read().strip().split("\n\n")
        for entry in content:
            lines = [l.strip() for l in entry.splitlines() if l.strip()]
            if len(lines) >= 2:
                q = lines[0].lower()
                a = " ".join(lines[1:])
                local_qa[q] = a

def local_lookup(query):
    """Simple local lookup"""
    return local_qa.get(query.lower().strip())

# 🤖 AI Query Function
def ai_query(user_input, history=None, system_note=None):
    if not AI_API_URL or not AI_API_KEY:
        return "Swastik: AI backend not configured. Please contact admin."

    headers = {
        "Authorization": f"Bearer {AI_API_KEY}",
        "Content-Type": "application/json"
    }

    system_note = system_note or (
        "You are Swastik — the official AI assistant of Guru Gobind Singh Public School (GGPS), "
        "Sector 5, Bokaro Steel City, Jharkhand, India. "
        "Your goal is to help students, teachers, and visitors by answering questions in a friendly, "
        "natural, and conversational tone. Speak like a real assistant — polite, confident, and engaging. "
        f"When someone asks about {SCHOOL_NAME}, give helpful and accurate answers "
        "based on known school details, public information, and policies. "
        "Do not include personal, private, or confidential data. "
        "If someone asks for your name, always reply: 'I am Swastik, your smart school assistant.' "
        "You were developed by Abhi Raj Singh and his team from Class 11/C as part of their school project. "
        f"Contact information of {SCHOOL_NAME}: Phone: +91-06542-268589 , Email: ggpsbok@rediffmail.com . "
        "Fee Payment Link: https://feepayment.ggpsbokaro.com/parent/Login . "
        "School Facebook Page: https://www.facebook.com/p/GGPSBokaro-100057053245791/ . "
        "The current principal is Mr. Abhishek Kumar (joined in September 2025). "
        "The official school website is https://ggpsbokaro.com/ . "
        "Keep your answers short, natural, and respectful — never sound robotic or overly formal. "
        "The term swastik (or swastika) originates from the Sanskrit word for well-being and is an ancient symbol "
        "of good fortune and prosperity in many cultures, most notably Hinduism, Buddhism, and Jainism. "
        "You are female (She/Her)."
    )

    messages = [{"role": "system", "content": system_note}]
    if history and isinstance(history, list):
        for m in history[-12:]:
            if m.get("role") in ("user", "assistant") and "content" in m:
                messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": user_input})

    body = {
        "model": "meta-llama/llama-3.3-8b-instruct:free",
        "messages": messages,
        "max_tokens": 800,
        "temperature": 0.2
    }

    try:
        resp = requests.post(AI_API_URL, headers=headers, json=body, timeout=30)

        # 🔧 Handle known errors
        if resp.status_code == 401:
            return "Swastik: The AI server is currently closed. Please try again later."
        if resp.status_code == 429:
            return "Swastik: The server is receiving too many requests. Please wait a bit and try again."
        if resp.status_code == 500:
            return "Swastik: The AI server encountered an internal error. Please retry later."

        if resp.status_code == 200:
            data = resp.json()
            if "choices" in data and len(data["choices"]) > 0:
                choice = data["choices"][0]
                if isinstance(choice.get("message"), dict) and "content" in choice["message"]:
                    return choice["message"]["content"].strip()
                if choice.get("text"):
                    return choice["text"].strip()
            if "text" in data:
                return data["text"].strip()
            return "Swastik: AI response format unexpected."

        return f"Swastik: AI error {resp.status_code}: {resp.text}"

    except requests.exceptions.ReadTimeout:
        return "Swastik: Sorry, the AI server took too long to respond. Please try again shortly."
    except Exception as e:
        return f"Swastik: Unexpected server error — {str(e)}"

# 🌐 Routes
@app.route("/")
def index():
    return render_template("index.html", school_name=SCHOOL_NAME, bot_name="Swastik")

@app.route("/api/chat", methods=["POST"])
def chat():
    payload = request.json or {}
    msg = payload.get("message", "").strip()
    history = payload.get("history", [])

    if not msg:
        return jsonify({
            "reply": "Swastik: It seems like your message is empty. How can I assist you today?",
            "source": "system"
        })

    # 🎯 Local lookup first
    local = local_lookup(msg)
    if local:
        return jsonify({"reply": local, "source": "local"})

    # 🌐 Fallback to AI
    reply = ai_query(msg, history=history)
    return jsonify({"reply": reply, "source": "ai"})

# 🖥️ Run App
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
