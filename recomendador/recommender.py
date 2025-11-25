"""
Sistema de Recomendación Híbrido para DCICFLIX
Combina similitud de contenido con interacciones de usuario (clicks y ratings)
"""

import pandas as pd
import numpy as np
from pymongo import MongoClient
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import os

# Configuración de MongoDB
MONGODB_URL = os.getenv('MONGODB_URL', 'mongodb+srv://giuliagiacomodonato1_db_user:c8Xn0eSPeCydGJGN@cluster0.9cf6z0w.mongodb.net/?appName=Cluster0')
DB_NAME = os.getenv('DB_NAME', 'peliculas')
OPINIONES_DB = os.getenv('OPINIONES_DB', 'opiniones')


class MovieRecommender:
    def __init__(self):
        """Inicializa el recomendador conectándose a MongoDB"""
        self.client = MongoClient(MONGODB_URL)
        self.movies_db = self.client[DB_NAME]
        self.movies_collection = self.movies_db['movies']
        self.opiniones_db = self.client[OPINIONES_DB]
        self.opinions_collection = self.opiniones_db['opinions']
        
        self.movies_df = None
        self.cosine_sim = None
        self.indices = None
        self.titles = None
        
    def load_movies(self):
        """Carga las películas desde MongoDB y prepara el DataFrame"""
        print("Cargando películas desde MongoDB...")
        movies = list(self.movies_collection.find())
        
        if not movies:
            raise ValueError("No se encontraron películas en la base de datos")
        
        # Convertir a DataFrame
        self.movies_df = pd.DataFrame(movies)
        
        # Limpiar y preparar datos
        self._prepare_data()
        
        # Calcular similitud de contenido
        self._calculate_content_similarity()
        
        # Calcular métricas de interacción
        self._calculate_interaction_metrics()
        
        print(f"Películas cargadas: {len(self.movies_df)}")
        
    def _prepare_data(self):
        """Prepara los datos para el análisis"""
        # Convertir _id a string
        self.movies_df['movie_id'] = self.movies_df['_id'].astype(str)
        
        # Preparar géneros (convertir lista a string)
        self.movies_df['genres_str'] = self.movies_df['genres'].apply(
            lambda x: ' '.join(x) if isinstance(x, list) else ''
        )
        
        # Preparar directores
        self.movies_df['directors_str'] = self.movies_df['directors'].apply(
            lambda x: ' '.join([d.lower().replace(' ', '') for d in x]) if isinstance(x, list) else ''
        )
        
        # Preparar actores (top 5)
        self.movies_df['cast_str'] = self.movies_df['cast'].apply(
            lambda x: ' '.join([c.lower().replace(' ', '') for c in x[:5]]) if isinstance(x, list) else ''
        )
        
        # Crear "sopa" de características
        self.movies_df['soup'] = (
            self.movies_df['title'].fillna('') + ' ' +
            self.movies_df['genres_str'].fillna('') + ' ' +
            self.movies_df['directors_str'].fillna('') + ' ' +
            self.movies_df['cast_str'].fillna('')
        )
        
        # Crear índice de títulos
        self.indices = pd.Series(self.movies_df.index, index=self.movies_df['title'])
        self.titles = self.movies_df['title']
        
    def _calculate_content_similarity(self):
        """Calcula la matriz de similitud por coseno basada en contenido"""
        print("Calculando similitud de contenido...")
        
        count = CountVectorizer(
            analyzer='word',
            ngram_range=(1, 2),
            min_df=0.0,
            stop_words='english'
        )
        
        count_matrix = count.fit_transform(self.movies_df['soup'])
        self.cosine_sim = cosine_similarity(count_matrix, count_matrix)
        
        print("Matriz de similitud calculada.")
        
    def _calculate_interaction_metrics(self):
        """Calcula métricas basadas en interacciones de usuarios (clicks y ratings)"""
        print("Calculando métricas de interacción...")
        
        # Obtener todas las opiniones
        opinions = list(self.opinions_collection.find())
        
        if not opinions:
            print("No hay opiniones registradas. Usando solo ratings de IMDb.")
            self.movies_df['click_count'] = 0
            self.movies_df['rating_sum'] = 0
            self.movies_df['rating_count'] = 0
            self.movies_df['avg_user_rating'] = 0
            self.movies_df['interaction_score'] = 0
            return
        
        opinions_df = pd.DataFrame(opinions)
        
        # Contar clicks por película (type == 'click')
        clicks = opinions_df[opinions_df['type'] == 'click'].groupby('movieId').size()
        
        # Calcular ratings por película (type == 'rating' y rating != null)
        ratings = opinions_df[(opinions_df['type'] == 'rating') & (opinions_df['rating'].notna())]
        
        if not ratings.empty:
            rating_stats = ratings.groupby('movieId').agg({
                'rating': ['sum', 'count', 'mean']
            })
            rating_stats.columns = ['rating_sum', 'rating_count', 'avg_user_rating']
        else:
            # Si no hay ratings, crear DataFrame vacío con las columnas necesarias
            rating_stats = pd.DataFrame(columns=['rating_sum', 'rating_count', 'avg_user_rating'])
        
        # Agregar al DataFrame de películas
        self.movies_df['click_count'] = self.movies_df['movie_id'].map(clicks).fillna(0)
        self.movies_df['rating_sum'] = self.movies_df['movie_id'].map(
            rating_stats['rating_sum'] if not rating_stats.empty else {}
        ).fillna(0)
        self.movies_df['rating_count'] = self.movies_df['movie_id'].map(
            rating_stats['rating_count'] if not rating_stats.empty else {}
        ).fillna(0)
        self.movies_df['avg_user_rating'] = self.movies_df['movie_id'].map(
            rating_stats['avg_user_rating'] if not rating_stats.empty else {}
        ).fillna(0)
        
        # Calcular score de interacción combinado
        # Fórmula: (clicks * 0.3) + (rating_sum * 0.7)
        # Los ratings tienen más peso que los clicks
        self.movies_df['interaction_score'] = (
            self.movies_df['click_count'] * 0.3 + 
            self.movies_df['rating_sum'] * 0.7
        )
        
        print(f"Opiniones procesadas: {len(opinions_df)}")
        
    def _calculate_weighted_rating(self, percentile=0.85):
        """Calcula el rating ponderado usando la fórmula de IMDb"""
        # Rating ponderado que combina IMDb rating con user ratings
        
        # Extraer rating de IMDb
        self.movies_df['imdb_rating'] = self.movies_df['imdb'].apply(
            lambda x: x.get('rating', 0) if isinstance(x, dict) else 0
        )
        
        # Si hay ratings de usuarios, combinarlos con IMDb
        if self.movies_df['rating_count'].sum() > 0:
            # Combinar IMDb rating con user ratings (60% IMDb, 40% usuarios)
            self.movies_df['combined_rating'] = (
                self.movies_df['imdb_rating'] * 0.6 + 
                self.movies_df['avg_user_rating'] * 0.4
            )
        else:
            self.movies_df['combined_rating'] = self.movies_df['imdb_rating']
        
        # Calcular votos totales (IMDb votes + user ratings)
        self.movies_df['imdb_votes'] = self.movies_df['imdb'].apply(
            lambda x: x.get('votes', 0) if isinstance(x, dict) else 0
        )
        self.movies_df['total_votes'] = (
            self.movies_df['imdb_votes'] + 
            self.movies_df['rating_count'] + 
            self.movies_df['click_count']
        )
        
        # Fórmula de rating ponderado (IMDb)
        v = self.movies_df['total_votes']
        m = self.movies_df['total_votes'].quantile(percentile)
        R = self.movies_df['combined_rating']
        C = self.movies_df['combined_rating'].mean()
        
        self.movies_df['weighted_rating'] = (R * v + C * m) / (v + m)
        
    def get_recommendations(self, title, n=10, self_exclude=True, use_interactions=True):
        """
        Obtiene recomendaciones para una película dada
        
        Args:
            title: Título de la película
            n: Número de recomendaciones
            self_exclude: Excluir la película consultada
            use_interactions: Usar métricas de interacción en el scoring
        
        Returns:
            DataFrame con las películas recomendadas
        """
        try:
            idx = self.indices[title]
        except KeyError:
            return f"Película '{title}' no encontrada en la base de datos."
        
        # Obtener scores de similitud
        sim_scores = list(enumerate(self.cosine_sim[idx]))
        sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
        
        if self_exclude:
            sim_scores = sim_scores[1:n*3]  # Obtener más candidatos para filtrar
        else:
            sim_scores = sim_scores[0:n*3]
        
        book_indices = [i[0] for i in sim_scores]
        cosine_similarities = [i[1] for i in sim_scores]
        
        # Crear DataFrame de recomendaciones
        recommended = self.movies_df.iloc[book_indices].copy()
        recommended['cosine_sim'] = cosine_similarities
        
        # Calcular score híbrido
        if use_interactions:
            # Normalizar interaction_score (0-1)
            max_interaction = self.movies_df['interaction_score'].max()
            if max_interaction > 0:
                recommended['interaction_norm'] = recommended['interaction_score'] / max_interaction
            else:
                recommended['interaction_norm'] = 0
            
            # Calcular weighted rating
            self._calculate_weighted_rating()
            recommended['weighted_rating'] = self.movies_df.iloc[book_indices]['weighted_rating'].values
            
            # Score híbrido: 50% similitud + 30% weighted_rating + 20% interacciones
            max_rating = self.movies_df['weighted_rating'].max()
            if max_rating > 0:
                recommended['rating_norm'] = recommended['weighted_rating'] / max_rating
            else:
                recommended['rating_norm'] = 0
                
            recommended['hybrid_score'] = (
                recommended['cosine_sim'] * 0.5 +
                recommended['rating_norm'] * 0.3 +
                recommended['interaction_norm'] * 0.2
            )
        else:
            # Solo usar similitud de contenido
            recommended['hybrid_score'] = recommended['cosine_sim']
        
        # Ordenar por score híbrido
        recommended = recommended.sort_values('hybrid_score', ascending=False)
        
        # Seleccionar columnas relevantes
        columns = [
            'title', 'year', 'genres', 'directors', 'cosine_sim',
            'click_count', 'rating_count', 'avg_user_rating',
            'interaction_score', 'hybrid_score'
        ]
        
        # Filtrar columnas que existan
        available_columns = [col for col in columns if col in recommended.columns]
        
        return recommended[available_columns].head(n)
    
    def get_top_movies(self, genre=None, n=10):
        """
        Obtiene las películas mejor puntuadas (rating ponderado + interacciones)
        
        Args:
            genre: Filtrar por género (opcional)
            n: Número de películas
            
        Returns:
            DataFrame con las mejores películas
        """
        self._calculate_weighted_rating()
        
        df = self.movies_df.copy()
        
        # Filtrar por género si se especifica
        if genre:
            df = df[df['genres_str'].str.contains(genre, case=False, na=False)]
        
        if df.empty:
            return f"No se encontraron películas del género '{genre}'"
        
        # Ordenar por weighted_rating e interaction_score
        df['final_score'] = df['weighted_rating'] * 0.7 + df['interaction_score'] * 0.3
        df = df.sort_values('final_score', ascending=False)
        
        columns = [
            'title', 'year', 'genres', 'combined_rating', 'weighted_rating',
            'click_count', 'rating_count', 'interaction_score', 'final_score'
        ]
        
        available_columns = [col for col in columns if col in df.columns]
        
        return df[available_columns].head(n)
    
    def close(self):
        """Cierra la conexión a MongoDB"""
        self.client.close()


