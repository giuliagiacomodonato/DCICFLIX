"""
API REST para el Sistema de Recomendación de DCICFLIX
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from recommender import MovieRecommender
import os

app = Flask(__name__)
CORS(app)

# Instancia global del recomendador
recommender = None

def init_recommender():
    """Inicializa el recomendador con los datos de MongoDB"""
    global recommender
    if recommender is None:
        print("Inicializando recomendador...", flush=True)
        try:
            recommender = MovieRecommender()
            # Limitar a 5000 películas para mejor rendimiento
            recommender.load_movies(limit=5000)
            print("Recomendador listo!", flush=True)
        except Exception as e:
            print(f"Error al inicializar recomendador: {e}", flush=True)
            import traceback
            traceback.print_exc()
            raise

@app.route('/health', methods=['GET'])
def health():
    """Endpoint de salud"""
    return jsonify({"status": "healthy", "service": "recommender"})

@app.route('/recommendations', methods=['GET'])
def get_recommendations_for_user():
    """
    Obtiene recomendaciones personalizadas para un usuario
    Query params:
    - userId: ID del usuario (opcional)
    - n: Número de recomendaciones (default: 10)
    """
    try:
        init_recommender()
        
        user_id = request.args.get('userId', 'default_user')
        n = int(request.args.get('n', 10))
        
        # Obtener las películas mejor puntuadas que incorporan interacciones
        # Excluyendo las que el usuario ya calificó
        recommendations = recommender.get_top_movies(n=n, exclude_user_rated=user_id)
        
        # Convertir DataFrame a lista de diccionarios
        if isinstance(recommendations, str):
            return jsonify({"error": recommendations}), 404
        
        # Obtener los IDs de las películas recomendadas y buscar datos completos
        movie_ids = recommendations['title'].tolist()
        full_movies = []
        
        for title in movie_ids:
            movie = recommender.movies_collection.find_one({'title': title})
            if movie:
                # Convertir ObjectId a string
                movie['_id'] = str(movie['_id'])
                full_movies.append(movie)
        
        return jsonify({
            "userId": user_id,
            "recommendations": full_movies,
            "count": len(full_movies)
        })
        
    except Exception as e:
        print(f"Error en recommendations: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/recommendations/similar/<movie_title>', methods=['GET'])
def get_similar_movies(movie_title):
    """
    Obtiene películas similares a una película dada
    Query params:
    - n: Número de recomendaciones (default: 10)
    """
    try:
        init_recommender()
        
        n = int(request.args.get('n', 10))
        
        recommendations = recommender.get_recommendations(movie_title, n=n)
        
        # Convertir DataFrame a lista de diccionarios
        if isinstance(recommendations, str):
            return jsonify({"error": recommendations}), 404
        
        result = recommendations.to_dict('records')
        
        return jsonify({
            "movie": movie_title,
            "recommendations": result,
            "count": len(result)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/recommendations/genre/<genre>', methods=['GET'])
def get_recommendations_by_genre(genre):
    """
    Obtiene las mejores películas de un género específico
    Query params:
    - n: Número de recomendaciones (default: 10)
    """
    try:
        init_recommender()
        
        n = int(request.args.get('n', 10))
        
        recommendations = recommender.get_top_movies(genre=genre, n=n)
        
        # Convertir DataFrame a lista de diccionarios
        if isinstance(recommendations, str):
            return jsonify({"error": recommendations}), 404
        
        result = recommendations.to_dict('records')
        
        return jsonify({
            "genre": genre,
            "recommendations": result,
            "count": len(result)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/recommendations/refresh', methods=['POST'])
def refresh_recommender():
    """Recarga los datos del recomendador"""
    try:
        global recommender
        if recommender:
            recommender.close()
        recommender = None
        init_recommender()
        return jsonify({"status": "success", "message": "Recomendador actualizado"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 3005))
    print(f"Iniciando API de Recomendaciones en puerto {port}...", flush=True)
    # No pre-inicializar para que el servidor arranque rápido
    # La inicialización se hará en el primer request
    print(f"Servidor Flask listo. El recomendador se inicializará en el primer request.", flush=True)
    app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)
