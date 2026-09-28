"""Sends the rich HTML recap email once a quiz session finishes.

Uses plain smtplib (blocking) — callers should run these in a thread
(e.g. asyncio.to_thread) rather than await them directly. Silently does
nothing if SMTP isn't configured, so the app works fine without it; see
.env.example for the OVH settings.

The HTML body (built in app.email_templates) is the primary content now;
the PDF is attached as a secondary copy, not the main event.
"""

import logging
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

from app.config import get_settings

logger = logging.getLogger(__name__)


def _send(
    to_email: str,
    subject: str,
    text_fallback: str,
    html_body: str,
    pdf_bytes: bytes | None,
    pdf_filename: str,
) -> bool:
    settings = get_settings()
    if not settings.smtp_configured:
        logger.info("SMTP non configuré : email non envoyé à %s", to_email)
        return False

    message = MIMEMultipart("mixed")
    message["Subject"] = subject
    message["From"] = formataddr((settings.smtp_from_name, settings.smtp_from_email))
    message["To"] = to_email

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(text_fallback, "plain", "utf-8"))
    alt.attach(MIMEText(html_body, "html", "utf-8"))
    message.attach(alt)

    if pdf_bytes:
        attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
        attachment.add_header("Content-Disposition", "attachment", filename=pdf_filename)
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


def send_recap_email(
    to_email: str, nickname: str, html_body: str, pdf_bytes: bytes | None, party_title: str
) -> bool:
    text_fallback = (
        f"Hello {nickname},\n\n"
        f"Merci d'avoir participé au quiz de {party_title} ! "
        "Ton récap (score, classement, réponses) est dans cet email — ouvre-le dans un client "
        "qui affiche le HTML pour le voir correctement.\n\n"
        "Merci,\nLana"
    )
    return _send(
        to_email,
        subject=f"Ton récap du quiz — {party_title}",
        text_fallback=text_fallback,
        html_body=html_body,
        pdf_bytes=pdf_bytes,
        pdf_filename=f"recap-{nickname}.pdf",
    )


def send_session_recap_email(
    to_email: str,
    session_label: str,
    html_body: str,
    pdf_bytes: bytes | None,
    party_title: str,
) -> bool:
    """The organizer's own copy: every player, every answer, the podium —
    sent once a session ends, separate from each player's personal recap."""
    text_fallback = (
        "Coucou,\n\n"
        f"Voici le récap complet de la session « {session_label} » : classement, statistiques "
        "et réponses de chaque joueur — ouvre cet email dans un client qui affiche le HTML pour "
        "le voir correctement.\n\n"
        "À bientôt !"
    )
    return _send(
        to_email,
        subject=f"Récap complet — {party_title} ({session_label})",
        text_fallback=text_fallback,
        html_body=html_body,
        pdf_bytes=pdf_bytes,
        pdf_filename=f"recap-complet-{session_label}.pdf",
    )
