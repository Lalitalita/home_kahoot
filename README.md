# 🎉 Home Kahoot — App d'organisation d'anniversaire

Application web complète pour organiser un anniversaire : gestion des
invités, régimes alimentaires, propositions de questions, et un quiz
type Kahoot en temps réel jouable le soir de la fête, avec un mur de
messages en bonus.

- **Frontend** : React (Vite) + Tailwind CSS
- **Backend** : FastAPI (Python) + WebSockets
- **Base de données** : SQLite (fichier unique, persisté dans un volume Docker)
- **Déploiement** : Docker Compose (2 conteneurs : `backend`, `frontend`)

## Fonctionnalités

**Avant la soirée**
- Liste des invités consultable par tous (nom, pseudo, photo, petite description)
- Fiche perso par invité (allergies, régime, intolérances, commentaire), éditable via un lien/code personnel
- Tableau récapitulatif admin des régimes alimentaires
- Propositions de questions de quiz par les invités (texte, 4 réponses, image optionnelle)
- Modération des questions par l'admin (accepter / modifier / supprimer)
- Mur de messages (texte + photos), visible avant et après la soirée
- Export CSV : invités, régimes alimentaires, questions

**Pendant la soirée**
- Bouton "Activer le mode soirée" : ferme les pages de préparation, bascule tout le monde vers le quiz
- Écran TV (`/soiree/ecran`) : question, réponses, timer, classement, animation finale
- Téléphone-manette (`/soiree/manette`) : choix du pseudo, boutons colorés type Kahoot
- Réponses envoyées en temps réel via WebSocket
- Score basé sur la bonne réponse **et** la rapidité
- Classement en direct + podium top 3 animé en fin de partie

**Sécurité admin**
- Authentification par mot de passe + **double authentification (TOTP/2FA)** obligatoire dès la première connexion (compatible Google Authenticator, Aegis, Authy, etc.)
- Toutes les routes d'administration et de modération sont protégées par un jeton (JWT)

## Architecture

```
home_kahoot/
├── backend/                 # API FastAPI
│   ├── app/
│   │   ├── main.py          # point d'entrée, montage des routes
│   │   ├── config.py        # configuration via variables d'environnement
│   │   ├── database.py      # connexion SQLite / SQLAlchemy
│   │   ├── models.py        # tables (invités, questions, messages...)
│   │   ├── schemas.py       # schémas Pydantic (entrées/sorties API)
│   │   ├── security.py      # hachage mot de passe, JWT, TOTP (2FA)
│   │   ├── deps.py          # dépendances FastAPI (auth admin)
│   │   ├── uploads.py       # gestion des photos envoyées
│   │   ├── ws_manager.py    # registre des connexions WebSocket
│   │   ├── quiz_engine.py   # moteur du quiz temps réel (machine à états)
│   │   └── routers/         # endpoints REST + WebSocket
│   └── Dockerfile
├── frontend/                # application React
│   ├── src/
│   │   ├── pages/           # pages publiques, admin, et soirée
│   │   ├── components/      # composants partagés (nav, layout, thème quiz)
│   │   └── context/         # état global (auth admin, mode soirée)
│   ├── nginx.conf           # reverse-proxy vers l'API + fichiers statiques
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Installation rapide (Docker Compose)

### Prérequis

- [Docker](https://docs.docker.com/get-docker/) et le plugin Docker Compose installés sur votre serveur.

### Étapes

1. **Cloner le dépôt sur votre serveur**

   ```bash
   git clone <url-du-depot> home_kahoot
   cd home_kahoot
   ```

2. **Configurer les variables d'environnement**

   ```bash
   cp .env.example .env
   ```

   Ouvrez `.env` et modifiez au minimum :
   - `SECRET_KEY` : une valeur aléatoire longue (ex : `openssl rand -hex 32`)
   - `ADMIN_USERNAME` / `ADMIN_BOOTSTRAP_PASSWORD` : identifiants du premier
     compte admin. **Important** : ce mot de passe n'est utilisé que pour
     créer le compte au tout premier démarrage — si vous le changez plus
     tard, un compte admin qui existe déjà ne sera pas mis à jour (voir
     [Mot de passe admin oublié](#mot-de-passe-admin-oublié--connexion-impossible)
     ci-dessous). Si votre mot de passe contient des caractères spéciaux
     (`$`, `#`, espaces...), entourez-le de guillemets dans `.env` (ex :
     `ADMIN_BOOTSTRAP_PASSWORD="Mon Mot de Passe #1"`) et doublez tout `$`
     en `$$`, sinon Docker Compose risque de le tronquer ou de le modifier.

