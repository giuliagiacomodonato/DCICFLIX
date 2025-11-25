FROM node:18-alpine

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar código fuente
COPY src/ ./src/

# Exponer puerto
EXPOSE 3003

# Comando de inicio
CMD ["npm", "start"]
