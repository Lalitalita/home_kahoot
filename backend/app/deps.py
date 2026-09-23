from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Admin, AdminRole
from app.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_admin(
    token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> Admin:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Non authentifié",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if token is None:
        raise credentials_exception

    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise credentials_exception

    admin_id = payload.get("sub")
    admin = db.get(Admin, admin_id)
    if admin is None:
        raise credentials_exception
    return admin


def require_permission(section: str):
    """Dependency factory: admin must be the owner, or have `section` in
    their granted permissions."""

    def dependency(admin: Admin = Depends(get_current_admin)) -> Admin:
        if not admin.has_permission(section):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tu n'as pas accès à cette section.",
            )
        return admin

    return dependency


def require_owner(admin: Admin = Depends(get_current_admin)) -> Admin:
    if admin.role != AdminRole.owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Réservé au compte principal.",
        )
    return admin
