import io
import os

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable,
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.schemas import GameSessionDetail, PlayerResult

# ---------- Brand fonts (embedded, not the system Helvetica default) ----------

_FONT_DIR = os.path.join(os.path.dirname(__file__), "fonts")
pdfmetrics.registerFont(TTFont("Baloo2-Bold", os.path.join(_FONT_DIR, "Baloo2-Bold.ttf")))
pdfmetrics.registerFont(TTFont("Baloo2-ExtraBold", os.path.join(_FONT_DIR, "Baloo2-ExtraBold.ttf")))
pdfmetrics.registerFont(TTFont("Inter-Regular", os.path.join(_FONT_DIR, "Inter-Regular.ttf")))
pdfmetrics.registerFont(TTFont("Inter-Medium", os.path.join(_FONT_DIR, "Inter-Medium.ttf")))
pdfmetrics.registerFont(TTFont("Inter-SemiBold", os.path.join(_FONT_DIR, "Inter-SemiBold.ttf")))
pdfmetrics.registerFont(TTFont("Inter-Bold", os.path.join(_FONT_DIR, "Inter-Bold.ttf")))

DISPLAY_FONT = "Baloo2-ExtraBold"
DISPLAY_FONT_MEDIUM = "Baloo2-Bold"
BODY_FONT = "Inter-Regular"
BODY_FONT_MEDIUM = "Inter-Medium"
BODY_FONT_SEMIBOLD = "Inter-SemiBold"
BODY_FONT_BOLD = "Inter-Bold"

CYAN = colors.HexColor("#0fa3a3")
CYAN_DARK = colors.HexColor("#0d8a8a")
CYAN_TINT = colors.HexColor("#eefdfd")
# Kept as a rare, deliberate accent — section titles, the podium heading,
# the thin strip under the banner — never as another competing block
# color alongside cyan.
MAGENTA = colors.HexColor("#7f18a0")
CHARCOAL = colors.HexColor("#2b2b30")
INK = colors.HexColor("#1c1c1c")
MUTED = colors.HexColor("#6b6b6b")
BORDER = colors.HexColor("#e7e7ea")
GREEN = colors.HexColor("#0f9d58")
RED = colors.HexColor("#d93025")
WHITE = colors.white
GOLD = colors.HexColor("#d4af37")
SILVER = colors.HexColor("#9aa5ac")
BRONZE = colors.HexColor("#b0703a")
PAGE_BG = colors.HexColor("#fbfaf8")

PAGE_WIDTH = 17 * cm
PAGE_MARGINS = dict(topMargin=1.4 * cm, bottomMargin=1.8 * cm, leftMargin=1.5 * cm, rightMargin=1.5 * cm)

_styles = getSampleStyleSheet()
_answer_style = ParagraphStyle(
    "RecapAnswer", parent=_styles["Normal"], fontName=BODY_FONT, fontSize=10, textColor=INK, leading=13
)
_section_style = ParagraphStyle(
    "RecapSection",
    parent=_styles["Normal"],
    fontName=DISPLAY_FONT_MEDIUM,
    textColor=MAGENTA,
    fontSize=15,
    spaceBefore=18,
    spaceAfter=6,
)
_muted_style = ParagraphStyle(
    "RecapMuted", parent=_styles["Normal"], fontName=BODY_FONT, fontSize=10, textColor=MUTED
)


# ---------- Custom flowables: hand-drawn so corners are actually round ----------


class HeaderBanner(Flowable):
    """The colored title band at the top of every recap — a true
    rounded-corner rectangle (reportlab tables can't do that)."""

    def __init__(self, title: str, subtitle: str, width: float = PAGE_WIDTH, height: float = 3.1 * cm):
        super().__init__()
        self.title = title
        self.subtitle = subtitle
        self.width = width
        self.height = height

    def wrap(self, availWidth, availHeight):
        return (self.width, self.height)

    def draw(self):
        c = self.canv
        c.saveState()
        c.setFillColor(CYAN_DARK)
        c.roundRect(0, 0, self.width, self.height, 14, fill=1, stroke=0)

        c.setFillColor(WHITE)
        c.setFont(DISPLAY_FONT, 23)
        c.drawCentredString(self.width / 2, self.height - 1.35 * cm, self.title)
        c.setFillColor(CYAN_TINT)
        c.setFont(BODY_FONT_MEDIUM, 11)
        c.drawCentredString(self.width / 2, self.height - 2.05 * cm, self.subtitle)
        c.restoreState()


