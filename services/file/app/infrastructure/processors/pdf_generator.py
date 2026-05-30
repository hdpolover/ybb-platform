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


def generate_loa_sync(
    html_content: str,
    header_html: str,
    footer_html: str,
    page_size: str,
    margins: Dict[str, Any],
    placeholder_data: Dict[str, Any],
    document_number: str,
) -> bytes:
    """Generate LOA PDF from Tiptap HTML using WeasyPrint."""
    from weasyprint import HTML, CSS  # type: ignore

    def replace_tokens(text: str) -> str:
        for key, value in placeholder_data.items():
            text = text.replace(key, str(value) if value is not None else '')
        return text

    body = replace_tokens(html_content)
    header = replace_tokens(header_html or '')
    footer = replace_tokens(footer_html or '')

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
  <div class="loa-header">{header}</div>
  <div class="loa-body">{body}</div>
  <div class="loa-footer">{footer}</div>
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
        )
        return BytesIO(pdf_bytes)
