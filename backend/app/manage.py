"""One-off admin maintenance commands, run inside the backend container.

The admin account is only created from ADMIN_BOOTSTRAP_PASSWORD the very
first time the app starts (when no admin row exists yet). Changing that
variable in .env afterwards has no effect on an already-running
deployment — use this instead:

    docker compose exec backend python -m app.manage reset-admin --password "NouveauMotDePasse"

This resets the password and turns 2FA back off so it can be set up
again from a clean state on the next login. It never touches guests,
questions, messages or budget data.
"""

import argparse

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.models import Admin, AdminRole
from app.security import hash_password


def reset_admin(username: str, password: str) -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        admin = db.query(Admin).filter(Admin.username == username).first()
        if admin is None:
            # Only reached when there's no admin at all yet, so this is
            # necessarily the owner account being recovered/bootstrapped.
            admin = Admin(
                username=username,
                password_hash=hash_password(password),
                role=AdminRole.owner,
            )
            db.add(admin)
            db.commit()
            print(f"Compte admin '{username}' créé avec le nouveau mot de passe.")
            return

        admin.password_hash = hash_password(password)
        admin.totp_secret = None
        admin.totp_enabled = False
        db.commit()
        print(
            f"Mot de passe de '{username}' réinitialisé. "
            "La double authentification a été désactivée : elle sera "
            "reconfigurée (nouveau QR code) à la prochaine connexion."
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Outils de maintenance admin")
    subparsers = parser.add_subparsers(dest="command", required=True)

    reset_parser = subparsers.add_parser(
        "reset-admin", help="Réinitialise le mot de passe admin (et désactive la 2FA)"
    )
    reset_parser.add_argument(
        "--username",
        default=None,
        help="Identifiant admin à réinitialiser (défaut : ADMIN_USERNAME de l'environnement)",
    )
    reset_parser.add_argument("--password", required=True, help="Nouveau mot de passe")

    args = parser.parse_args()

    if args.command == "reset-admin":
        settings = get_settings()
        username = args.username or settings.admin_username
        reset_admin(username, args.password)


if __name__ == "__main__":
    main()
