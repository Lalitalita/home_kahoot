"""Rich HTML email bodies — the primary way players and the organizer see
their results now (the PDF is still attached, but as a secondary copy).

Built as plain table-based HTML with inline styles, the way email has to
be written to survive Gmail/Outlook/Apple Mail's wildly different CSS
support. No templating engine: these are short enough that f-strings stay
readable, and it avoids adding a dependency for this alone.

Every piece of user-entered text (nicknames, question/choice text, session
labels) is escaped before being interpolated — it round-trips through the
database from guest/admin input and must never be trusted as markup.
"""

from html import escape

from app.schemas import GameSessionDetail, PlayerResult, SessionAwards

CYAN_DARK = "#0d8a8a"
CYAN_TINT = "#eefdfd"
MAGENTA = "#7f18a0"
MAGENTA_TINT = "#faf0fd"
INK = "#1c1c1c"
MUTED = "#6b6b6b"
BORDER = "#e7e7ea"
GREEN = "#0f9d58"
RED = "#d93025"
PAGE_BG = "#f1efe9"
CARD_BG = "#ffffff"
GOLD = "#d4af37"
SILVER = "#9aa5ac"
BRONZE = "#b0703a"

FONT_DISPLAY = "'Baloo 2', Arial, sans-serif"
FONT_BODY = "'Inter', Arial, sans-serif"

_MEDALS = {0: ("🥇", GOLD), 1: ("🥈", SILVER), 2: ("🥉", BRONZE)}


def _e(value) -> str:
    return escape(str(value))