class ScoreBadges(Flowable):
    """Two rounded pill badges side by side: total score, and the
    correct-answer tally. Drawn on the canvas so the corners are actually
    round, not approximated with table cells."""

    def __init__(self, score: int, correct_count: int, total: int, width: float = PAGE_WIDTH, height: float = 3.0 * cm):
        super().__init__()
        self.score = score
        self.correct_count = correct_count
        self.total = total
        self.width = width
        self.height = height

    def wrap(self, availWidth, availHeight):
        return (self.width, self.height)

    def draw(self):
        c = self.canv
        gap = 0.5 * cm
        badge_w = (self.width - gap) / 2

        def badge(x: float, bg, big_text: str, small_text: str):
            c.saveState()
            c.setFillColor(bg)
            c.roundRect(x, 0, badge_w, self.height, 16, fill=1, stroke=0)
            c.setFillColor(WHITE)
            c.setFont(DISPLAY_FONT, 30)
            c.drawCentredString(x + badge_w / 2, self.height / 2 - 4, big_text)
            c.setFont(BODY_FONT_SEMIBOLD, 9)
            c.drawCentredString(x + badge_w / 2, self.height / 2 - 24, small_text)
            c.restoreState()

        badge(0, MAGENTA, str(self.score), "POINTS")
        badge(
            badge_w + gap,
            CHARCOAL,
            f"{self.correct_count}/{self.total}" if self.total else "—",
            "BONNES RÉPONSES",
        )


class Podium(Flowable):
    """The gold/silver/bronze podium — rounded-top bars whose height
    signals rank, drawn directly so the tops are genuinely rounded."""

    def __init__(self, entries: list[tuple], width: float = PAGE_WIDTH, height: float = 5.3 * cm):
        # entries: list of (name_or_None, score, label, color, bar_height)
        super().__init__()
        self.entries = entries
        self.width = width
        self.height = height

    def wrap(self, availWidth, availHeight):
        return (self.width, self.height)

    def draw(self):
        c = self.canv
        n = len(self.entries)
        gap = 0.5 * cm
        label_h = 0.55 * cm
        col_w = (self.width - gap * (n - 1)) / n

        for i, (name, score, label, color, bar_h) in enumerate(self.entries):
            x = i * (col_w + gap)
            y = label_h
            c.saveState()
            c.setFillColor(color)
            c.roundRect(x, y, col_w, bar_h, 12, fill=1, stroke=0)
            if name is not None:
                c.setFillColor(WHITE)
                c.setFont(DISPLAY_FONT_MEDIUM, 13)
                c.drawCentredString(x + col_w / 2, y + bar_h - 24, name[:16])
                c.setFont(BODY_FONT_MEDIUM, 10)
                c.drawCentredString(x + col_w / 2, y + bar_h - 40, f"{score} pts")
            else:
                c.setFillColor(colors.Color(1, 1, 1, alpha=0.85))
                c.setFont(BODY_FONT_MEDIUM, 12)
                c.drawCentredString(x + col_w / 2, y + bar_h / 2 - 4, "—")
            c.setFillColor(MUTED)
            c.setFont(BODY_FONT_SEMIBOLD, 9)
            c.drawCentredString(x + col_w / 2, 0, label)
            c.restoreState()


def _page_background(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFillColor(PAGE_BG)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.6)
    canvas.line(1.5 * cm, 1.3 * cm, A4[0] - 1.5 * cm, 1.3 * cm)
    canvas.setFont(BODY_FONT, 8)
    canvas.setFillColor(MUTED)
    canvas.drawCentredString(A4[0] / 2, 0.9 * cm, f"C'est la fête · page {doc.page}")
    canvas.restoreState()


