# services/file/tests/infrastructure/processors/test_pdf_generator_loa.py
"""LOA header/footer markup contract.

These cover the pure HTML builders, not the WeasyPrint render, so they run
without the PDF toolchain installed.
"""
import base64
import io
from datetime import datetime

import pytest
from PyPDF2 import PdfReader

from app.infrastructure.processors.pdf_generator import (
    LOA_PAGE_FOOTER_EXTRA_BOTTOM_MARGIN_PT,
    _build_loa_html_document,
    _build_signer_html,
    _build_structured_header_html,
    _css_string_escape,
    _format_long_date,
    _img_tag,
    _is_effectively_empty_html,
    generate_loa_sync,
)

LOGO = "https://cdn.example.com/logo.png"
STAMP = "https://cdn.example.com/stamp.png"
SIGNATURE = "https://cdn.example.com/signature.png"

DEFAULT_MARGINS = {"top": 40, "right": 40, "bottom": 40, "left": 40}


def _build_html(**overrides):
    """Call `_build_loa_html_document` with sane defaults, overridable per test."""
    kwargs = {
        "html_content": "<p>Body content.</p>",
        "header_html": "",
        "footer_html": "",
        "page_size": "A4",
        "margins": DEFAULT_MARGINS,
        "placeholder_data": {},
    }
    kwargs.update(overrides)
    return _build_loa_html_document(**kwargs)

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
        assert "text-align:left" in html and LOGO in html
        assert "text-align:center" in html
        assert "text-align:right" in html
        # Logo cell precedes the title, which precedes the contact column.
        assert html.index(LOGO) < html.index("Japan Youth Summit 2026") < html.index("www.youthacademicforum.com")
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
        assert ">Chairman</div>" in html
        assert html.index(SIGNATURE) < html.index("Muhammad Aldi Subakti") < html.index("Chairman")

    def test_signature_rule_sits_above_the_signer_name(self):
        html = _build_signer_html(SIGNATURE, STAMP, "Muhammad Aldi Subakti", "Chairman")
        assert "border-top:0.75pt solid #000" in html
        assert html.index("border-top") < html.index("Muhammad Aldi Subakti")

    def test_no_signature_rule_without_a_signer_name(self):
        # A rule floating over empty space reads as a rendering fault.
        html = _build_signer_html(SIGNATURE, STAMP, "", "")
        assert "border-top" not in html

    @pytest.mark.parametrize("signature,stamp", [("", ""), (SIGNATURE, ""), ("", STAMP)])
    def test_missing_assets_do_not_emit_empty_img_tags(self, signature, stamp):
        # Prod templates today carry a stamp but no signature; the absent one
        # must not leave a broken <img> behind.
        html = _build_signer_html(signature, stamp, "", "")
        assert html.count("<img") == bool(signature) + bool(stamp)


class TestSignatureTokenInFooterHtml:
    """Regression coverage for the original prod bug: footerHtml wins over
    the structured signer block (Change 1), so an authored footer's
    {{signature}} token must actually render the signature image instead of
    silently disappearing (which is what happened before Change 1, when the
    signer block replaced footerHtml wholesale instead of the other way
    round).
    """

    def test_signature_token_in_authored_footer_renders_the_image(self):
        # Mirrors the actual prod footerHtml.
        html = _build_html(
            footer_html="<p>Sincerely,</p><p></p><p>{{signature}}</p><p>Muhammad Aldi Subakti<br>Chairman</p>",
            signature_url=SIGNATURE,
        )
        assert html.count("<img") == 1
        assert SIGNATURE in html

    def test_standalone_stamp_token_still_works(self):
        html = _build_html(
            footer_html="<p>{{stamp}}</p><p>{{signature}}</p>",
            signature_url=SIGNATURE,
            stamp_url=STAMP,
        )
        assert html.count("<img") == 2
        assert STAMP in html
        assert SIGNATURE in html

    def test_neither_url_leaves_tokens_unexpanded(self):
        html = _build_html(footer_html="<p>{{signature}}</p>")
        assert "{{signature}}" in html
        assert "<img" not in html


class TestIsEffectivelyEmptyHtml:
    @pytest.mark.parametrize("text", ["", "   ", "<p></p>", "<p> </p>", "<p><br></p>", "<p><br/></p>", "<p>&nbsp;</p>", "<p></p><p><br></p>"])
    def test_empty_variants_are_treated_as_empty(self, text):
        assert _is_effectively_empty_html(text) is True

    @pytest.mark.parametrize("text", ["<p>Sincerely,</p>", "<p>{{signer_name}}</p>", "Plain text, no tags"])
    def test_real_content_is_not_empty(self, text):
        assert _is_effectively_empty_html(text) is False


