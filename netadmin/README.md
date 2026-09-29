# NetAdmin

Administration visuelle de routeurs et switchs (Cisco, HP/Aruba, Juniper, Arista, MikroTik, Fortinet…) **via SSH ou console série**.
Interface minimaliste, volet de gauche façon OPNsense, schéma réseau généré automatiquement.

## Démarrage

```bash
cd netadmin
cp .env.example .env      # puis change ADMIN_PASSWORD
docker compose up -d --build
```

Ouvre <http://localhost:8080> (identifiants : `ADMIN_USER` / `ADMIN_PASSWORD` du `.env`).
Les données (base SQLite, clé de chiffrement) sont dans le volume `netadmin_data`.

Pour essayer sans matériel : *Tableau de bord → Charger un réseau d'exemple* (appareils Cisco simulés).

## Fonctionnalités

| Section | Ce que ça fait |
|---|---|
| **Topologie** | Schéma auto (dagre) : internet/routeurs en haut, switchs au milieu, postes en bas. Glisser pour déplacer, tirer d'un nœud à l'autre pour créer un lien, clic pour éditer. |
| **Découverte** | LLDP/CDP sur tous les appareils → liens et voisins ajoutés au schéma ; option pour ajouter les machines vues dans les tables MAC/ARP. |
| **Appareils** | Ajouter / modifier / supprimer / tester la connexion. Mots de passe chiffrés (Fernet). |
| **Machines vides** | Postes utilisateurs sans rien derrière : simples points sur le schéma (IP/MAC/notes), liables à un port. |
| **Interfaces, VLANs, Routage, Système** | Lecture (tables parsées via ntc-templates, texte brut sinon) + modification. Chaque changement montre **les commandes exactes** avant envoi, modifiables, avec « write memory » optionnel. |
| **Voisins, MAC / ARP** | Relevés en direct avec cache. |
| **Config & sauvegardes** | Running-config, sauvegardes horodatées, diff entre deux sauvegardes. |
| **Console CLI** | Commandes libres (mode exec ou mode configuration). |
| **Journal** | Historique des changements envoyés. |
| **Réglages** | Nom de l'app, couleur d'accent, thème, export/import JSON du schéma. |

Marques : Cisco IOS/IOS-XE/NX-OS, HP/Aruba ProCurve, Aruba AOS-CX, HP/H3C Comware, Juniper Junos, Arista EOS,
MikroTik RouterOS, Fortinet, SSH générique. Les générateurs de commandes de config sont dans `backend/app/profiles.py`
(ajouter une marque = ajouter une entrée `PROFILES` + une branche dans `build_config`).

## Console série (câble USB ↔ RJ45)

1. Dans `docker-compose.yml`, décommente `devices:` (`/dev/ttyUSB0`) et `group_add: dialout`.
2. Dans l'appareil : *Connexion → Console (série)*, port `/dev/ttyUSB0`, débit (souvent 9600).

Le pilote série est intégré (pyserial) : il gère login, `enable`, pagination et prompt pour toutes les marques.
Un port série ne supporte qu'une session à la fois : les opérations sur un même appareil sont sérialisées.

## Sécurité

- Change `ADMIN_PASSWORD`. Ne l'expose pas sur internet sans reverse proxy HTTPS.
- Les mots de passe des appareils sont chiffrés avec `SECRET_KEY` (ou une clé auto-générée dans le volume). Perdre cette clé = ressaisir les mots de passe.
- Le conteneur doit pouvoir joindre les IP de management de tes appareils (réseau Docker par défaut = OK pour un LAN ; sinon `network_mode: host`).

## Développement

```bash
cd backend && pip install -r requirements.txt pytest httpx && DATA_DIR=/tmp/na ADMIN_PASSWORD=pw uvicorn app.main:app --reload
cd frontend && npm install && npm run dev      # proxy /api -> :8000
cd backend && python -m pytest tests
```
