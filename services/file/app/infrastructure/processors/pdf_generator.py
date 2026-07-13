"""PDF document generation service."""
# type: ignore
import html
import re
from typing import Dict, Any, Optional
from reportlab.lib.pagesizes import letter, A4  # type: ignore
from reportlab.lib.units import inch  # type: ignore
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle  # type: ignore
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT  # type: ignore
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image  # type: ignore
from reportlab.lib import colors  # type: ignore
from reportlab.pdfbase import pdfmetrics  # type: ignore
from reportlab.pdfbase.ttfonts import TTFont  # type: ignore
from io import BytesIO
from datetime import datetime
from jinja2 import Template  # type: ignore
from app.utils.concurrency import run_in_threadpool
from app.utils.process_concurrency import run_in_processpool

# ---------------------------------------------------------------------------
# Unicode font registration for ReportLab
# ---------------------------------------------------------------------------
# NotoSans TTFs are installed via fonts-noto-core in the Docker image.
# Registration is guarded so the service still starts if fonts are absent
# (e.g. local dev without the packages), falling back to built-in Helvetica.
# NOTE: CJK characters in ReportLab require a separate CJK font (e.g.
# NotoSansCJK-Regular.ttc) registered as a CIDFont.  That path varies by
# package version and is left as a follow-up; Latin, Arabic, Bengali and most
# diacritic-extended Latin are covered by NotoSans-Regular below.

_NOTO_SANS_PATH = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
_NOTO_SANS_BOLD_PATH = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"
_UNICODE_FONT = "Helvetica"       # default fallback
_UNICODE_FONT_BOLD = "Helvetica-Bold"

try:
    import os as _os
    if _os.path.exists(_NOTO_SANS_PATH):
        pdfmetrics.registerFont(TTFont("NotoSans", _NOTO_SANS_PATH))
        _UNICODE_FONT = "NotoSans"
    if _os.path.exists(_NOTO_SANS_BOLD_PATH):
        pdfmetrics.registerFont(TTFont("NotoSans-Bold", _NOTO_SANS_BOLD_PATH))
        _UNICODE_FONT_BOLD = "NotoSans-Bold"
except Exception:
    pass  # Non-fatal: renders with Helvetica, tofu for non-Latin glyphs


# Helper to get styles in the worker process
def _get_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='CustomTitle',
        parent=styles['Title'],
        fontSize=24,
        textColor=colors.HexColor('#366092'),
        spaceAfter=30,
        alignment=TA_CENTER
    ))
    
    styles.add(ParagraphStyle(
        name='CustomHeading',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=colors.HexColor('#366092'),
        spaceAfter=12,
    ))
    # Unicode-safe style for participant names (Arabic, Bengali, diacritics)
    styles.add(ParagraphStyle(
        name='UnicodeName',
        parent=styles['Normal'],
        fontName=_UNICODE_FONT,
        fontSize=11,
    ))
    return styles

def generate_receipt_sync(
    transaction_data: Dict[str, Any]
) -> bytes:
    """Generate payment receipt PDF (synchronous implementation)."""
    styles = _get_styles()
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    story = []
    
    # Title
    title = Paragraph("Payment Receipt", styles['CustomTitle'])
    story.append(title)
    story.append(Spacer(1, 0.3 * inch))
    
    # Receipt details
    data = [
        ['Receipt #:', transaction_data.get('receipt_number', 'N/A')],
        ['Date:', transaction_data.get('date', transaction_data.get('created_at', datetime.utcnow().strftime('%Y-%m-%d')))],
        ['Transaction ID:', transaction_data.get('transaction_id', 'N/A')],
        ['', ''],
        ['Paid By:', transaction_data.get('payer_name', 'N/A')],
        ['Email:', transaction_data.get('payer_email', 'N/A')],
        ['Phone:', transaction_data.get('payer_phone', 'N/A')],
        ['', ''],
        ['Description:', transaction_data.get('description', 'Program Fee')],
        ['Amount:', f"Rp {transaction_data.get('amount', 0):,.2f}"],
        ['Payment Method:', transaction_data.get('payment_method', 'N/A')],
        ['Status:', transaction_data.get('status', 'PAID')],
    ]
    
    table = Table(data, colWidths=[2 * inch, 4 * inch])
    table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        # Use Unicode-capable font for the name value cell (row 4, col 1)
        # so non-Latin participant names (Arabic, Bengali, diacritics) render.
        ('FONTNAME', (1, 4), (1, 4), _UNICODE_FONT),
    ]))
    
    story.append(table)
    story.append(Spacer(1, 0.5 * inch))
    
    # Footer
    footer_text = f"This is an automatically generated receipt. Generated on {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}"
    footer = Paragraph(footer_text, styles['Normal'])
    story.append(footer)
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    return buffer.read()