class TestFooterPrecedence:
    """Change 1: an authored footer_html wins over the structured signer block;
    the structured block is only a fallback when footer_html is effectively empty.
    """

    def test_non_empty_footer_html_wins_and_signer_block_is_absent(self):
        html = _build_html(
            footer_html="<p>Sincerely,</p><p>{{signer_name}}</p>",
            placeholder_data={"{{signer_name}}": "Muhammad Aldi Subakti"},
            signature_url=SIGNATURE,
            stamp_url=STAMP,
            signer_name="Muhammad Aldi Subakti",
            signer_title="Chairman",
        )
        assert "Sincerely," in html
        assert "Muhammad Aldi Subakti" in html
        # The structured signer block re-renders the stamp/signature <img> tags
        # and a bold-name div — none of that should appear alongside footer_html.
        assert "<img" not in html
        assert 'font-weight:bold' not in html

    def test_effectively_empty_footer_html_falls_back_to_signer_block(self):
        html = _build_html(
            footer_html="<p></p>",
            signature_url=SIGNATURE,
            signer_name="Muhammad Aldi Subakti",
            signer_title="Chairman",
        )
        assert SIGNATURE in html
        assert "Muhammad Aldi Subakti" in html
        assert 'font-weight:bold' in html

    def test_both_empty_renders_neither(self):
        html = _build_html(footer_html="<p></p>")
        assert "<img" not in html
        assert 'font-weight:bold' not in html


class TestPageFooterNote:
    """Change 2: an optional disclaimer rendered as a running @bottom-center
    page-margin footer (CSS Paged Media `@page { @bottom-center { ... } }`),
    NOT in-flow HTML content — so it lives in the page margin, outside
    WeasyPrint's body pagination, and structurally cannot be torn across a
    page boundary or orphan onto its own near-blank page the way the earlier
    in-flow `<div>` version could (and did, against real prod data).
    """

    def test_footer_note_text_is_present_in_the_margin_box(self):
        html = _build_html(footer_note="This document is computer-generated. No physical signature required.")
        assert "@bottom-center" in html
        assert "This document is computer-generated. No physical signature required." in html

    def test_generated_date_line_uses_program_name_and_formatted_date(self):
        html = _build_html(
            show_generated_date=True,
            program_name="World Youth Fest",
            generated_at=datetime(2026, 7, 20),
        )
        assert "World Youth Fest" in html
        assert "Generated on July 20, 2026" in html

    def test_disclaimer_is_css_only_not_in_flow_body_content(self):
        # It must appear only inside the <style> block's @page rule, never in
        # <body> — that's what makes it structurally immune to orphaning.
        html = _build_html(footer_note="This document is computer-generated.")
        body_html = html[html.index("<body>"):]
        assert "This document is computer-generated." not in body_html

    def test_disclaimer_present_emits_bottom_center_and_grows_bottom_margin(self):
        html = _build_html(footer_note="Some note", margins=DEFAULT_MARGINS)
        assert "@bottom-center" in html
        expected_bottom = DEFAULT_MARGINS["bottom"] + LOA_PAGE_FOOTER_EXTRA_BOTTOM_MARGIN_PT
        assert f"margin: 40pt 40pt {expected_bottom}pt 40pt;" in html

    def test_disclaimer_absent_emits_no_margin_box_css_and_keeps_original_margins(self):
        html = _build_html(margins=DEFAULT_MARGINS)
        assert "@bottom-center" not in html
        assert "border-top:0.5pt solid #ccc" not in html
        assert "Generated on" not in html
        assert "margin: 40pt 40pt 40pt 40pt;" in html

    def test_only_footer_note_set_omits_generated_date_line(self):
        html = _build_html(footer_note="Some note")
        assert "Some note" in html
        assert "Generated on" not in html

    def test_only_show_generated_date_set_still_emits_the_margin_box(self):
        html = _build_html(show_generated_date=True, program_name="World Youth Fest", generated_at=datetime(2026, 1, 5))
        assert "@bottom-center" in html
        assert "Generated on January 5, 2026" in html

    def test_footer_note_with_quotes_and_backslashes_does_not_break_the_css(self):
        raw = 'Say "hello" \\ backslash test'  # one literal backslash + double quotes
        html = _build_html(footer_note=raw)
        expected_escaped = _css_string_escape(raw)
        assert f'content: "{expected_escaped}"' in html
        # A broken content: "..." string (unescaped quote) would unbalance the
        # rest of the @page rule's braces.
        assert html.count("{") == html.count("}")


