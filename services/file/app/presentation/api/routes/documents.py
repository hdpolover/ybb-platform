"""Document generation routes."""
# type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response  # type: ignore
from typing import List, Dict, Any, Optional
from pydantic import BaseModel  # type: ignore
from app.infrastructure.processors.excel_export import ExcelExportService
from app.infrastructure.processors.pdf_generator import PDFGeneratorService
from app.infrastructure.processors.certificate_generator import CertificateGeneratorService
from app.presentation.dependencies.container import (
    get_excel_export_service,
    get_pdf_generator_service,
    get_certificate_generator_service
)


router = APIRouter(prefix="/documents", tags=["Documents"])


# Request models
class ParticipantReportRequest(BaseModel):
    participants: List[Dict[str, Any]]
    program_name: str


class PaymentReportRequest(BaseModel):
    payments: List[Dict[str, Any]]
    program_name: str
    start_date: str
    end_date: str


class CustomReportRequest(BaseModel):
    data: List[Dict[str, Any]]
    title: str
    headers: List[str]
    sheet_name: str = "Report"


class ReceiptBilledTo(BaseModel):
    name: str = ""
    email: Optional[str] = None
    institution: Optional[str] = None


class ReceiptLineItem(BaseModel):
    title: str = ""
    subtitle: Optional[str] = None
    amount: str = ""


class ReceiptBrand(BaseModel):
    name: str = ""
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_address: Optional[str] = None
    website: Optional[str] = None


class ReceiptWeasyRequest(BaseModel):
    """Stage 1 data contract for the WeasyPrint receipt/invoice generator.

    NestJS pre-formats every currency string (subtotal/fee/total/line item
    amounts) and resolves logo fallback / accent color / FX line — this
    model is a dumb pass-through, matching
    .planning/receipt-redesign-plan.md exactly.
    """
    doc_type: str  # "receipt" | "invoice"
    status_label: str = ""
    is_paid: bool = False
    document_number: str = ""
    issued_date: str = ""
    settled_line: Optional[str] = None
    due_line: Optional[str] = None
    transaction_reference: Optional[str] = None
    accent_color: Optional[str] = None
    program_name: str = ""
    program_logo_url: Optional[str] = None
    program_initials: str = ""
    billed_to: ReceiptBilledTo
    line_items: List[ReceiptLineItem] = []
    subtotal: str = ""
    fee: Optional[str] = None
    total: str = ""
    fx_line: Optional[str] = None
    payment_method_label: Optional[str] = None
    brand: ReceiptBrand


class OfferLetterRequest(BaseModel):
    participant_data: Dict[str, Any]
    program_data: Dict[str, Any]


class CertificateRequest(BaseModel):
    participant_data: Dict[str, Any]
    program_data: Dict[str, Any]
    certificate_type: str = "completion"  # completion or participation


class LoaHeaderConfig(BaseModel):
    program_name: str = ""
    batch: str = ""
    tagline: str = ""
    website: str = ""
    email: str = ""
    phone: str = ""


class LoaRequest(BaseModel):
    html_content: str
    header_html: str = ""
    footer_html: str = ""
    page_size: str = "A4"
    margins: Dict[str, Any] = {"top": 40, "right": 40, "bottom": 40, "left": 40}
    placeholder_data: Dict[str, Any] = {}
    document_number: str = ""
    # Stage 1: legacy single logo/signature/stamp images forwarded from
    # document_templates.layout_config. Stage 2 will replace signer_name/
    # signer_title with data sourced from a real multi-signature record.
    logo_url: str = ""
    signature_url: str = ""
    stamp_url: str = ""
    signer_name: str = ""
    signer_title: str = ""
    header: Optional[LoaHeaderConfig] = None


# Excel Export Endpoints
@router.post("/export/participants")
async def export_participant_report(
    request: ParticipantReportRequest,
    excel_service: ExcelExportService = Depends(get_excel_export_service)
):
    """Export participant list to Excel."""
    try:
        excel_file = await excel_service.generate_participant_report(
            request.participants,
            request.program_name
        )
        
        return Response(
            content=excel_file.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=participants_{request.program_name}.xlsx"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")


@router.post("/export/payments")
async def export_payment_report(
    request: PaymentReportRequest,
    excel_service: ExcelExportService = Depends(get_excel_export_service)
):
    """Export payment report to Excel."""
    try:
        excel_file = await excel_service.generate_payment_report(
            request.payments,
            request.program_name,
            request.start_date,
            request.end_date
        )
        
        return Response(
            content=excel_file.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=payments_{request.program_name}.xlsx"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")


