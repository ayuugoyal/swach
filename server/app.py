import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["https://get-data.vercel.app", "http://localhost:3000"], supports_credentials=True)

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("No API key found. Please set GOOGLE_API_KEY environment variable.")

genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-pro')

@app.route('/api/solid-waste-data', methods=['POST'])
def get_solid_waste_data():
    try:
        data = request.json

        if not data:
            return jsonify({"error": "No data provided"}), 400

        state = data.get('state')
        country = data.get('country')

        if not state or not country:
            return jsonify({"error": "Both state and country are required"}), 400

        prompt = f"""
        Generate detailed solid waste data for {state}, {country}.
        Make sure to give precise lanitude and longitude coordinates for the state and landfills it is mandatory.
        Return the response in the following JSON format:
        {{
            "state": "{state}",
            "country": "{country}",
            "total_waste_generated": "Total waste generated in metric tons/year",
            "waste_composition": {{
                "organic": "Percentage of organic waste",
                "plastic": "Percentage of plastic waste",
                "paper": "Percentage of paper waste",
                "metal": "Percentage of metal waste",
                "glass": "Percentage of glass waste",
                "other": "Percentage of other waste"
            }},
            "recycling_rate": "Recycling rate in percentage",
            "waste_management_methods": {{
                "landfill": "Percentage of waste managed through landfill",
                "recycling": "Percentage of waste recycled",
                "composting": "Percentage of waste composted",
                "incineration": "Percentage of waste incinerated"
            }},
            "key_challenges": ["Challenge 1", "Challenge 2"],
            "initiatives": ["Initiative 1", "Initiative 2"],
            "data_year": "Year of data, if available",
            "coordinates": {{
                "state_lat": "Latitude of the state",
                "state_lon": "Longitude of the state",
                "landfills": [
                    {{
                        "lat": "Latitude of landfill 1",
                        "lon": "Longitude of landfill 1",
                        "name": "Name of landfill 1"
                    }},
                    {{
                        "lat": "Latitude of landfill 2",
                        "lon": "Longitude of landfill 2",
                        "name": "Name of landfill 2"
                    }}
                ]
            }}
        }}
        """

        response = model.generate_content(prompt)
        generated_text = response.text.strip()

        print(f"Raw AI Response: {generated_text}")

        try:
            if generated_text.startswith('```json'):
                generated_text = generated_text[7:-3]
            elif generated_text.startswith('``` JSON'):
                generated_text = generated_text[8:-3]
            elif generated_text.startswith('```JSON'):
                generated_text = generated_text[7:-3]
            elif generated_text.startswith('```'):
                generated_text = generated_text[3:-3]
            enriched_data = json.loads(generated_text)
            print(f"Enriched Data: {enriched_data}")
            return jsonify(enriched_data), 200
        
        except json.JSONDecodeError as parse_error:
            return jsonify({
                "error": "Failed to parse AI response",
                "details": str(parse_error),
                "raw_response": generated_text
            }), 500

    except genai.types.generation_types.GenerationException as e:
        return jsonify({"error": "AI model error", "details": str(e)}), 500
    
    except Exception as e:
        return jsonify({
            "error": "Server error",
            "details": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get("PORT", 5000)))
