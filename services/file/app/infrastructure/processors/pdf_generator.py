"""PDF document generation service."""
# type: ignore
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


def _img_tag(url: str, max_height: str) -> str:
    """Build a WeasyPrint-renderable <img> tag for a stored asset URL.

    WeasyPrint fetches http(s) image sources itself, so a plain <img src="...">
    (same convention the admin template preview already uses for {{logo}} /
    {{signature}}) is sufficient — no base64 inlining needed.
    """
    if not url:
        return ''
    return f'<img src="{url}" style="max-height:{max_height};max-width:100%;display:block;" />'


def _build_structured_header_html(header: Dict[str, Any], logo_url: str) -> str:
    """JYS-style 3-column header: logo left, program name/batch centered, contact right."""
    logo_cell = _img_tag(logo_url, '60pt')
    program_name = header.get('program_name') or ''
    batch = header.get('batch') or ''
    tagline = header.get('tagline') or ''
    website = header.get('website') or ''
    email = header.get('email') or ''
    phone = header.get('phone') or ''

    title_line = program_name
    if batch:
        title_line = f'{program_name} &mdash; Batch {batch}' if program_name else f'Batch {batch}'
    tagline_html = f'<div style="font-style:italic;font-size:9pt;margin-top:2pt;">{tagline}</div>' if tagline else ''

    contact_rows = ''.join(f'<div>{value}</div>' for value in (website, email, phone) if value)

    return f"""<table style="width:100%;border-collapse:collapse;">
  <tr>
    <td style="width:20%;vertical-align:middle;text-align:left;">{logo_cell}</td>
    <td style="width:60%;vertical-align:middle;text-align:center;">
      <div style="font-weight:bold;font-size:14pt;">{title_line}</div>
      {tagline_html}
    </td>
    <td style="width:20%;vertical-align:middle;text-align:right;font-size:9pt;">{contact_rows}</td>
  </tr>
</table>"""


def _build_signer_html(signature_url: str, stamp_url: str, signer_name: str, signer_title: str) -> str:
    """Stamp above signature, then signer name (bold) and title beneath."""
    stamp_cell = _img_tag(stamp_url, '70pt')
    signature_cell = _img_tag(signature_url, '50pt')
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
        image_tokens['{{logo}}'] = _img_tag(logo_url, '60pt')
    if signature_url:
        image_tokens['{{signature}}'] = _img_tag(signature_url, '50pt')
    if stamp_url:
        image_tokens['{{stamp}}'] = _img_tag(stamp_url, '70pt')
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
  .loa-header {{ margin-bottom: 24pt; }}
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
