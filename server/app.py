import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from dotenv import load_dotenv
import numpy as np
import pandas as pd

class WasteManagementRouter:
    def __init__(self, criteria_weights):
        """
        Initialize the waste management routing optimizer

        :param criteria_weights: Dictionary of criteria and their importance weights
        """
        self.criteria_weights = criteria_weights

    def normalize_decision_matrix(self, decision_matrix):
        """
        Normalize the decision matrix using vector normalization

        :param decision_matrix: DataFrame with routes as rows and criteria as columns
        :return: Normalized decision matrix
        """
        matrix = decision_matrix.values

        normalized_matrix = matrix / np.sqrt(np.sum(matrix**2, axis=0))

        return pd.DataFrame(normalized_matrix,
                            columns=decision_matrix.columns,
                            index=decision_matrix.index)

    def weight_normalized_matrix(self, normalized_matrix):
        """
        Apply weights to the normalized decision matrix

        :param normalized_matrix: Normalized decision matrix
        :return: Weighted normalized matrix
        """
        weights = [self.criteria_weights[col] for col in normalized_matrix.columns]

        weighted_matrix = normalized_matrix * weights

        return weighted_matrix

    def determine_ideal_solutions(self, weighted_matrix, benefit_criteria, cost_criteria):
        """
        Determine positive and negative ideal solutions

        :param weighted_matrix: Weighted normalized matrix
        :param benefit_criteria: List of criteria where higher values are better
        :param cost_criteria: List of criteria where lower values are better
        :return: Positive and negative ideal solutions
        """
        pis = []
        nis = []

        for col in weighted_matrix.columns:
            col_values = weighted_matrix[col]

            if col in benefit_criteria:
                pis.append(col_values.max())
                nis.append(col_values.min())
            elif col in cost_criteria:
                pis.append(col_values.min())
                nis.append(col_values.max())

        return pis, nis

    def calculate_distances(self, weighted_matrix, pis, nis):
        """
        Calculate distances from each route to positive and negative ideal solutions

        :param weighted_matrix: Weighted normalized matrix
        :param pis: Positive Ideal Solution
        :param nis: Negative Ideal Solution
        :return: Distances to PIS and NIS for each route
        """
        # Calculate Euclidean distances
        distance_to_pis = np.sqrt(np.sum((weighted_matrix.values - pis)**2, axis=1))
        distance_to_nis = np.sqrt(np.sum((weighted_matrix.values - nis)**2, axis=1))

        return distance_to_pis, distance_to_nis

    def calculate_closeness_coefficient(self, distance_to_pis, distance_to_nis):
        """
        Calculate closeness coefficient to rank routes

        :param distance_to_pis: Distances to Positive Ideal Solution
        :param distance_to_nis: Distances to Negative Ideal Solution
        :return: Closeness coefficients and rankings
        """
        closeness_coefficients = distance_to_nis / (distance_to_pis + distance_to_nis)
        rankings = np.argsort(closeness_coefficients)[::-1]

        return closeness_coefficients, rankings

    def optimize_waste_routes(self, decision_matrix, benefit_criteria, cost_criteria):
        """
        Main method to optimize waste management routes

        :param decision_matrix: DataFrame with routes as rows and criteria as columns
        :param benefit_criteria: List of criteria where higher values are better
        :param cost_criteria: List of criteria where lower values are better
        :return: Optimized route rankings and details
        """
        normalized_matrix = self.normalize_decision_matrix(decision_matrix)

        weighted_matrix = self.weight_normalized_matrix(normalized_matrix)

        pis, nis = self.determine_ideal_solutions(weighted_matrix,
                                                  benefit_criteria,
                                                  cost_criteria)

        distance_to_pis, distance_to_nis = self.calculate_distances(weighted_matrix, pis, nis)

        closeness_coefficients, rankings = self.calculate_closeness_coefficient(
            distance_to_pis, distance_to_nis
        )

        results = pd.DataFrame({
            'Route': decision_matrix.index,
            'Closeness Coefficient': closeness_coefficients,
            'Ranking': rankings + 1
        }).sort_values('Closeness Coefficient', ascending=False)

        return results
    

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["https://swach.vercel.app", "http://localhost:3000"], supports_credentials=True)

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("No API key found. Please set GOOGLE_API_KEY environment variable.")

genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-pro')