class TestGenerateLoaSyncSmoke:
    """generate_loa_sync still produces a real PDF end to end (WeasyPrint render)."""

    def test_produces_pdf_bytes_with_footer_note(self):
        pdf_bytes = generate_loa_sync(
            html_content="<p>Congratulations {{name}}.</p>",
            header_html="",
            footer_html="<p></p>",
            page_size="A4",
            margins=DEFAULT_MARGINS,
            placeholder_data={"{{name}}": "Jane Doe"},
            document_number="DOC-001",
            signature_url=SIGNATURE,
            stamp_url=STAMP,
            signer_name="Muhammad Aldi Subakti",
            signer_title="Chairman",
            footer_note="This document is computer-generated. No physical signature required.",
            show_generated_date=True,
            program_name="World Youth Fest",
        )
        assert isinstance(pdf_bytes, bytes)
        assert pdf_bytes.startswith(b"%PDF")

    def test_realistic_letter_with_disclaimer_still_fits_on_one_page(self):
        # Regression test for the original orphaning bug: with the disclaimer
        # as an in-flow <div>, a realistic (multi-paragraph) letter pushed the
        # sign-off + disclaimer onto a near-blank second page. As a page-margin
        # footer it consumes no flow space, so a letter that fits on one page
        # without a disclaimer must still fit on one page with it.
        long_body = "".join(
            f"<p>Paragraph {i} of the letter body, padded out with extra "
            "text to occupy real vertical space on the printed page.</p>"
            for i in range(10)
        )
        pdf_bytes = generate_loa_sync(
            html_content=long_body,
            header_html="",
            footer_html="<p>Sincerely,</p><p>Muhammad Aldi Subakti<br>Chairman</p>",
            page_size="A4",
            margins=DEFAULT_MARGINS,
            placeholder_data={},
            document_number="DOC-005",
            footer_note="This document is computer-generated. No physical signature required.",
            show_generated_date=True,
            program_name="World Youth Fest",
        )
        reader = PdfReader(io.BytesIO(pdf_bytes))
        assert len(reader.pages) == 1

    def test_produces_pdf_bytes_with_signature_token_in_footer_html(self):
        # End-to-end version of the original prod bug report: authored
        # footerHtml with a {{signature}} token, footerHtml wins per Change 1.
        pdf_bytes = generate_loa_sync(
            html_content="<p>Congratulations {{name}}.</p>",
            header_html="",
            footer_html="<p>Sincerely,</p><p>{{signature}}</p><p>Muhammad Aldi Subakti<br>Chairman</p>",
            page_size="A4",
            margins=DEFAULT_MARGINS,
            placeholder_data={"{{name}}": "Jane Doe"},
            document_number="DOC-002",
            signature_url=SIGNATURE,
        )
        assert isinstance(pdf_bytes, bytes)
        assert pdf_bytes.startswith(b"%PDF")

    def test_pdf_actually_embeds_the_signature_image(self, tmp_path):
        # http(s) URLs to a fake CDN never resolve, so the test above only
        # proves WeasyPrint doesn't error out — it can't prove the image
        # actually got embedded. Point signature_url at a real local file
        # (via file:// — no network involved) and inspect the PDF's page
        # resources to confirm it made it in.
        png_bytes = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
            "+A8AAQUBAScY42YAAAAASUVORK5CYII="
        )
        signature_path = tmp_path / "signature.png"
        signature_path.write_bytes(png_bytes)

        pdf_bytes = generate_loa_sync(
            html_content="<p>Body.</p>",
            header_html="",
            footer_html="<p>{{signature}}</p>",
            page_size="A4",
            margins=DEFAULT_MARGINS,
            placeholder_data={},
            document_number="DOC-003",
            signature_url=signature_path.as_uri(),
        )

        reader = PdfReader(io.BytesIO(pdf_bytes))
        resources = reader.pages[0].get("/Resources").get_object()
        xobjects = resources.get("/XObject").get_object() if "/XObject" in resources else {}
        image_count = sum(
            1 for obj in xobjects.values() if obj.get_object().get("/Subtype") == "/Image"
        )
        assert image_count == 1
