"""Sends the personal PDF recap by email once a quiz session finishes.

Uses plain smtplib (blocking) — callers should run send_recap_email in a
thread (e.g. asyncio.to_thread) rather than await it directly. Silently
does nothing if SMTP isn't configured, so the app works fine without it;
see .env.example for the OVH settings.
"""

import logging
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

from app.config import get_settings

logger = logging.getLogger(__name__)


def _html_body(nickname: str) -> str:
    return (
        f"Hello {nickname}, <br>"
        "Merci d'avoir participé au quiz de mon anniversaire ! <br>"
        "Tu pourras retrouver en pièce jointe un pdf avec tes réponses et les réponses justes <br>"
        "Merci, <br>"
        "Lana"
    )


def _text_body(nickname: str) -> str:
    return (
        f"Hello {nickname},\n"
        "Merci d'avoir participé au quiz de mon anniversaire !\n"
        "Tu pourras retrouver en pièce jointe un pdf avec tes réponses et les réponses justes\n"
        "Merci,\n"
        "Lana"
    )


def _send(to_email: str, subject: str, text_body: str, html_body: str, pdf_bytes: bytes, filename: str) -> bool:
    settings = get_settings()
    if not settings.smtp_configured:
        logger.info("SMTP non configuré : email non envoyé à %s", to_email)
        return False

    message = MIMEMultipart("mixed")
    message["Subject"] = subject
    message["From"] = formataddr((settings.smtp_from_name, settings.smtp_from_email))
    message["To"] = to_email

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(text_body, "plain", "utf-8"))
    alt.attach(MIMEText(html_body, "html", "utf-8"))
    message.attach(alt)

    attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
    attachment.add_header("Content-Disposition", "attachment", filename=filename)
    message.attach(attachment)

    try:
        if settings.smtp_use_ssl:
            server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15)
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
            server.starttls()
        with server:
            server.login(settings.smtp_username, settings.smtp_password)
            server.sendmail(settings.smtp_from_email, [to_email], message.as_string())
        return True
    except Exception:
        logger.exception("Échec de l'envoi de l'email à %s", to_email)
        return False


def send_recap_email(to_email: str, nickname: str, pdf_bytes: bytes, party_title: str) -> bool:
    return _send(
        to_email,
        subject=f"Ton récap du quiz — {party_title}",
        text_body=_text_body(nickname),
        html_body=_html_body(nickname),
        pdf_bytes=pdf_bytes,
        filename=f"recap-{nickname}.pdf",
    )


def _admin_html_body(session_label: str, players_count: int) -> str:
    return (
        f"Coucou, <br>"
        f"Voici le récap complet de la session « {session_label} » : "
        f"les réponses de chacun des {players_count} joueurs, le classement et le podium. <br>"
        "À bientôt !"
    )


def _admin_text_body(session_label: str, players_count: int) -> str:
    return (
        f"Coucou,\n"
        f"Voici le récap complet de la session « {session_label} » : "
        f"les réponses de chacun des {players_count} joueurs, le classement et le podium.\n"
        "À bientôt !"
    )


def send_session_recap_email(
    to_email: str, session_label: str, players_count: int, pdf_bytes: bytes, party_title: str
) -> bool:
    """The organizer's own copy: every player, every answer, the podium —
    sent once a session ends, separate from each player's personal recap."""
    return _send(
        to_email,
        subject=f"Récap complet — {party_title} ({session_label})",
        text_body=_admin_text_body(session_label, players_count),
        html_body=_admin_html_body(session_label, players_count),
        pdf_bytes=pdf_bytes,
        filename=f"recap-complet-{session_label}.pdf",
    )
