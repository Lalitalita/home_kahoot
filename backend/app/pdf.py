import io

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.schemas import GameSessionDetail, PlayerResult

CYAN = colors.HexColor("#0fa3a3")
CYAN_DARK = colors.HexColor("#127f7f")
CYAN_TINT = colors.HexColor("#eafefe")
MAGENTA = colors.HexColor("#7f18a0")
MAGENTA_TINT = colors.HexColor("#fbeafe")
INK = colors.HexColor("#181818")
MUTED = colors.HexColor("#5c5c5c")
BORDER = colors.HexColor("#e2e2e2")
GREEN = colors.HexColor("#15803d")
RED = colors.HexColor("#b91c1c")
WHITE = colors.white
GOLD = colors.HexColor("#c9a227")
SILVER = colors.HexColor("#93a1ab")
BRONZE = colors.HexColor("#a3672f")

PAGE_MARGINS = dict(topMargin=1.6 * cm, bottomMargin=1.8 * cm, leftMargin=1.5 * cm, rightMargin=1.5 * cm)

_styles = getSampleStyleSheet()
_banner_title_style = ParagraphStyle(
    "BannerTitle", parent=_styles["Title"], textColor=WHITE, fontSize=22, alignment=TA_CENTER, spaceAfter=2
)
_banner_subtitle_style = ParagraphStyle(
    "BannerSubtitle", parent=_styles["Normal"], textColor=CYAN_TINT, fontSize=11, alignment=TA_CENTER
)
_score_number_style = ParagraphStyle(
    "ScoreNumber", parent=_styles["Title"], textColor=WHITE, fontSize=26, alignment=TA_CENTER, spaceAfter=0
)
_score_label_style = ParagraphStyle(
    "ScoreLabel", parent=_styles["Normal"], textColor=MAGENTA_TINT, fontSize=9, alignment=TA_CENTER
)
_question_style = ParagraphStyle(
    "RecapQuestion", parent=_styles["Normal"], textColor=INK, fontSize=11, fontName="Helvetica-Bold"
)
_answer_style = ParagraphStyle("RecapAnswer", parent=_styles["Normal"], fontSize=10, textColor=INK)
_section_style = ParagraphStyle(
    "RecapSection", parent=_styles["Heading2"], textColor=MAGENTA, fontSize=14, spaceBefore=16, spaceAfter=4
)
_footer_style = ParagraphStyle("Footer", parent=_styles["Normal"], textColor=MUTED, fontSize=8, alignment=TA_CENTER)
_podium_name_style = ParagraphStyle(
    "PodiumName", parent=_styles["Normal"], textColor=WHITE, fontSize=12, fontName="Helvetica-Bold", alignment=TA_CENTER
)
_podium_score_style = ParagraphStyle(
    "PodiumScore", parent=_styles["Normal"], textColor=WHITE, fontSize=10, alignment=TA_CENTER
)
_podium_empty_style = ParagraphStyle(
    "PodiumEmpty", parent=_styles["Normal"], textColor=WHITE, fontSize=11, alignment=TA_CENTER
)
_podium_label_style = ParagraphStyle(
    "PodiumLabel", parent=_styles["Normal"], textColor=MUTED, fontSize=9, alignment=TA_CENTER, spaceBefore=5
)


def _title_banner(title: str, subtitle: str) -> Table:
    """A full-width colored header band, cyan fading into a magenta edge —
    reportlab has no real gradient fill for flowables, so two adjoining
    solid-color cells stand in for one."""
    cell = Table(
        [[Paragraph(title, _banner_title_style)], [Paragraph(subtitle, _banner_subtitle_style)]],
        colWidths=[17 * cm],
    )
    cell.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), CYAN_DARK),
                ("TOPPADDING", (0, 0), (-1, 0), 14),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 14),
                ("TOPPADDING", (0, 1), (-1, 1), 2),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    accent = Table([[""]], colWidths=[17 * cm], rowHeights=[4])
    accent.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), MAGENTA)]))
    wrapper = Table([[cell], [accent]], colWidths=[17 * cm])
    wrapper.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return wrapper


def _score_badge(score: int, correct_count: int, total: int) -> Table:
    def _cell(number: str, label: str, bg) -> Table:
        t = Table([[Paragraph(number, _score_number_style)], [Paragraph(label, _score_label_style)]])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), bg),
                    ("TOPPADDING", (0, 0), (-1, 0), 10),
                    ("BOTTOMPADDING", (0, 1), (-1, 1), 10),
                    ("TOPPADDING", (0, 1), (-1, 1), 0),
                ]
            )
        )
        return t

    row = [
        _cell(str(score), "POINTS", MAGENTA),
        _cell(f"{correct_count}/{total}" if total else "—", "BONNES RÉPONSES", CYAN_DARK),
    ]
    wrapper = Table([row], colWidths=[8.4 * cm, 8.4 * cm], spaceBefore=10, spaceAfter=14)
    wrapper.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return wrapper


