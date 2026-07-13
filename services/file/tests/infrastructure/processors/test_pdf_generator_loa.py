# services/file/tests/infrastructure/processors/test_pdf_generator_loa.py
"""LOA header/footer markup contract.

These cover the pure HTML builders, not the WeasyPrint render, so they run
without the PDF toolchain installed.
"""
import pytest

from app.infrastructure.processors.pdf_generator import (
    _build_signer_html,
    _build_structured_header_html,
    _img_tag,
)

LOGO = "https://cdn.example.com/logo.png"
STAMP = "https://cdn.example.com/stamp.png"
SIGNATURE = "https://cdn.example.com/signature.png"

# Mirrors the shape actually stored in prod document_templates.layout_config.
HEADER_CONFIG = {
    "website": "www.youthacademicforum.com",
    "email": "info@ybbfoundation.com",
    "phone": "0882005909333",
    "tagline": "#Collaboration InDiversity",
    "program_name": "Japan Youth Summit 2026",
    "batch": "2",
}


class TestImgTag:
    def test_block_image_is_left_aligned_by_default(self):
        assert "margin:0 auto" not in _img_tag(LOGO, "60pt")

    def test_centered_image_gets_auto_margins(self):
        # A display:block image ignores the parent's text-align, so centering
        # has to come from the margins or it silently hugs the left edge.
        assert "margin:0 auto" in _img_tag(LOGO, "60pt", center=True)

    def test_empty_url_renders_nothing(self):
        assert _img_tag("", "60pt", center=True) == ""


class TestStructuredHeader:
    def test_batch_sits_on_its_own_line_under_the_program_name(self):
        html = _build_structured_header_html(HEADER_CONFIG, LOGO)
        assert "<div>Japan Youth Summit 2026</div><div>Batch 2</div>" in html

    def test_program_name_and_batch_are_not_joined_by_a_dash(self):
        html = _build_structured_header_html(HEADER_CONFIG, LOGO)
        assert "&mdash;" not in html

    def test_three_columns_logo_left_title_center_contact_right(self):
        html = _build_structured_header_html(HEADER_CONFIG, LOGO)
        assert "text-align:left;\">" in html and LOGO in html
        assert "text-align:center;\">" in html
        assert "text-align:right" in html
        for contact in ("www.youthacademicforum.com", "info@ybbfoundation.com", "0882005909333"):
            assert contact in html

    def test_batch_only_when_program_name_missing(self):
        html = _build_structured_header_html({"batch": "2"}, LOGO)
        assert "<div>Batch 2</div>" in html

    def test_omits_empty_optional_fields(self):
        html = _build_structured_header_html({"program_name": "Solo Program"}, "")
        assert "<img" not in html
        assert "font-style:italic" not in html


class TestSignerFooter:
    def test_stamp_is_centered_not_left_hugging(self):
        html = _build_signer_html("", STAMP, "", "")
        assert "margin:0 auto" in html

    def test_signature_is_centered(self):
        html = _build_signer_html(SIGNATURE, "", "", "")
        assert "margin:0 auto" in html

    def test_stamp_renders_above_signature(self):
        html = _build_signer_html(SIGNATURE, STAMP, "Muhammad Aldi Subakti", "Chairman")
        assert html.index(STAMP) < html.index(SIGNATURE)

    def test_signer_name_and_title_render_beneath_the_marks(self):
        html = _build_signer_html(SIGNATURE, STAMP, "Muhammad Aldi Subakti", "Chairman")
        assert "<div style=\"font-weight:bold;\">Muhammad Aldi Subakti</div>" in html
        assert "<div>Chairman</div>" in html
        assert html.index(SIGNATURE) < html.index("Muhammad Aldi Subakti")

    @pytest.mark.parametrize("signature,stamp", [("", ""), (SIGNATURE, ""), ("", STAMP)])
    def test_missing_assets_do_not_emit_empty_img_tags(self, signature, stamp):
        # Prod templates today carry a stamp but no signature; the absent one
        # must not leave a broken <img> behind.
        html = _build_signer_html(signature, stamp, "", "")
        assert html.count("<img") == bool(signature) + bool(stamp)
