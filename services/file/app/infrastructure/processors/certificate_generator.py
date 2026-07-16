"""Certificate generation service with QR code verification."""
# type: ignore
from typing import Dict, Any, Optional
from PIL import Image, ImageDraw, ImageFont  # type: ignore
from io import BytesIO
import qrcode  # type: ignore
import hashlib
from datetime import datetime
from app.utils.concurrency import run_in_threadpool


class CertificateGeneratorService:
    """Service for generating certificates."""
    
    def __init__(self, signing_key: str, verification_url: str):
        """Initialize certificate generator.
        
        Args:
            signing_key: Secret key for signing certificates
            verification_url: Base URL for certificate verification
        """
        self.signing_key = signing_key
        self.verification_url = verification_url
    
    def _generate_certificate_hash(
        self,
        participant_name: str,
        program_name: str,
        issue_date: str
    ) -> str:
        """Generate unique hash for certificate verification."""
        data = f"{participant_name}|{program_name}|{issue_date}|{self.signing_key}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    def _generate_qr_code(self, verification_hash: str) -> Image.Image:
        """Generate QR code for certificate verification."""
        verification_link = f"{self.verification_url}/verify/{verification_hash}"
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=2,
        )
        qr.add_data(verification_link)
        qr.make(fit=True)
        
        return qr.make_image(fill_color="black", back_color="white")
    
    async def generate_completion_certificate(
        self,
        participant_data: Dict[str, Any],
        program_data: Dict[str, Any],
        template_path: Optional[str] = None
    ) -> BytesIO:
        """Generate completion certificate."""
        return await run_in_threadpool(
            self._generate_completion_certificate_sync,
            participant_data,
            program_data,
            template_path
        )

    def _generate_certificate_sync(
        self,
        participant_data: Dict[str, Any],
        program_data: Dict[str, Any],
        template_type: str = "completion",
        template_path: Optional[str] = None
    ) -> BytesIO:
        """Generate certificate based on type (synchronous implementation).
        
        Args:
            participant_data: Dict with name, email, etc.
            program_data: Dict with program name, completion date, etc.
            template_type: Type of certificate (completion, participation, award)
            template_path: Optional path to certificate template image
        
        Returns:
            BytesIO containing the certificate image
        """
        # Create certificate dimensions (A4 landscape)
        width, height = 3508, 2480  # 297mm x 210mm at 300 DPI
        
        # Create blank certificate or load template
        if template_path:
            certificate = Image.open(template_path)
            certificate = certificate.resize((width, height))
        else:
            # Create default certificate
            certificate = Image.new('RGB', (width, height), color='white')
            draw = ImageDraw.Draw(certificate)
            
            # Add border
            border_color = (54, 96, 146)  # YBB blue
            draw.rectangle([100, 100, width-100, height-100], outline=border_color, width=20)
            draw.rectangle([120, 120, width-120, height-120], outline=border_color, width=5)
        
        draw = ImageDraw.Draw(certificate)
        
        # Load fonts
        try:
            # MacOS fonts
            title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 120)
            name_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 140)
            body_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 70)
            small_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 50)
        except:
             try:
                # Linux fonts (standard locations)
                title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 120)
                name_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 140)
                body_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 70)
                small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 50)
             except:
                # Fallback to default font
                title_font = ImageFont.load_default()
                name_font = ImageFont.load_default()
                body_font = ImageFont.load_default()
                small_font = ImageFont.load_default()
        
        # Determine text based on type
        participant_name = participant_data.get('name', 'Participant Name')
        program_name = program_data.get('name', 'Program Name')
        date_str = program_data.get('completion_date', datetime.utcnow().strftime('%B %d, %Y'))
        
        if template_type == "participation":
            title_text = "CERTIFICATE OF PARTICIPATION"
            subtitle_text = "This is to certify that"
            completion_text = "has actively participated in"
            date_text = f"Awarded on {date_str}"
        elif template_type == "award" or template_type == "winner":
            title_text = "CERTIFICATE OF ACHIEVEMENT"
            subtitle_text = "This award is presented to"
            # Get award title from metadata if available, otherwise generic
            award_title = participant_data.get('metadata', {}).get('award_title', 'Winner')
            completion_text = f"for being the {award_title} in"
            date_text = f"Awarded on {date_str}"
        elif template_type == "speaker":
            title_text = "CERTIFICATE OF APPRECIATION"
            subtitle_text = "This is presented to"
            completion_text = "for sharing valuable insights as a Speaker at"
            date_text = f"Given on {date_str}"
        else:
            # Default to Completion
            title_text = "CERTIFICATE OF COMPLETION"
            subtitle_text = "This is to certify that"
            completion_text = "has successfully completed"
            date_text = f"Completed on {date_str}"
        
        # Draw text (centered)
        text_color = (54, 96, 146)
        name_color = (0, 0, 0)
        
        # Layout Config
        # Title
        self._draw_centered_text(draw, title_text, title_font, text_color, width, 400)
        
        # Subtitle
        self._draw_centered_text(draw, subtitle_text, body_font, text_color, width, 650)
        
        # Participant name (bold/emphasized)
        self._draw_centered_text(draw, participant_name, name_font, name_color, width, 850)
        
        # Completion text
        self._draw_centered_text(draw, completion_text, body_font, text_color, width, 1100)
        
        # Program name
        self._draw_centered_text(draw, program_name, body_font, name_color, width, 1250)
        
        # Date
        self._draw_centered_text(draw, date_text, small_font, text_color, width, 1500)
        
        # Generate verification hash and QR code
        verification_hash = self._generate_certificate_hash(
            participant_name,
            program_name,
            date_str
        )
        
        qr_code = self._generate_qr_code(verification_hash)
        qr_code = qr_code.resize((300, 300))
        
        # Paste QR code (bottom right)
        certificate.paste(qr_code, (width - 450, height - 450))
        
        # Add verification text
        verification_text = f"Verification Code: {verification_hash}"
        self._draw_centered_text(draw, verification_text, small_font, text_color, width, height - 250)
        
        # Convert to BytesIO
        output = BytesIO()
        certificate.save(output, format='PNG', quality=95, dpi=(300, 300))
        output.seek(0)
        
        return output

    async def generate_certificate(
        self,
        participant_data: Dict[str, Any],
        program_data: Dict[str, Any],
        template_type: str = "completion",
        template_path: Optional[str] = None
    ) -> BytesIO:
        """Generate certificate."""
        return await run_in_threadpool(
            self._generate_certificate_sync,
            participant_data,
            program_data,
            template_type,
            template_path
        )

    # Legacy wrappers for compatibility
    async def generate_completion_certificate(
        self,
        participant_data: Dict[str, Any],
        program_data: Dict[str, Any],
        template_path: Optional[str] = None
    ) -> BytesIO:
        return await self.generate_certificate(participant_data, program_data, "completion", template_path)
    
    async def generate_participation_certificate(
        self,
        participant_data: Dict[str, Any],
        program_data: Dict[str, Any],
        template_path: Optional[str] = None
    ) -> BytesIO:
        return await self.generate_certificate(participant_data, program_data, "participation", template_path)

    
    def _draw_centered_text(
        self,
        draw: ImageDraw.ImageDraw,
        text: str,
        font: ImageFont.ImageFont,
        color: tuple,
        width: int,
        y_position: int
    ):
        """Draw text centered horizontally."""
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        x_position = (width - text_width) // 2
        draw.text((x_position, y_position), text, font=font, fill=color)
    
    def verify_certificate(self, verification_hash: str, certificate_data: Dict[str, Any]) -> bool:
        """Verify if a certificate is authentic.
        
        Args:
            verification_hash: The hash from the certificate
            certificate_data: Original certificate data
        
        Returns:
            True if certificate is valid, False otherwise
        """
        expected_hash = self._generate_certificate_hash(
            certificate_data.get('participant_name', ''),
            certificate_data.get('program_name', ''),
            certificate_data.get('issue_date', '')
        )
        
        return verification_hash == expected_hash