def generate_offer_letter_sync(
    participant_data: Dict[str, Any],
    program_data: Dict[str, Any]
) -> bytes:
    """Generate offer letter PDF (synchronous implementation)."""
    styles = _get_styles()
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*inch)
    story = []
    
    # Date
    date_text = f"Date: {datetime.utcnow().strftime('%B %d, %Y')}"
    story.append(Paragraph(date_text, styles['Normal']))
    story.append(Spacer(1, 0.3 * inch))
    
    # Recipient — use UnicodeName style so non-Latin names render correctly
    recipient_lines = [
        participant_data.get('name', ''),
        participant_data.get('address', ''),
        participant_data.get('city', ''),
    ]
    for line in recipient_lines:
        if line:
            story.append(Paragraph(line, styles['UnicodeName']))

    story.append(Spacer(1, 0.3 * inch))

    # Subject
    subject = f"<b>Subject: Offer of Admission - {program_data.get('name', '')}</b>"
    story.append(Paragraph(subject, styles['Normal']))
    story.append(Spacer(1, 0.2 * inch))

    # Salutation — name may contain non-Latin characters
    salutation = f"Dear {participant_data.get('name', '')},"
    story.append(Paragraph(salutation, styles['UnicodeName']))
    story.append(Spacer(1, 0.2 * inch))
    
    # Body
    body_text = f"""
    We are pleased to inform you that you have been selected to participate in the 
    <b>{program_data.get('name', '')}</b> program. This is a testament to your outstanding 
    qualifications and potential.
    <br/><br/>
    <b>Program Details:</b><br/>
    Program: {program_data.get('name', '')}<br/>
    Start Date: {program_data.get('start_date', 'TBD')}<br/>
    Duration: {program_data.get('duration', 'TBD')}<br/>
    Location: {program_data.get('location', 'TBD')}<br/>
    <br/>
    Please confirm your acceptance by {program_data.get('confirmation_deadline', 'the specified date')}.
    <br/><br/>
    Congratulations once again on this achievement. We look forward to welcoming you to our program.
    """
    
    story.append(Paragraph(body_text, styles['Normal']))
    story.append(Spacer(1, 0.3 * inch))
    
    # Signature
    story.append(Paragraph("Sincerely,", styles['Normal']))
    story.append(Spacer(1, 0.5 * inch))
    story.append(Paragraph("<b>Program Director</b>", styles['Normal']))
    story.append(Paragraph("Young Business Bootcamp", styles['Normal']))
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    return buffer.read()

def generate_from_template_sync(
    template_html: str,
    data: Dict[str, Any]
) -> bytes:
    """Generate PDF from HTML template using Jinja2 (synchronous implementation)."""
    styles = _get_styles()
    # Render template with data
    template = Template(template_html)
    rendered_html = template.render(**data)

    # This would use weasyprint for HTML to PDF conversion
    # For now, returning a simple implementation

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    story = []

    # Parse and add rendered content (simplified)
    story.append(Paragraph(rendered_html, styles['Normal']))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()


