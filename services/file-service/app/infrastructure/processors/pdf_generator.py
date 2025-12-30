"""PDF document generation service."""
# type: ignore
from typing import Dict, Any, Optional
from reportlab.lib.pagesizes import letter, A4  # type: ignore
from reportlab.lib.units import inch  # type: ignore
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle  # type: ignore
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT  # type: ignore
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image  # type: ignore
from reportlab.lib import colors  # type: ignore
from io import BytesIO
from datetime import datetime
from jinja2 import Template  # type: ignore
from app.utils.concurrency import run_in_threadpool


class PDFGeneratorService:
    """Service for generating PDF documents."""
    
    def __init__(self):
        """Initialize PDF generator."""
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Setup custom paragraph styles."""
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Title'],
            fontSize=24,
            textColor=colors.HexColor('#366092'),
            spaceAfter=30,
            alignment=TA_CENTER
        ))
        
        self.styles.add(ParagraphStyle(
            name='CustomHeading',
            parent=self.styles['Heading1'],
            fontSize=16,
            textColor=colors.HexColor('#366092'),
            spaceAfter=12,
        ))
    
    async def generate_receipt(
        self,
        transaction_data: Dict[str, Any]
    ) -> BytesIO:
        """Generate payment receipt PDF."""
        return await run_in_threadpool(self._generate_receipt_sync, transaction_data)

    def _generate_receipt_sync(
        self,
        transaction_data: Dict[str, Any]
    ) -> BytesIO:
        """Generate payment receipt PDF (synchronous implementation)."""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        story = []
        
        # Title
        title = Paragraph("Payment Receipt", self.styles['CustomTitle'])
        story.append(title)
        story.append(Spacer(1, 0.3 * inch))
        
        # Receipt details
        data = [
            ['Receipt #:', transaction_data.get('receipt_number', 'N/A')],
            ['Date:', transaction_data.get('date', datetime.utcnow().strftime('%Y-%m-%d'))],
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
        ]))
        
        story.append(table)
        story.append(Spacer(1, 0.5 * inch))
        
        # Footer
        footer_text = f"This is an automatically generated receipt. Generated on {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}"
        footer = Paragraph(footer_text, self.styles['Normal'])
        story.append(footer)
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer
    
    async def generate_offer_letter(
        self,
        participant_data: Dict[str, Any],
        program_data: Dict[str, Any]
    ) -> BytesIO:
        """Generate offer letter PDF."""
        return await run_in_threadpool(
            self._generate_offer_letter_sync,
            participant_data,
            program_data
        )

    def _generate_offer_letter_sync(
        self,
        participant_data: Dict[str, Any],
        program_data: Dict[str, Any]
    ) -> BytesIO:
        """Generate offer letter PDF (synchronous implementation)."""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*inch)
        story = []
        
        # Date
        date_text = f"Date: {datetime.utcnow().strftime('%B %d, %Y')}"
        story.append(Paragraph(date_text, self.styles['Normal']))
        story.append(Spacer(1, 0.3 * inch))
        
        # Recipient
        recipient_lines = [
            participant_data.get('name', ''),
            participant_data.get('address', ''),
            participant_data.get('city', ''),
        ]
        for line in recipient_lines:
            if line:
                story.append(Paragraph(line, self.styles['Normal']))
        
        story.append(Spacer(1, 0.3 * inch))
        
        # Subject
        subject = f"<b>Subject: Offer of Admission - {program_data.get('name', '')}</b>"
        story.append(Paragraph(subject, self.styles['Normal']))
        story.append(Spacer(1, 0.2 * inch))
        
        # Salutation
        salutation = f"Dear {participant_data.get('name', '')},"
        story.append(Paragraph(salutation, self.styles['Normal']))
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
        
        story.append(Paragraph(body_text, self.styles['Normal']))
        story.append(Spacer(1, 0.3 * inch))
        
        # Signature
        story.append(Paragraph("Sincerely,", self.styles['Normal']))
        story.append(Spacer(1, 0.5 * inch))
        story.append(Paragraph("<b>Program Director</b>", self.styles['Normal']))
        story.append(Paragraph("Young Business Bootcamp", self.styles['Normal']))
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer
    
    async def generate_from_template(
        self,
        template_html: str,
        data: Dict[str, Any]
    ) -> BytesIO:
        """Generate PDF from HTML template using Jinja2."""
        return await run_in_threadpool(
            self._generate_from_template_sync,
            template_html,
            data
        )

    def _generate_from_template_sync(
        self,
        template_html: str,
        data: Dict[str, Any]
    ) -> BytesIO:
        """Generate PDF from HTML template using Jinja2 (synchronous implementation)."""
        # Render template with data
        template = Template(template_html)
        rendered_html = template.render(**data)
        
        # This would use weasyprint for HTML to PDF conversion
        # For now, returning a simple implementation
        # In production, you'd use: HTML(string=rendered_html).write_pdf()
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        story = []
        
        # Parse and add rendered content (simplified)
        story.append(Paragraph(rendered_html, self.styles['Normal']))
        
        doc.build(story)
        buffer.seek(0)
        return buffer
