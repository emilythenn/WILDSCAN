import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

genai.configure(api_key=os.environ["GEMINI_API_KEY"])

print("Listing available models...\n")
for m in genai.list_models():
    # Only print models that support generateContent (what we need)
    if "generateContent" in m.supported_generation_methods:
        print(m.name, "=>", m.supported_generation_methods)