LOA_LOGO_MAX_HEIGHT = '60pt'
LOA_STAMP_MAX_HEIGHT = '70pt'
LOA_SIGNATURE_MAX_HEIGHT = '36pt'


def _img_tag(url: str, max_height: str, center: bool = False) -> str:
    """Build a WeasyPrint-renderable <img> tag for a stored asset URL.

    WeasyPrint fetches http(s) image sources itself, so a plain <img src="...">
    (same convention the admin template preview already uses for {{logo}} /
    {{signature}}) is sufficient — no base64 inlining needed.

    A block-level image ignores the parent's text-align, so `center` adds the
    `margin:0 auto` that actually centers it.
    """
    if not url:
        return ''
    centering = 'margin:0 auto;' if center else ''
    return (
        f'<img src="{url}" style="max-height:{max_height};max-width:100%;'
        f'display:block;{centering}" />'
    )


def _build_structured_header_html(header: Dict[str, Any], logo_url: str) -> str:
    """JYS-style 3-column header: logo left, program name/batch centered, contact right."""
    logo_cell = _img_tag(logo_url, LOA_LOGO_MAX_HEIGHT)
    program_name = header.get('program_name') or ''
    batch = header.get('batch') or ''
    tagline = header.get('tagline') or ''
    website = header.get('website') or ''
    email = header.get('email') or ''
    phone = header.get('phone') or ''

    title_lines = ''
    if program_name:
        title_lines += f'<div>{program_name}</div>'
    if batch:
        title_lines += f'<div>Batch {batch}</div>'
    title_html = (
        f'<div style="font-weight:bold;font-size:14pt;line-height:1.25;">{title_lines}</div>'
        if title_lines
        else ''
    )
    tagline_html = f'<div style="font-style:italic;font-size:9pt;margin-top:2pt;">{tagline}</div>' if tagline else ''

    contact_rows = ''.join(f'<div>{value}</div>' for value in (website, email, phone) if value)

    return f"""<table style="width:100%;border-collapse:collapse;">
  <tr>
    <td style="width:20%;vertical-align:middle;text-align:left;">{logo_cell}</td>
    <td style="width:55%;vertical-align:middle;text-align:center;">
      {title_html}
      {tagline_html}
    </td>
    <td style="width:25%;vertical-align:middle;text-align:right;font-size:9pt;line-height:1.5;">{contact_rows}</td>
  </tr>
</table>"""


def _build_signer_html(signature_url: str, stamp_url: str, signer_name: str, signer_title: str) -> str:
    """Stamp above signature, then signer name (bold) and title beneath, all centered."""
    stamp_cell = _img_tag(stamp_url, LOA_STAMP_MAX_HEIGHT, center=True)
    signature_cell = _img_tag(signature_url, LOA_SIGNATURE_MAX_HEIGHT, center=True)
    name_html = f'<div style="font-weight:bold;">{signer_name}</div>' if signer_name else ''
    title_html = f'<div>{signer_title}</div>' if signer_title else ''

    return f"""<div style="text-align:center;">
  {stamp_cell}
  {signature_cell}
  {name_html}
  {title_html}
</div>"""


