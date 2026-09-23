import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.schemas import GameSessionDetail, PlayerResult

CYAN = colors.HexColor("#0fa3a3")
CYAN_TINT = colors.HexColor("#eafefe")
MAGENTA = colors.HexColor("#7f18a0")
INK = colors.HexColor("#181818")
MUTED = colors.HexColor("#5c5c5c")
BORDER = colors.HexColor("#d9d9d9")
GREEN = colors.HexColor("#15803d")
RED = colors.HexColor("#b91c1c")

_styles = getSampleStyleSheet()
_title_style = ParagraphStyle(
    "RecapTitle", parent=_styles["Title"], textColor=INK, fontSize=20, spaceAfter=4
)
_subtitle_style = ParagraphStyle(
    "RecapSubtitle", parent=_styles["Normal"], textColor=MUTED, fontSize=11, spaceAfter=16
)
_question_style = ParagraphStyle(
    "RecapQuestion", parent=_styles["Normal"], textColor=INK, fontSize=11, fontName="Helvetica-Bold"
)
_answer_style = ParagraphStyle("RecapAnswer", parent=_styles["Normal"], fontSize=10, textColor=INK)
_section_style = ParagraphStyle(
    "RecapSection", parent=_styles["Heading2"], textColor=MAGENTA, spaceBefore=18, spaceAfter=8
)


def _player_answers_table(player: PlayerResult) -> Table:
    header = ["#", "Question", "Réponse donnée", "Bonne réponse", "Points"]
    rows = [header]
    for i, a in enumerate(player.answers, start=1):
        correct = a.choices[a.correct_index]
        if not a.answered:
            given = "Pas de réponse"
            given_color = MUTED
        elif a.choice_index is not None and 0 <= a.choice_index < len(a.choices):
            given = a.choices[a.choice_index]
            given_color = GREEN if a.is_correct else RED
        else:
            given = "—"
            given_color = MUTED
        rows.append(
            [
                str(i),
                Paragraph(a.question_text, _answer_style),
                Paragraph(given, ParagraphStyle("given", parent=_answer_style, textColor=given_color)),
                Paragraph(correct, _answer_style),
                str(a.points),
            ]
        )

    table = Table(rows, colWidths=[1 * cm, 6.5 * cm, 3.3 * cm, 3.3 * cm, 1.6 * cm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), CYAN),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, CYAN_TINT]),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def build_player_recap_pdf(player: PlayerResult, party_title: str = "C'est la fête") -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm, leftMargin=1.5 * cm, rightMargin=1.5 * cm
    )
    correct_count = sum(1 for a in player.answers if a.is_correct)
    total = len(player.answers)

    story = [
        Paragraph(f"Récap du quiz — {party_title}", _title_style),
        Paragraph(
            f"{player.nickname} — score final : {player.score} points "
            f"({correct_count}/{total} bonnes réponses)",
            _subtitle_style,
        ),
    ]
    if player.answers:
        story.append(_player_answers_table(player))
    else:
        story.append(Paragraph("Aucune réponse enregistrée pour cette session.", _answer_style))

    doc.build(story)
    return buffer.getvalue()


def build_session_recap_pdf(session: GameSessionDetail, party_title: str = "C'est la fête") -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm, leftMargin=1.5 * cm, rightMargin=1.5 * cm
    )

    story = [
        Paragraph(f"Résultats du quiz — {party_title}", _title_style),
        Paragraph(
            f"{session.label} · {session.started_at.strftime('%d/%m/%Y %H:%M')}", _subtitle_style
        ),
    ]

    ranking_rows = [["#", "Pseudo", "Score"]]
    for i, p in enumerate(sorted(session.players, key=lambda p: p.score, reverse=True), start=1):
        ranking_rows.append([str(i), p.nickname, str(p.score)])
    ranking_table = Table(ranking_rows, colWidths=[1.2 * cm, 8 * cm, 3 * cm])
    ranking_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), CYAN),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, CYAN_TINT]),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(ranking_table)

    for player in sorted(session.players, key=lambda p: p.score, reverse=True):
        story.append(Paragraph(f"{player.nickname} — {player.score} pts", _section_style))
        if player.answers:
            story.append(_player_answers_table(player))
        else:
            story.append(Paragraph("Aucune réponse enregistrée.", _answer_style))
        story.append(Spacer(1, 4))

    doc.build(story)
    return buffer.getvalue()
