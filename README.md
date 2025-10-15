# 💼 Finance Site - Projet Data

Ce projet contient un **backend Flask** et un **frontend React (Vite)** pour un site web financier.  

---

## ⚙️ Installation et lancement

### 1️⃣ Backend Flask

| Étape | Commande | Description |
|-------|-----------|-------------|
| Aller dans le dossier backend | `cd backend` | Se placer dans le dossier backend Flask |
| Activer l’environnement virtuel | `.env\Scripts\Activate.ps1` | Active le venv Python |
| Installer les dépendances | `pip install -r requirements.txt` | Installe Flask, Flask-CORS, etc. |
| Lancer le backend | `python run.py` | Démarre le serveur Flask sur `http://127.0.0.1:5000` |
| Désactiver le venv | `deactivate` | Ferme l’environnement virtuel Python |

---

### 2️⃣ Frontend React

| Étape | Commande | Description |
|-------|-----------|-------------|
| Aller dans le dossier frontend | `cd frontend` | Se placer dans le dossier frontend React |
| Installer les dépendances | `npm install` | Installe React, Vite et les packages nécessaires |
| Lancer le frontend | `npm run dev` | Démarre le serveur React sur `http://localhost:5173` |

---

## 🧭 Git - Versionner et partager le projet

| Étape | Commande | Description |
|-------|-----------|-------------|
| Initialiser Git | `git init` | Crée un dépôt Git local |
| Ajouter tous les fichiers | `git add .` | Prépare tous les fichiers pour le commit |
| Commit initial | `git commit -m "Initial commit: backend Flask + frontend React"` | Sauvegarde les fichiers dans Git |
| Ajouter dépôt distant | `git remote add origin <URL_GITHUB>` | Lie le dépôt local à GitHub |
| Pousser vers GitHub | `git branch -M main` <br> `git push -u origin main` | Envoie le projet sur GitHub |
| Commandes Git utiles ensuite | `git status` <br> `git add <fichier>` <br> `git commit -m "msg"` <br> `git push` <br> `git pull` | Suivre et synchroniser les modifications avec GitHub |

---

## 💡 Astuces

- Ouvrir **deux terminaux VS Code** : un pour le backend, un pour le frontend.  
- Toujours activer le venv pour le backend avant de lancer Flask.  
- Laisser le frontend tourner avec `npm run dev` pour voir les changements en direct.  
- Le backend est accessible sur `http://127.0.0.1:5000`, le frontend sur `http://localhost:5173`.  

---

## 👥 Cloner le projet pour un collaborateur

```bash
git clone https://github.com/tonusername/finance-site.git
cd finance-site
```

---

## 🔀 Fusionner la branche de développement dans `main`

Quand le développement sur la branche parallèle (ex : `dev-collab`) est terminé et validé, voici la procédure pour fusionner les changements dans la branche principale :

```bash
# Se placer sur la branche principale
git checkout main

# Mettre à jour la branche principale avec la version distante
git pull origin main

# Fusionner la branche de développement dans main
git merge dev-collab

# Pousser la fusion sur le dépôt distant
git push origin main
```

---

## 🧾 Auteur

Projet réalisé dans le cadre du **Master 2 MIAGE – Projet Data**  
Développé avec **Flask (Python)** et **React (Vite)**.  