@router.post("/export/custom")
async def export_custom_report(
    request: CustomReportRequest,
    excel_service: ExcelExportService = Depends(get_excel_export_service)
):
    """Export custom report to Excel."""
    try:
        excel_file = await excel_service.generate_custom_report(
            request.data,
            request.title,
            request.headers,
            request.sheet_name
        )
        
        return Response(
            content=excel_file.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={request.sheet_name}.xlsx"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")


# PDF Generation Endpoints
@router.post("/generate/receipt")
async def generate_receipt(
    request: ReceiptWeasyRequest,
    pdf_service: PDFGeneratorService = Depends(get_pdf_generator_service)
):
    """Generate a receipt (paid) or invoice (unpaid) PDF via WeasyPrint."""
    try:
        pdf_file = await pdf_service.generate_receipt_weasy(request.model_dump())

        filename_prefix = "receipt" if request.doc_type == "receipt" else "invoice"
        filename = f"{filename_prefix}_{request.document_number or 'document'}.pdf"
        return Response(
            content=pdf_file.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate receipt: {str(e)}")


@router.post("/generate/offer-letter")
async def generate_offer_letter(
    request: OfferLetterRequest,
    pdf_service: PDFGeneratorService = Depends(get_pdf_generator_service)
):
    """Generate offer letter PDF."""
    try:
        pdf_file = await pdf_service.generate_offer_letter(
            request.participant_data,
            request.program_data
        )
        
        participant_name = request.participant_data.get('name', 'participant').replace(' ', '_')
        return Response(
            content=pdf_file.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=offer_letter_{participant_name}.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate offer letter: {str(e)}")


@router.post("/generate/loa")
async def generate_loa(
    request: LoaRequest,
    pdf_service: PDFGeneratorService = Depends(get_pdf_generator_service)
):
    """Generate Letter of Acceptance PDF from Tiptap HTML template."""
    try:
        pdf_file = await pdf_service.generate_loa(
            html_content=request.html_content,
            header_html=request.header_html,
            footer_html=request.footer_html,
            page_size=request.page_size,
            margins=request.margins,
            placeholder_data=request.placeholder_data,
            document_number=request.document_number,
            logo_url=request.logo_url,
            signature_url=request.signature_url,
            stamp_url=request.stamp_url,
            signer_name=request.signer_name,
            signer_title=request.signer_title,
            header=request.header.model_dump() if request.header else None,
        )
        filename = f"loa_{request.document_number or 'document'}.pdf"
        return Response(
            content=pdf_file.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate LOA: {str(e)}")


# Certificate Generation Endpoints
@router.post("/generate/certificate")
async def generate_certificate(
    request: CertificateRequest,
    cert_service: CertificateGeneratorService = Depends(get_certificate_generator_service)
):
    """Generate certificate (completion or participation)."""
    try:
        if request.certificate_type == "completion":
            cert_file = await cert_service.generate_completion_certificate(
                request.participant_data,
                request.program_data
            )
        elif request.certificate_type == "participation":
            cert_file = await cert_service.generate_participation_certificate(
                request.participant_data,
                request.program_data
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid certificate type")
        
        participant_name = request.participant_data.get('name', 'participant').replace(' ', '_')
        return Response(
            content=cert_file.getvalue(),
            media_type="image/png",
            headers={
                "Content-Disposition": f"attachment; filename=certificate_{participant_name}.png"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate certificate: {str(e)}")


@router.get("/verify/{verification_hash}")
async def verify_certificate(
    verification_hash: str,
    cert_service: CertificateGeneratorService = Depends(get_certificate_generator_service)
):
    """Verify certificate authenticity.
    
    In a real implementation, you'd look up the certificate data from database.
    This is a simplified example.
    """
    return {
        "verification_hash": verification_hash,
        "message": "Certificate verification endpoint. Full implementation requires database lookup.",
        "status": "pending_implementation"
    }


@router.get("/health")
async def health_check():
    """Health check for document generation service."""
    return {
        "service": "Document Generation",
        "status": "healthy",
        "features": [
            "Excel export (participants, payments, custom)",
            "PDF generation (receipts, offer letters)",
            "Certificate generation (completion, participation)",
            "QR code verification"
        ]
    }