def _shell(title: str, subtitle: str, body_rows: str) -> str:
    return f"""\
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{_e(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:{PAGE_BG};font-family:{FONT_BODY};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PAGE_BG};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:{CARD_BG};border-radius:20px;overflow:hidden;">
          <tr>
            <td style="background:{CYAN_DARK};padding:32px 24px;text-align:center;">
              <div style="font-family:{FONT_DISPLAY};font-weight:800;font-size:26px;color:#ffffff;">{_e(title)}</div>
              <div style="font-family:{FONT_BODY};font-size:14px;color:#eafefe;margin-top:6px;">{_e(subtitle)}</div>
            </td>
          </tr>
          {body_rows}
          <tr>
            <td style="padding:22px 24px;text-align:center;border-top:1px solid {BORDER};">
              <div style="font-family:{FONT_DISPLAY};font-weight:700;font-size:13px;color:{MUTED};">🎉 Kahoot Anniv Lana</div>
              <div style="font-family:{FONT_BODY};font-size:12px;color:{MUTED};margin-top:4px;">C'est la fête</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _row(inner: str) -> str:
    return f'<tr><td style="padding:0 24px;">{inner}</td></tr>'


def _score_badges(score: int, correct_count: int, total: int, rank: int | None, players_count: int | None) -> str:
    rank_html = ""
    if rank is not None and players_count:
        rank_html = (
            f'<div style="font-family:{FONT_BODY};font-size:14px;color:{MUTED};'
            f'text-align:center;margin:14px 0 4px;">Classé(e) '
            f'<strong style="color:{INK};">#{rank}</strong> sur {players_count} joueur(s)</div>'
        )
    return _row(f"""
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
        <tr>
          <td width="48%" style="background:{MAGENTA};border-radius:16px;padding:18px 0;text-align:center;">
            <div style="font-family:{FONT_DISPLAY};font-weight:800;font-size:32px;color:#ffffff;">{score}</div>
            <div style="font-family:{FONT_BODY};font-weight:600;font-size:10px;letter-spacing:0.06em;color:#faf0fd;text-transform:uppercase;">Points</div>
          </td>
          <td width="4%"></td>
          <td width="48%" style="background:#2b2b30;border-radius:16px;padding:18px 0;text-align:center;">
            <div style="font-family:{FONT_DISPLAY};font-weight:800;font-size:32px;color:#ffffff;">{correct_count}/{total}</div>
            <div style="font-family:{FONT_BODY};font-weight:600;font-size:10px;letter-spacing:0.06em;color:#dddddd;text-transform:uppercase;">Bonnes réponses</div>
          </td>
        </tr>
      </table>
      {rank_html}
    """)


def _podium_list(top3: list[PlayerResult]) -> str:
    if not top3:
        return ""
    lines = []
    for i, p in enumerate(top3[:3]):
        medal, color = _MEDALS[i]
        lines.append(f"""
          <tr>
            <td style="padding:8px 14px;background:{color}1a;border-left:4px solid {color};border-radius:8px;">
              <span style="font-size:18px;">{medal}</span>
              <span style="font-family:{FONT_BODY};font-weight:600;font-size:14px;color:{INK};margin-left:8px;">{_e(p.nickname)}</span>
              <span style="font-family:{FONT_BODY};font-size:13px;color:{MUTED};float:right;">{p.score} pts</span>
            </td>
          </tr>
          <tr><td style="height:6px;line-height:6px;font-size:0;">&nbsp;</td></tr>
        """)
    return _row(f"""
      <div style="font-family:{FONT_DISPLAY};font-weight:700;font-size:16px;color:{MAGENTA};margin:26px 0 10px;">Podium</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{"".join(lines)}</table>
    """)


def _award_box(icon: str, label: str, detail: str) -> str:
    return f"""
      <tr>
        <td style="padding:10px 14px;background:{CYAN_TINT};border-radius:10px;">
          <span style="font-size:16px;">{icon}</span>
          <span style="font-family:{FONT_BODY};font-weight:600;font-size:13px;color:{INK};margin-left:6px;">{label}</span>
          <span style="font-family:{FONT_BODY};font-size:13px;color:{MUTED};"> — {detail}</span>
        </td>
      </tr>
      <tr><td style="height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>
    """


def _awards_section(awards: SessionAwards, highlight_nickname: str | None = None) -> str:
    """Fun stats. If highlight_nickname is set (a player's own email), only
    the awards THEY won are shown, framed as personal bragging rights;
    otherwise (the organizer's email) every award is listed."""
    boxes = []
    if awards.fastest_answer and (highlight_nickname is None or awards.fastest_answer.nickname == highlight_nickname):
        secs = awards.fastest_answer.response_time_ms / 1000
        boxes.append(_award_box("⚡", "Réponse la plus rapide", f"{_e(awards.fastest_answer.nickname)} en {secs:.1f}s"))
    if awards.slowest_answer and (highlight_nickname is None or awards.slowest_answer.nickname == highlight_nickname):
        secs = awards.slowest_answer.response_time_ms / 1000
        boxes.append(_award_box("🐢", "Réponse la plus lente", f"{_e(awards.slowest_answer.nickname)} en {secs:.1f}s"))
    if awards.best_streak and (highlight_nickname is None or awards.best_streak.nickname == highlight_nickname):
        boxes.append(_award_box("🔥", "Série de bonnes réponses", f"{_e(awards.best_streak.nickname)} — {awards.best_streak.streak} d'affilée"))
    if awards.worst_streak and (highlight_nickname is None or awards.worst_streak.nickname == highlight_nickname):
        boxes.append(_award_box("😬", "Série de mauvaises réponses", f"{_e(awards.worst_streak.nickname)} — {awards.worst_streak.streak} d'affilée"))
    if awards.most_consistent and (highlight_nickname is None or awards.most_consistent.nickname == highlight_nickname):
        boxes.append(_award_box("🎯", "Joueur le plus régulier", _e(awards.most_consistent.nickname)))
    if awards.most_unpredictable and (highlight_nickname is None or awards.most_unpredictable.nickname == highlight_nickname):
        boxes.append(_award_box("🎲", "Joueur le plus imprévisible", _e(awards.most_unpredictable.nickname)))

    if not boxes:
        return ""
    heading = "Tes exploits de la soirée" if highlight_nickname else "Statistiques amusantes"
    return _row(f"""
      <div style="font-family:{FONT_DISPLAY};font-weight:700;font-size:16px;color:{MAGENTA};margin:26px 0 10px;">{heading}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{"".join(boxes)}</table>
    """)


def _answers_table(player: PlayerResult) -> str:
    if not player.answers:
        return _row(f'<p style="font-family:{FONT_BODY};color:{MUTED};font-size:13px;">Aucune réponse enregistrée.</p>')

    header = f"""
      <tr>
        <td style="background:{CYAN_DARK};padding:8px 10px;font-family:{FONT_BODY};font-weight:700;font-size:11px;color:#ffffff;border-radius:8px 0 0 0;">Question</td>
        <td style="background:{CYAN_DARK};padding:8px 10px;font-family:{FONT_BODY};font-weight:700;font-size:11px;color:#ffffff;">Ta réponse</td>
        <td style="background:{CYAN_DARK};padding:8px 10px;font-family:{FONT_BODY};font-weight:700;font-size:11px;color:#ffffff;">Bonne réponse</td>
        <td style="background:{CYAN_DARK};padding:8px 10px;font-family:{FONT_BODY};font-weight:700;font-size:11px;color:#ffffff;border-radius:0 8px 0 0;">Pts</td>
      </tr>
    """
    rows = [header]
    for i, a in enumerate(player.answers):
        correct = a.choices[a.correct_index]
        if not a.answered:
            given, color = "Pas de réponse", MUTED
        elif a.choice_index is not None and 0 <= a.choice_index < len(a.choices):
            given, color = a.choices[a.choice_index], (GREEN if a.is_correct else RED)
        else:
            given, color = "—", MUTED
        bg = CYAN_TINT if i % 2 else CARD_BG
        rows.append(f"""
          <tr>
            <td style="background:{bg};padding:8px 10px;font-family:{FONT_BODY};font-size:12px;color:{INK};">{_e(a.question_text)}</td>
            <td style="background:{bg};padding:8px 10px;font-family:{FONT_BODY};font-size:12px;font-weight:700;color:{color};">{_e(given)}</td>
            <td style="background:{bg};padding:8px 10px;font-family:{FONT_BODY};font-size:12px;color:{MUTED};">{_e(correct)}</td>
            <td style="background:{bg};padding:8px 10px;font-family:{FONT_BODY};font-size:12px;font-weight:700;color:{INK};">{a.points}</td>
          </tr>
        """)
    return _row(f"""
      <div style="font-family:{FONT_DISPLAY};font-weight:700;font-size:16px;color:{MAGENTA};margin:26px 0 10px;">Tes réponses</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid {BORDER};border-radius:8px;overflow:hidden;">
        {"".join(rows)}
      </table>
    """)


def player_recap_html(
    player: PlayerResult,
    party_title: str,
    top3: list[PlayerResult] | None = None,
    rank: int | None = None,
    players_count: int | None = None,
    awards: SessionAwards | None = None,
) -> str:
    correct_count = sum(1 for a in player.answers if a.is_correct)
    total = len(player.answers)
    body = "".join(
        [
            _row(f'<p style="font-family:{FONT_BODY};font-size:15px;color:{INK};margin:22px 0 0;">Hello <strong>{_e(player.nickname)}</strong>, merci d\'avoir joué ! Voici ton récap de la soirée.</p>'),
            _score_badges(player.score, correct_count, total, rank, players_count),
            _podium_list(top3 or []),
            _awards_section(awards, highlight_nickname=player.nickname) if awards else "",
            _answers_table(player),
            _row(f'<p style="font-family:{FONT_BODY};font-size:12px;color:{MUTED};margin:22px 0 4px;">Tu retrouveras aussi ce récap en PDF en pièce jointe.</p>'),
        ]
    )
    return _shell(party_title, f"Récap du quiz de {player.nickname}", body)


def _leaderboard_table(session: GameSessionDetail) -> str:
    ranked = sorted(session.players, key=lambda p: p.score, reverse=True)
    rows = []
    for i, p in enumerate(ranked):
        medal = _MEDALS.get(i, (None, None))[0]
        bg = MAGENTA_TINT if i % 2 else CARD_BG
        rows.append(f"""
          <tr>
            <td style="background:{bg};padding:8px 10px;font-family:{FONT_BODY};font-size:13px;color:{MUTED};">{medal or f"#{i + 1}"}</td>
            <td style="background:{bg};padding:8px 10px;font-family:{FONT_BODY};font-weight:600;font-size:13px;color:{INK};">{_e(p.nickname)}</td>
            <td style="background:{bg};padding:8px 10px;font-family:{FONT_BODY};font-weight:700;font-size:13px;color:{INK};">{p.score}</td>
          </tr>
        """)
    return "".join(rows)


def admin_recap_html(session: GameSessionDetail, party_title: str, awards: SessionAwards | None = None) -> str:
    players_count = len(session.players)
    total_answers = sum(len(p.answers) for p in session.players)
    avg_score = round(sum(p.score for p in session.players) / players_count) if players_count else 0
    top_score = max((p.score for p in session.players), default=0)

    def stat_tile(value, label) -> str:
        return f"""
          <td width="25%" style="text-align:center;padding:10px 4px;">
            <div style="font-family:{FONT_DISPLAY};font-weight:800;font-size:22px;color:{CYAN_DARK};">{value}</div>
            <div style="font-family:{FONT_BODY};font-size:10px;color:{MUTED};text-transform:uppercase;letter-spacing:0.04em;">{label}</div>
          </td>
        """

    stats_row = _row(f"""
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;background:{CYAN_TINT};border-radius:14px;">
        <tr>
          {stat_tile(players_count, "Joueurs")}
          {stat_tile(total_answers, "Réponses")}
          {stat_tile(avg_score, "Score moyen")}
          {stat_tile(top_score, "Meilleur score")}
        </tr>
      </table>
    """)

    leaderboard = _row(f"""
      <div style="font-family:{FONT_DISPLAY};font-weight:700;font-size:16px;color:{MAGENTA};margin:26px 0 10px;">Classement complet</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid {BORDER};border-radius:8px;overflow:hidden;">
        {_leaderboard_table(session)}
      </table>
    """)

    body = "".join(
        [
            _row(f'<p style="font-family:{FONT_BODY};font-size:15px;color:{INK};margin:22px 0 0;">Voici le récap complet de la session <strong>{_e(session.label)}</strong>.</p>'),
            stats_row,
            leaderboard,
            _awards_section(awards) if awards else "",
            _row(f'<p style="font-family:{FONT_BODY};font-size:12px;color:{MUTED};margin:22px 0 4px;">Le détail question par question de chaque joueur est dans le PDF en pièce jointe.</p>'),
        ]
    )
    return _shell(party_title, f"{session.label} · récap complet", body)
