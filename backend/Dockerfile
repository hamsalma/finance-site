FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render écoute sur $PORT
ENV PORT=5000
EXPOSE 5000

# gunicorn en prod
CMD gunicorn run:app --bind 0.0.0.0:$PORT
