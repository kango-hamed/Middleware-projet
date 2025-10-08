# CinéReserve – Mini-application de réservation de cinéma

Application pédagogique illustrant l'utilisation des **middlewares** dans Express.js :
- Authentification JWT
- Logging
- Sécurité (Helmet, CORS, Rate Limiting)
- Validation des données
- Gestion centralisée des erreurs

## 🚀 Installation

1. Cloner le dépôt
2. `npm install`
3. Copier `.env.example` vers `.env` et personnaliser les variables
4. `npm start` (ou `npm run dev` avec nodemon)

## 🌐 Endpoints

| Méthode | Route               | Description                     | Auth |
|--------|---------------------|----------------------------------|------|
| GET    | `/films`            | Liste des films (avec pagination)| Non  |
| POST   | `/login`            | Authentification                 | Non  |
| POST   | `/reservations`     | Réserver des places              | Oui  |

### Exemples Postman

#### 1. Se connecter
```http
POST /login
Content-Type: application/json

{ "username": "admin", "password": "1234" }