def get_route(sector_data, collection_efficiency, mileage, petrol_left):
    """
    Optimize waste management routes based on input parameters
    
    :param sector_data: Dictionary containing sector-specific data from Gemini AI
    :param collection_efficiency: Collection efficiency percentage from frontend
    :param mileage: Vehicle mileage from frontend
    :param petrol_left: Remaining petrol from frontend
    :return: Optimized route details as JSON
    """
    # Extract landfill data from sector_data
    landfills = sector_data.get('coordinates', {}).get('landfills', [])
    
    # Prepare route data dynamically based on landfills
    route_data = pd.DataFrame(columns=[
        'Distance (km)', 
        'Fuel Consumption (L)', 
        'Collection Efficiency (%)', 
        'Road Condition Score'
    ])
    
    for i, landfill in enumerate(landfills, start=1):

        landfill_name = landfill.get('name', 'Unnamed Landfill')

        # Parse distance, converting to float and handling potential string inputs
        try:
            distance = float(landfill.get('distance to landfill from sector', '20').replace(' km', ''))
        except (ValueError, TypeError):
            distance = 20.0  # Default distance
        
        # Calculate fuel consumption based on distance and mileage
        fuel_consumption = distance / float(mileage) if float(mileage) > 0 else distance / 10
        
        # Use road condition from landfill data or default
        try:
            road_condition = float(sector_data.get('condition of roads to landfills', '7').split('/')[0])
        except (ValueError, TypeError):
            road_condition = 7.0
        
        route_data.loc[f'Route {i} - {landfill_name}'] = [
            distance,
            fuel_consumption,
            float(collection_efficiency),
            road_condition
        ]
    
    # If no routes generated, create default routes
    if route_data.empty:
        route_data = pd.DataFrame({
            'Distance (km)': [15.0, 20.0, 12.0, 18.0],
            'Fuel Consumption (L)': [45.0, 60.0, 40.0, 55.0],
            'Collection Efficiency (%)': [float(collection_efficiency)] * 4,
            'Road Condition Score': [7.0, 6.0, 8.0, 5.0]
        }, index=['Route A', 'Route B', 'Route C', 'Route D'])
    
    # Determine criteria weights dynamically
    # Adjust weights based on available petrol and other factors
    try:
        fuel_weight = float(petrol_left) / 100 if petrol_left else 0.25
    except (ValueError, TypeError):
        fuel_weight = 0.25
    
    criteria_weights = {
        'Distance (km)': 0.25,
        'Fuel Consumption (L)': fuel_weight,
        'Collection Efficiency (%)': collection_efficiency / 100,
        'Road Condition Score': 0.25
    }
    
    # Create router and optimize routes
    router = WasteManagementRouter(criteria_weights)
    
    results = router.optimize_waste_routes(
        route_data,
        benefit_criteria=['Collection Efficiency (%)', 'Road Condition Score'],
        cost_criteria=['Distance (km)', 'Fuel Consumption (L)']
    )
    
    print("Waste Management Route Optimization Results:")
    print(results)
    return results.to_json(orient='records')

# Update the solid waste data route to use the new get_route function
@app.route('/api/solid-waste-data', methods=['POST'])
def get_solid_waste_data():
    try:
        data = request.json

        if not data:
            return jsonify({"error": "No data provided"}), 400

        sector = data.get('sector')
        collection_efficiency = data.get('collection_efficiency', 85)
        mileage = data.get('mileage', 10)  # Default mileage if not provided
        petrol_left = data.get('petrol_left', 50)  # Default petrol left if not provided

        if not sector:
            return jsonify({"error": "Sector is required"}), 400

        prompt = f"""
        Generate detailed solid waste data for {sector} of chandigarh, India. Include the following information:
        Make sure to give precise lanitude and longitude coordinates for the state and landfills it is mandatory.
        Return the response in the following JSON format:
        {{
            "sector": "{sector}",
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
            "condition of roads to landfills": "Road condition score",
            "coordinates": {{
                "state_lat": "Latitude of the state",
                "state_lon": "Longitude of the state",
                "landfills": [
                    {{
                        "lat": "Latitude of landfill 1",
                        "lon": "Longitude of landfill 1",
                        "name": "Name of landfill 1",
                        "distance to landfill from {sector}": "Distance to landfill in km"
                    }},
                    {{
                        "lat": "Latitude of landfill 2",
                        "lon": "Longitude of landfill 2",
                        "name": "Name of landfill 2",
                        "distance to landfill from {sector}": "Distance to landfill in km"
                    }},
                    ...give landfills upto 4
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
            
            route_details = get_route(
                enriched_data, 
                collection_efficiency, 
                mileage, 
                petrol_left
            )
            
            return jsonify({
                "data": enriched_data,
                "route_details": json.loads(route_details)
            }), 200
        
        except json.JSONDecodeError as parse_error:
            return jsonify({
                "error": "Failed to parse AI response",
                "details": str(parse_error),
                "raw_response": generated_text,
            }), 500

    except genai.types.generation_types.GenerationException as e:
        return jsonify({"error": "AI model error", "details": str(e)}), 500
    
    except Exception as e:
        return jsonify({
            "error": "Server error",
            "details": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))