# Función auxiliar para uso directo
def get_movie_recommendations(title, n=10):
    """
    Función helper para obtener recomendaciones rápidamente
    
    Args:
        title: Título de la película
        n: Número de recomendaciones
        
    Returns:
        DataFrame con recomendaciones
    """
    recommender = MovieRecommender()
    recommender.load_movies()
    recommendations = recommender.get_recommendations(title, n=n)
    recommender.close()
    return recommendations


if __name__ == "__main__":
    # Ejemplo de uso
    print("="*60)
    print("SISTEMA DE RECOMENDACIÓN HÍBRIDO PARA DCICFLIX")
    print("="*60)
    
    recommender = MovieRecommender()
    recommender.load_movies()
    
    # Ejemplo 1: Recomendaciones basadas en una película
    print("\n--- Recomendaciones basadas en 'The Godfather' ---")
    recs = recommender.get_recommendations("The Godfather", n=5)
    print(recs)
    
    # Ejemplo 2: Top películas
    print("\n--- Top 10 Películas Generales ---")
    top = recommender.get_top_movies(n=10)
    print(top)
    
    # Ejemplo 3: Top películas de un género
    print("\n--- Top 10 Películas de Drama ---")
    top_drama = recommender.get_top_movies(genre='Drama', n=10)
    print(top_drama)
    
    recommender.close()
