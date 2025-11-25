from pymongo import MongoClient

client = MongoClient('mongodb+srv://giuliagiacomodonato1_db_user:c8Xn0eSPeCydGJGN@cluster0.9cf6z0w.mongodb.net/?appName=Cluster0')

# Get rated movies
db_opiniones = client['opiniones']
opinions = list(db_opiniones['opinions'].find({'userId': 'user_cl954t3ef', 'type': 'rating'}))
print(f'Found {len(opinions)} ratings')

rated_ids = [op['movieId'] for op in opinions]
print(f'Sample rated IDs: {rated_ids[:5]}')

# Get Star Wars movie
db_peliculas = client['peliculas']
sample_movie = db_peliculas['movies'].find_one({'title': 'Star Wars: Episode IV - A New Hope'})
star_wars_id = str(sample_movie['_id'])
print(f'\nStar Wars _id: {star_wars_id}')
print(f'Is in rated list? {star_wars_id in rated_ids}')

# Check all rated movies
print(f'\nAll rated movie IDs ({len(rated_ids)}):')
for rid in rated_ids[:10]:
    print(f'  - {rid}')