def _player_answers_table(player: PlayerResult) -> Table:
    header_style = ParagraphStyle(
        "tableHeader", parent=_styles["Normal"], fontName=BODY_FONT_BOLD, fontSize=9.5, textColor=WHITE
    )
    header = [Paragraph(h, header_style) for h in ["#", "Question", "Réponse donnée", "Bonne réponse", "Pts"]]
    rows = [header]
    for i, a in enumerate(player.answers, start=1):
        correct = a.choices[a.correct_index]
        if not a.answered:
            given = "Pas de réponse"
            given_color = MUTED
            given_font = BODY_FONT_MEDIUM
        elif a.choice_index is not None and 0 <= a.choice_index < len(a.choices):
            given = a.choices[a.choice_index]
            given_color = GREEN if a.is_correct else RED
            given_font = BODY_FONT_BOLD
        else:
            given = "—"
            given_color = MUTED
            given_font = BODY_FONT_MEDIUM
        rows.append(
            [
                Paragraph(str(i), ParagraphStyle("idx", parent=_answer_style, textColor=MUTED)),
                Paragraph(a.question_text, _answer_style),
                Paragraph(
                    given, ParagraphStyle("given", parent=_answer_style, textColor=given_color, fontName=given_font)
                ),
                Paragraph(correct, ParagraphStyle("correct", parent=_answer_style, textColor=MUTED)),
                Paragraph(str(a.points), ParagraphStyle("pts", parent=_answer_style, fontName=BODY_FONT_SEMIBOLD)),
            ]
        )

    table = Table(rows, colWidths=[0.8 * cm, 6.6 * cm, 3.3 * cm, 3.3 * cm, 1.5 * cm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), CYAN_DARK),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, CYAN_TINT]),
                ("LINEBELOW", (0, 0), (-1, -2), 0.5, BORDER),
                ("BOX", (0, 0), (-1, -1), 0.75, CYAN_DARK),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, 0), 9),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 9),
            ]
        )
    )
    return table


def _podium_flowables(players: list[PlayerResult]) -> list:
    ranked = sorted(players, key=lambda p: p.score, reverse=True)
    top3 = ranked[:3]
    if not top3:
        return []

    def entry(idx: int, label: str, color, bar_h: float) -> tuple:
        if idx < len(top3):
            p = top3[idx]
            return (p.nickname, p.score, label, color, bar_h)
        return (None, 0, label, color, bar_h)

    # Left to right: 2nd, 1st, 3rd — the classic podium arrangement.
    entries = [
        entry(1, "2E PLACE", SILVER, 3.1 * cm),
        entry(0, "1ERE PLACE", GOLD, 4.3 * cm),
        entry(2, "3E PLACE", BRONZE, 2.2 * cm),
    ]

    return [
        HRFlowable(width="100%", thickness=0.75, color=BORDER, spaceBefore=22, spaceAfter=10),
        Paragraph("Podium", _section_style),
        Podium(entries),
    ]


def build_player_recap_pdf(
    player: PlayerResult, party_title: str = "C'est la fête", top3: list[PlayerResult] | None = None
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, **PAGE_MARGINS)
    correct_count = sum(1 for a in player.answers if a.is_correct)
    total = len(player.answers)

    story = [
        HeaderBanner(party_title, f"Récap du quiz de {player.nickname}"),
        Spacer(1, 16),
        ScoreBadges(player.score, correct_count, total),
        Spacer(1, 16),
    ]
    if player.answers:
        story.append(_player_answers_table(player))
    else:
        story.append(Paragraph("Aucune réponse enregistrée pour cette session.", _muted_style))

    if top3:
        story.extend(_podium_flowables(top3))

    doc.build(story, onFirstPage=_page_background, onLaterPages=_page_background)
    return buffer.getvalue()


def build_session_recap_pdf(session: GameSessionDetail, party_title: str = "C'est la fête") -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, **PAGE_MARGINS)

    story = [
        HeaderBanner(party_title, f"{session.label} · {session.started_at.strftime('%d/%m/%Y %H:%M')}"),
        Spacer(1, 16),
    ]

    header_style = ParagraphStyle(
        "rankHeader", parent=_styles["Normal"], fontName=BODY_FONT_BOLD, fontSize=9.5, textColor=WHITE
    )
    ranking_rows = [[Paragraph(h, header_style) for h in ["#", "Pseudo", "Score"]]]
    for i, p in enumerate(sorted(session.players, key=lambda p: p.score, reverse=True), start=1):
        ranking_rows.append(
            [
                Paragraph(str(i), ParagraphStyle("rankIdx", parent=_answer_style, textColor=MUTED)),
                Paragraph(p.nickname, ParagraphStyle("rankName", parent=_answer_style, fontName=BODY_FONT_SEMIBOLD)),
                Paragraph(str(p.score), ParagraphStyle("rankScore", parent=_answer_style, fontName=BODY_FONT_BOLD)),
            ]
        )
    ranking_table = Table(ranking_rows, colWidths=[1.2 * cm, 12.3 * cm, 3.5 * cm])
    ranking_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), CYAN_DARK),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, CYAN_TINT]),
                ("BOX", (0, 0), (-1, -1), 0.75, CYAN_DARK),
                ("LINEBELOW", (0, 0), (-1, -2), 0.5, BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
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
            story.append(Paragraph("Aucune réponse enregistrée.", _muted_style))
        story.append(Spacer(1, 4))

    doc.build(story, onFirstPage=_page_background, onLaterPages=_page_background)
    return buffer.getvalue()