def generate_loa_sync(
    html_content: str,
    header_html: str,
    footer_html: str,
    page_size: str,
    margins: Dict[str, Any],
    placeholder_data: Dict[str, Any],
    document_number: str,
    logo_url: str = "",
    signature_url: str = "",
    stamp_url: str = "",
    signer_name: str = "",
    signer_title: str = "",
    header: Optional[Dict[str, Any]] = None,
) -> bytes:
    """Generate LOA PDF from Tiptap HTML using WeasyPrint."""
    from weasyprint import HTML, CSS  # type: ignore

    # Merge legacy {{logo}}/{{signature}}/{{stamp}} image tokens into the
    # generic substitution map so any occurrence in body/header/footer HTML
    # (wherever the admin placed them) renders as a real image instead of
    # literal placeholder text. Empty urls leave tokens untouched — this is
    # what keeps the no-image back-compat path byte-for-byte identical.
    image_tokens: Dict[str, Any] = {}
    if logo_url:
        image_tokens['{{logo}}'] = _img_tag(logo_url, LOA_LOGO_MAX_HEIGHT)
    if signature_url:
        image_tokens['{{signature}}'] = _img_tag(signature_url, LOA_SIGNATURE_MAX_HEIGHT)
    if stamp_url:
        image_tokens['{{stamp}}'] = _img_tag(stamp_url, LOA_STAMP_MAX_HEIGHT)
    merged_data = {**placeholder_data, **image_tokens}

    def replace_tokens(text: str) -> str:
        for key, value in merged_data.items():
            text = text.replace(key, str(value) if value is not None else '')
        return text

    body = replace_tokens(html_content)

    # Structured header when a header config is supplied; otherwise fall back
    # to the existing header_html behavior exactly as today (back-compat).
    if header:
        header_rendered = _build_structured_header_html(header, logo_url)
    else:
        header_rendered = replace_tokens(header_html or '')

    # Structured signer/signature block when any signer-related field is
    # provided; otherwise fall back to footer_html exactly as today (back-compat).
    has_signer_block = bool(signature_url or stamp_url or signer_name or signer_title)
    if has_signer_block:
        footer_rendered = _build_signer_html(signature_url, stamp_url, signer_name, signer_title)
    else:
        footer_rendered = replace_tokens(footer_html or '')

    top = margins.get('top', 40)
    right = margins.get('right', 40)
    bottom = margins.get('bottom', 40)
    left = margins.get('left', 40)
    page_size_css = 'A4' if str(page_size).upper() == 'A4' else 'Letter'

    full_html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {{
    size: {page_size_css};
    margin: {top}pt {right}pt {bottom}pt {left}pt;
  }}
  body {{
    font-family: "Noto Sans", "Noto Sans Arabic", "Noto Sans CJK SC", "Noto Sans Bengali", "DejaVu Sans", sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #000;
  }}
  .loa-header {{
    padding-bottom: 10pt;
    margin-bottom: 24pt;
    border-bottom: 1pt solid #000;
  }}
  .loa-body {{ }}
  .loa-footer {{ margin-top: 32pt; }}
</style>
</head>
<body>
  <div class="loa-header">{header_rendered}</div>
  <div class="loa-body">{body}</div>
  <div class="loa-footer">{footer_rendered}</div>