def _footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setStrokeColor(BORDER)
    canvas.line(1.5 * cm, 1.3 * cm, A4[0] - 1.5 * cm, 1.3 * cm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawCentredString(A4[0] / 2, 0.9 * cm, f"C'est la fête — page {doc.page}")
    canvas.restoreState()


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
                Paragraph(given, ParagraphStyle("given", parent=_answer_style, textColor=given_color, fontName="Helvetica-Bold")),
                Paragraph(correct, _answer_style),
                str(a.points),
            ]
        )

    table = Table(rows, colWidths=[1 * cm, 6.5 * cm, 3.3 * cm, 3.3 * cm, 1.6 * cm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), CYAN_DARK),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, CYAN_TINT]),
                ("LINEBELOW", (0, 0), (-1, -1), 0.5, BORDER),
                ("BOX", (0, 0), (-1, -1), 0.75, CYAN_DARK),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def _podium_section(players: list[PlayerResult]) -> list:
    ranked = sorted(players, key=lambda p: p.score, reverse=True)
    top3 = ranked[:3]
    if not top3:
        return []

    # Left to right on a real podium: 2nd, 1st, 3rd. Bar height + color
    # signal rank; VALIGN=BOTTOM keeps them anchored to a shared "ground".
    slots = [
        (top3[1] if len(top3) > 1 else None, "2E PLACE", SILVER, 3.0 * cm),
        (top3[0], "1ERE PLACE", GOLD, 4.2 * cm),
        (top3[2] if len(top3) > 2 else None, "3E PLACE", BRONZE, 2.1 * cm),
    ]

    bars = []
    labels = []
    for player, label, color, height in slots:
        if player is not None:
            content = Table(
                [[Paragraph(player.nickname, _podium_name_style)], [Paragraph(f"{player.score} pts", _podium_score_style)]],
                colWidths=[5.2 * cm],
                rowHeights=[height - 1.1 * cm, 1.1 * cm],
            )
        else:
            content = Table([[Paragraph("—", _podium_empty_style)]], colWidths=[5.2 * cm], rowHeights=[height])
        content.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), color),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        bars.append(content)
        labels.append(Paragraph(label, _podium_label_style))

    podium = Table([bars, labels], colWidths=[5.4 * cm] * 3)
    podium.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, 0), "BOTTOM"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    return [
        HRFlowable(width="100%", thickness=0.75, color=BORDER, spaceBefore=22, spaceAfter=6),
        Paragraph("Podium", _section_style),
        podium,
    ]


def build_player_recap_pdf(player: PlayerResult, party_title: str = "C'est la fête") -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, **PAGE_MARGINS)
    correct_count = sum(1 for a in player.answers if a.is_correct)
    total = len(player.answers)

    story = [
        _title_banner(party_title, f"Récap du quiz de {player.nickname}"),
        _score_badge(player.score, correct_count, total),
    ]
    if player.answers:
        story.append(_player_answers_table(player))
    else:
        story.append(Paragraph("Aucune réponse enregistrée pour cette session.", _answer_style))

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()


def build_session_recap_pdf(session: GameSessionDetail, party_title: str = "C'est la fête") -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, **PAGE_MARGINS)

    story = [
        _title_banner(party_title, f"{session.label} · {session.started_at.strftime('%d/%m/%Y %H:%M')}"),
        Spacer(1, 12),
    ]

    ranking_rows = [["#", "Pseudo", "Score"]]
    for i, p in enumerate(sorted(session.players, key=lambda p: p.score, reverse=True), start=1):
        ranking_rows.append([str(i), p.nickname, str(p.score)])
    ranking_table = Table(ranking_rows, colWidths=[1.2 * cm, 8 * cm, 3 * cm])
    ranking_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), MAGENTA),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, MAGENTA_TINT]),
                ("BOX", (0, 0), (-1, -1), 0.75, MAGENTA),
                ("LINEBELOW", (0, 0), (-1, -1), 0.5, BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(ranking_table)

    for player in sorted(session.players, key=lambda p: p.score, reverse=True):
        correct_count = sum(1 for a in player.answers if a.is_correct)
        story.append(HRFlowable(width="100%", thickness=0.75, color=BORDER, spaceBefore=18, spaceAfter=2))
        story.append(
            Paragraph(
                f"{player.nickname} — {player.score} pts ({correct_count}/{len(player.answers)})",
                _section_style,
            )
        )
        if player.answers:
            story.append(_player_answers_table(player))
        else:
            story.append(Paragraph("Aucune réponse enregistrée.", _answer_style))
        story.append(Spacer(1, 4))

    story.extend(_podium_section(session.players))

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()