3. **Démarrer l'application**

   ```bash
   docker compose up -d --build
   ```

4. **Ouvrir l'application**

   Rendez-vous sur `http://<adresse-de-votre-serveur>:8080` (le port se
   change via `HTTP_PORT` dans `.env`).

5. **Première connexion admin**

   Allez sur `/admin/connexion`, connectez-vous avec les identifiants
   définis dans `.env`. Comme c'est la première connexion, l'application
   vous présente un **QR code** à scanner avec une application
   d'authentification (Google Authenticator, Authy, Aegis...) pour
   activer la 2FA — obligatoire avant d'accéder au tableau de bord.

### Mot de passe admin oublié / connexion impossible

Le mot de passe défini par `ADMIN_BOOTSTRAP_PASSWORD` ne sert **qu'à la
toute première création du compte**. Si vous avez déjà démarré
l'application une première fois (même brièvement, même avec le mot de
passe par défaut), le compte existe déjà en base : modifier `.env`
ensuite et relancer `docker compose up` n'a plus aucun effet, d'où
l'impression que "le bon mot de passe ne marche pas".

Pour réinitialiser le mot de passe admin (et la 2FA) sans perdre vos
invités, questions, messages ou budget, exécutez, conteneurs démarrés :

```bash
docker compose exec backend python -m app.manage reset-admin --password "NouveauMotDePasseSolide"
```

Reconnectez-vous ensuite sur `/admin/connexion` avec ce nouveau mot de
passe : comme la 2FA a été réinitialisée, l'application vous présentera
à nouveau un QR code à scanner.

### Arrêter / mettre à jour

```bash
docker compose down          # arrêter
docker compose up -d --build # relancer après une mise à jour du code
```

Les données (base SQLite + photos envoyées) sont conservées dans le
volume Docker nommé `party_data`, même après un `docker compose down`.
Pour tout repartir de zéro : `docker compose down -v`.

## Utilisation le jour J

1. Dans **Admin → Questions**, validez les questions proposées par les
   invités (ou ajoutez-en directement).
2. Dans **Admin → Mode soirée**, cliquez sur **Activer le mode soirée**.
   Les pages de préparation se ferment automatiquement pour tout le monde.
3. Affichez `https://votre-domaine/soiree/ecran` sur la TV / le
   vidéoprojecteur.
4. Partagez `https://votre-domaine/soiree` aux invités : ils choisissent
   un pseudo et leur téléphone devient une manette.
5. Depuis **Admin → Mode soirée**, utilisez **Démarrer le quiz** puis
   **Suivant** pour faire avancer les questions, la correction et le
   classement. Le temps de réponse et le classement final s'affichent
   automatiquement sur l'écran TV.

## Développement local (sans Docker)

**Backend**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=sqlite:///./dev.db
export UPLOAD_DIR=./uploads
uvicorn app.main:app --reload
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Le serveur de dev Vite (`http://localhost:5173`) proxifie automatiquement
`/api`, `/uploads` et `/ws` vers `http://localhost:8000` (voir
`vite.config.js`).

## Variables d'environnement (backend)

| Variable | Description | Défaut |
|---|---|---|
| `SECRET_KEY` | Clé de signature des jetons JWT | *(à définir)* |
| `ADMIN_USERNAME` | Identifiant du compte admin créé au démarrage | `admin` |
| `ADMIN_BOOTSTRAP_PASSWORD` | Mot de passe initial de l'admin | `changeme123` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Durée de session admin (minutes) | `720` |
| `DATABASE_URL` | URL de connexion SQLAlchemy | `sqlite:////data/app.db` |
| `UPLOAD_DIR` | Dossier de stockage des photos | `/data/uploads` |
| `CORS_ORIGINS` | Origines autorisées (`*` ou liste séparée par des virgules) | `*` |

## Notes techniques

- Chaque invité dispose d'un **code d'accès** unique (généré à la
  création) qui lui sert de lien personnel pour remplir sa fiche
  (régime, allergies) et suivre ses questions proposées — pas besoin de
  compte ni de mot de passe côté invité.
- Le quiz est un **moteur à états en mémoire** (`quiz_engine.py`) :
  lobby → question → correction → classement → (question suivante ou
  fin). Chaque réponse et chaque score sont aussi journalisés en base
  pour permettre l'export après la soirée.
- Le calcul des points suit la logique Kahoot : plus la réponse est
  rapide, plus elle rapporte de points (entre `MIN_POINTS_FOR_CORRECT_ANSWER`
  et `MAX_POINTS_PER_QUESTION`), 0 point si la réponse est fausse ou hors
  délai.