</body>
</html>"""

    return HTML(string=full_html).write_pdf()


# ---------------------------------------------------------------------------
# Receipt / Invoice generation (WeasyPrint) — Stage 1 of the receipt redesign.
#
# This service is a dumb renderer: NestJS pre-formats every currency string
# (subtotal/fee/total/line item amounts) and resolves the logo-fallback
# chain / accent color / FX line. We only interpolate, HTML-escape, and lay
# out. See .planning/receipt-redesign-plan.md for the full data contract.
# ---------------------------------------------------------------------------

_ACCENT_HEX_RE = re.compile(r'^#[0-9A-Fa-f]{6}$')
_DEFAULT_ACCENT = '#26408B'

# Static, brand-independent CSS. Accent-driven colors (header band, table
# underline, grand-total tint) are applied via inline styles per element
# instead of CSS custom properties, to avoid relying on WeasyPrint's
# var() support. Layout uses tables/inline-block only — no flexbox/grid.
_RECEIPT_CSS = """
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Noto Sans", "Noto Sans Arabic", "Noto Sans CJK SC", "Noto Sans Bengali", "DejaVu Sans", sans-serif;
    color: #1A1D24;
    font-size: 13px;
    line-height: 1.5;
  }
  .num { font-variant-numeric: tabular-nums; }
  .band td { padding: 26px 40px 22px; vertical-align: top; color: #fff; }
  .brand-name { font-size: 15px; font-weight: 650; letter-spacing: .2px; }
  .brand-sub { font-size: 11.5px; color: rgba(255,255,255,.72); margin-top: 2px; }
  .doc-title { font-size: 15px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; margin-bottom: 8px; }
  .doc-label { font-size: 11px; color: rgba(255,255,255,.68); }
  .doc-value { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
  .body { padding: 30px 40px 12px; }
  .eyebrow { font-size: 10.5px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: #8A929E; margin-bottom: 7px; }
  .party-name { font-size: 14.5px; font-weight: 650; }
  .party-line { color: #5B6472; font-size: 12.5px; margin-top: 3px; }
  .status-pill { display: inline-block; font-size: 11.5px; font-weight: 700; letter-spacing: .4px; padding: 4px 10px; border-radius: 999px; text-transform: uppercase; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 22px; }
  table.items th { font-size: 10.5px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #8A929E; text-align: left; padding: 0 0 10px; }
  table.items th.r { text-align: right; }
  table.items td { padding: 14px 0; border-bottom: 1px solid #E4E7EC; vertical-align: top; }
  table.items td.r { text-align: right; }
  .item-title { font-weight: 600; font-size: 13.5px; }
  .item-sub { color: #5B6472; font-size: 12px; margin-top: 3px; }
  .totals-row td { padding: 6px 0; font-size: 13px; color: #5B6472; }
  .totals-row td.v { text-align: right; color: #1A1D24; font-weight: 500; }
  .grand-k { font-size: 12px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; }
  .grand-v { font-size: 22px; font-weight: 750; letter-spacing: -.3px; }
  .seal { width: 108px; height: 108px; border-radius: 50%; border: 3px solid #0F7A4A; color: #0F7A4A; text-align: center; transform: rotate(-9deg); opacity: .85; margin: 0 auto; }
  .seal b { display: block; font-size: 25px; font-weight: 800; letter-spacing: 3px; padding-top: 32px; }
  .seal small { display: block; font-size: 8.5px; letter-spacing: 1.5px; margin-top: 2px; }
  .method-k { font-size: 10.5px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #8A929E; margin-bottom: 5px; }
  .method-v { font-size: 13px; font-weight: 550; }
  .foot { color: #5B6472; font-size: 11.5px; line-height: 1.55; }
  .foot strong { color: #1A1D24; font-weight: 650; display: block; margin-bottom: 3px; font-size: 12px; }
  .foot .note { text-align: right; color: #8A929E; }
"""


def _esc(value: Any) -> str:
    """HTML-escape any interpolated field; None becomes an empty string."""
    if value is None:
        return ''
    return html.escape(str(value))


def _valid_accent(color: Optional[str]) -> str:
    """Validate a brand accent hex color, falling back to the YBB default."""
    if color and _ACCENT_HEX_RE.match(color):
        return color
    return _DEFAULT_ACCENT


def _receipt_mark_html(logo_url: str, initials: str, accent: str) -> str:
    """Program logo tile, or an accent-colored monogram when no logo is set."""
    if logo_url:
        return (
            f'<div style="width:52px;height:52px;border-radius:12px;background:#fff;padding:7px;">'
            f'{_img_tag(logo_url, "38pt")}</div>'
        )
    initials_safe = _esc((initials or '?')[:3].upper())
    return (
        f'<div style="width:52px;height:52px;border-radius:12px;background:{accent};'
        f'color:#fff;text-align:center;line-height:52px;font-size:18px;font-weight:700;'
        f'letter-spacing:.5px;">{initials_safe}</div>'
    )


def _build_receipt_header_html(payload: Dict[str, Any], accent: str) -> str:
    """Accent header band: program logo/name left, doc title/number right."""
    program_name = _esc(payload.get('program_name'))
    mark_html = _receipt_mark_html(payload.get('program_logo_url') or '', payload.get('program_initials') or '', accent)

    is_receipt = payload.get('doc_type') == 'receipt' and bool(payload.get('is_paid'))
    title = 'PAYMENT RECEIPT' if is_receipt else 'INVOICE'
    number_label = 'Receipt No.' if is_receipt else 'Invoice No.'
    doc_number = _esc(payload.get('document_number'))
    issued_date = _esc(payload.get('issued_date'))

    return f"""<table class="band" style="width:100%;border-collapse:collapse;background:{accent};">
  <tr>
    <td style="width:60%;">
      <table style="border-collapse:collapse;"><tr>
        <td style="vertical-align:middle;padding-right:14px;">{mark_html}</td>
        <td style="vertical-align:middle;">
          <div class="brand-name">{program_name}</div>
          <div class="brand-sub">A YBB Platform Program</div>
        </td>
      </tr></table>
    </td>
    <td style="width:40%;text-align:right;">
      <div class="doc-title">{title}</div>
      <div class="doc-label">{number_label}</div>
      <div class="doc-value num">{doc_number}</div>
      <div class="doc-label">Issued</div>
      <div class="doc-value num">{issued_date}</div>
    </td>
  </tr>
</table>"""


def _build_parties_status_html(payload: Dict[str, Any]) -> str:
    """Two-column 'Billed to' / status block, table-based (no flex/grid)."""
    billed = payload.get('billed_to') or {}
    name = _esc(billed.get('name'))
    email_html = f'<div class="party-line">{_esc(billed.get("email"))}</div>' if billed.get('email') else ''
    inst_html = f'<div class="party-line">{_esc(billed.get("institution"))}</div>' if billed.get('institution') else ''

    is_paid = bool(payload.get('is_paid'))
    status_label = _esc(payload.get('status_label') or ('Paid' if is_paid else 'Unpaid'))
    pill_bg, pill_fg = ('#E7F3EC', '#0F7A4A') if is_paid else ('#FFF4E5', '#B45309')
    sub_line = payload.get('settled_line') if is_paid else payload.get('due_line')
    sub_html = f'<div class="party-line" style="margin-top:8px;">{_esc(sub_line)}</div>' if sub_line else ''

    return f"""<div style="border-bottom:1px solid #E4E7EC;padding-bottom:24px;">
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="width:50%;vertical-align:top;">
        <div class="eyebrow">Billed To</div>
        <div class="party-name">{name}</div>
        {email_html}
        {inst_html}
      </td>
      <td style="width:50%;vertical-align:top;text-align:right;">
        <div class="eyebrow">Status</div>
        <span class="status-pill" style="background:{pill_bg};color:{pill_fg};">{status_label}</span>
        {sub_html}
      </td>
    </tr>
  </table>
</div>"""


def _build_line_items_html(payload: Dict[str, Any], accent: str) -> str:
    """Itemized table with an accent-colored underline beneath the header row."""
    rows = []
    for item in (payload.get('line_items') or []):
        subtitle = item.get('subtitle')
        sub_html = f'<div class="item-sub">{_esc(subtitle)}</div>' if subtitle else ''
        rows.append(f"""<tr>
      <td><div class="item-title">{_esc(item.get('title'))}</div>{sub_html}</td>
      <td class="r num" style="font-weight:600;">{_esc(item.get('amount'))}</td>
    </tr>""")

    border = f'border-bottom:1.5px solid {accent};'
    return f"""<table class="items">
  <thead>
    <tr>
      <th style="{border}">Description</th>
      <th class="r" style="{border}">Amount</th>
    </tr>
  </thead>
  <tbody>
    {''.join(rows)}
  </tbody>
</table>"""


def _build_paid_seal_html() -> str:
    """Rotated circular 'PAID' seal — only rendered for a paid receipt."""
    from datetime import datetime as _dt
    year = _dt.utcnow().strftime('%Y')
    return f'<div class="seal"><b>PAID</b><small>YBB &middot; {year}</small></div>'


def _build_totals_seal_html(payload: Dict[str, Any], accent: str) -> str:
    """Totals box (accent-tinted grand total) with the PAID seal to its left."""
    is_paid = bool(payload.get('is_paid'))
    show_seal = payload.get('doc_type') == 'receipt' and is_paid
    fee = payload.get('fee')
    show_fee = bool(fee) and str(fee).strip() not in ('', '0')
    fx_line = payload.get('fx_line')

    fee_row = (
        f'<tr class="totals-row"><td>Processing fee</td><td class="v num">{_esc(fee)}</td></tr>'
        if show_fee else ''
    )
    fx_html = (
        f'<div style="text-align:right;color:#8A929E;font-size:11px;margin-top:6px;">{_esc(fx_line)}</div>'
        if fx_line else ''
    )
    grand_label = 'Total Paid' if is_paid else 'Amount Due'

    box_html = f"""<table style="width:100%;border-collapse:collapse;">
    <tr class="totals-row"><td>Subtotal</td><td class="v num">{_esc(payload.get('subtotal'))}</td></tr>
    {fee_row}
  </table>
  <table style="width:100%;border-collapse:collapse;margin-top:8px;background:{accent}14;border-radius:8px;">
    <tr>
      <td class="grand-k" style="padding:14px 16px;color:{accent};">{grand_label}</td>
      <td class="grand-v num" style="padding:14px 16px;text-align:right;color:{accent};">{_esc(payload.get('total'))}</td>
    </tr>
  </table>
  {fx_html}"""

    seal_html = _build_paid_seal_html() if show_seal else ''
    return f"""<table style="width:100%;border-collapse:collapse;margin-top:20px;">
  <tr>
    <td style="width:120px;vertical-align:middle;">{seal_html}</td>
    <td style="vertical-align:top;">{box_html}</td>
  </tr>
</table>"""


def _build_payment_method_html(payload: Dict[str, Any]) -> str:
    """Two-column payment-method / transaction-reference row, omitted if empty."""
    method_label = payload.get('payment_method_label')
    txn_ref = payload.get('transaction_reference')
    if not method_label and not txn_ref:
        return ''

    method_html = f'<div class="method-k">Payment Method</div><div class="method-v">{_esc(method_label)}</div>' if method_label else ''
    txn_html = f'<div class="method-k">Transaction Reference</div><div class="method-v num">{_esc(txn_ref)}</div>' if txn_ref else ''

    return f"""<table style="width:100%;border-collapse:collapse;margin-top:26px;border-top:1px solid #E4E7EC;">
  <tr>
    <td style="width:50%;vertical-align:top;padding-top:18px;">{method_html}</td>
    <td style="width:50%;vertical-align:top;padding-top:18px;">{txn_html}</td>
  </tr>
</table>"""


def _build_receipt_footer_html(payload: Dict[str, Any], accent: str) -> str:
    """Brand-contact footer + accent rule at the very bottom of the sheet."""
    brand = payload.get('brand') or {}
    contact_bits = [b for b in (brand.get('contact_email'), brand.get('contact_phone'), brand.get('website')) if b]
    contact_line = ' &middot; '.join(_esc(b) for b in contact_bits)
    address = brand.get('contact_address')

    contact_html = ''
    if brand.get('name') or contact_line or address:
        contact_html = f'<div><strong>{_esc(brand.get("name"))}</strong>'
        contact_html += f'{contact_line}<br>' if contact_line else ''
        contact_html += _esc(address) if address else ''
        contact_html += '</div>'

    is_paid = bool(payload.get('is_paid'))
    note = (
        'This receipt was generated automatically as proof of payment. Please retain it for your records.'
        if is_paid else
        'Please complete payment before the due date shown above. This document is not proof of payment.'
    )

    return f"""<table class="foot" style="width:100%;border-collapse:collapse;margin-top:8px;">
  <tr>
    <td style="padding:20px 40px 30px;vertical-align:bottom;">{contact_html}</td>
    <td class="note" style="padding:20px 40px 30px;vertical-align:bottom;width:220px;">{note}</td>
  </tr>
</table>
<div style="height:5px;background:{accent};"></div>"""


def generate_receipt_weasy_sync(payload: Dict[str, Any]) -> bytes:
    """Generate a receipt (paid) or invoice (unpaid) PDF via WeasyPrint.

    `payload` matches the Stage 1 data contract in
    .planning/receipt-redesign-plan.md exactly. All amounts arrive as
    pre-formatted strings from NestJS — no currency math happens here.
    """
    from weasyprint import HTML  # type: ignore

    accent = _valid_accent(payload.get('accent_color'))

    header_html = _build_receipt_header_html(payload, accent)
    parties_html = _build_parties_status_html(payload)
    items_html = _build_line_items_html(payload, accent)
    totals_html = _build_totals_seal_html(payload, accent)
    method_html = _build_payment_method_html(payload)
    footer_html = _build_receipt_footer_html(payload, accent)

    full_html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {{ size: A4; margin: 0; }}
  {_RECEIPT_CSS}
</style>
</head>
<body>
  {header_html}
  <div class="body">
    {parties_html}
    {items_html}
    {totals_html}
    {method_html}
  </div>
  {footer_html}
</body>
</html>"""

    return HTML(string=full_html).write_pdf()


class PDFGeneratorService:
    """Service for generating PDF documents."""
    
    def __init__(self):
        """Initialize PDF generator."""
        # Initializing styles here only for verifying logic if needed, 
        # actual generation happens in the separate process which reinits styles
        pass
    
    async def generate_receipt(
        self,
        transaction_data: Dict[str, Any]
    ) -> BytesIO:
        """Generate payment receipt PDF using ProcessPool."""
        pdf_bytes = await run_in_processpool(generate_receipt_sync, transaction_data)
        return BytesIO(pdf_bytes)

    async def generate_receipt_weasy(
        self,
        payload: Dict[str, Any]
    ) -> BytesIO:
        """Generate a receipt/invoice PDF (WeasyPrint) using ProcessPool."""
        pdf_bytes = await run_in_processpool(generate_receipt_weasy_sync, payload)
        return BytesIO(pdf_bytes)

    async def generate_offer_letter(
        self,
        participant_data: Dict[str, Any],
        program_data: Dict[str, Any]
    ) -> BytesIO:
        """Generate offer letter PDF using ProcessPool."""
        pdf_bytes = await run_in_processpool(
            generate_offer_letter_sync,
            participant_data,
            program_data
        )
        return BytesIO(pdf_bytes)
    
    async def generate_from_template(
        self,
        template_html: str,
        data: Dict[str, Any]
    ) -> BytesIO:
        """Generate PDF from HTML template using Jinja2 using ProcessPool."""
        pdf_bytes = await run_in_processpool(
            generate_from_template_sync,
            template_html,
            data
        )
        return BytesIO(pdf_bytes)

    async def generate_loa(
        self,
        html_content: str,
        header_html: str,
        footer_html: str,
        page_size: str,
        margins: Dict[str, Any],
        placeholder_data: Dict[str, Any],
        document_number: str,
        logo_url: str = "",
        signature_url: str = "",
        stamp_url: str = "",
        signer_name: str = "",
        signer_title: str = "",
        header: Optional[Dict[str, Any]] = None,
    ) -> BytesIO:
        """Generate LOA PDF from Tiptap HTML using WeasyPrint."""
        pdf_bytes = await run_in_processpool(
            generate_loa_sync,
            html_content,
            header_html,
            footer_html,
            page_size,
            margins,
            placeholder_data,
            document_number,
            logo_url=logo_url,
            signature_url=signature_url,
            stamp_url=stamp_url,
            signer_name=signer_name,
            signer_title=signer_title,
            header=header,
        )
        return BytesIO(pdf_bytes)
