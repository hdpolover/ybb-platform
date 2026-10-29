// src/modules/brand-email/brand-email-template.renderer.spec.ts
import { EffectiveEmailTheme } from './brand-email-theme';
import { CONTENT_TOKEN, UNSUBSCRIBE_TOKEN, contrastRatio, escapeHtml, pickForeground, renderBrandEmailTemplate, renderCtaButton, renderPreviewHtml, safeHttpsUrl } from './brand-email-template.renderer';

const theme = (over: Partial<EffectiveEmailTheme> = {}): EffectiveEmailTheme => ({
    brandName: 'Korea Youth Summit',
    tagline: null,
    websiteUrl: 'https://koreayouthsummit.com',
    logoUrl: 'https://cdn.example.com/logo.png',
    socialLinks: [{ label: 'instagram', url: 'https://instagram.com/kys' }],
    fromName: 'KYS',
    fromLocalPart: 'kys',
    replyTo: null,
    bannerUrl: null,
    footerText: '',
    primaryColor: '#112233',
    secondaryColor: '#445566',
    accentColor: '#778899',
    buttonStyle: 'rounded',
    ...over,
});

describe('brand email renderer', () => {
    it('contains the Listmonk content and unsubscribe tokens plus compliance copy', () => {
        const html = renderBrandEmailTemplate(theme());
        expect(html).toContain(CONTENT_TOKEN);
        expect(html).toContain(`href="${UNSUBSCRIBE_TOKEN}"`);
        expect(html).toContain('Organized by Youth Break the Boundaries (YBB)');
        expect(html).toContain('You are receiving this because you registered for a Korea Youth Summit program.');
    });

    it('uses table layout at 600px without flex/grid', () => {
        const html = renderBrandEmailTemplate(theme());
        expect(html).toContain('width="600"');
        expect(html).not.toMatch(/display:\s*(flex|grid)/);
        expect(html).not.toContain('<link');
    });

    it('escapes script tags in footer text', () => {
        const html = renderBrandEmailTemplate(theme({ footerText: '<script>alert(1)</script>' }));
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('neutralises Go template actions in admin values', () => {
        const html = renderBrandEmailTemplate(theme({ footerText: '{{ .Subscriber.Email }}', brandName: '{{ template "x" . }}' }));
        const actions = html.match(/\{\{/g) ?? [];
        // only the two intentional tokens (content + unsubscribe)
        expect(actions).toHaveLength(2);
    });

    it('drops javascript:, data: and http: URLs for links and images', () => {
        const html = renderBrandEmailTemplate(
            theme({
                logoUrl: 'javascript:alert(1)',
                bannerUrl: 'http://insecure.example.com/b.png',
                websiteUrl: 'javascript:alert(1)',
                socialLinks: [{ label: 'x', url: 'data:text/html,<script>1</script>' }],
            }),
        );
        expect(html).not.toContain('javascript:');
        expect(html).not.toContain('http://insecure');
        expect(html).not.toContain('data:text');
        expect(html).not.toContain('<img');
    });

    it('escapes quotes so a URL cannot break out of an attribute', () => {
        const html = renderBrandEmailTemplate(theme({ logoUrl: 'https://x.example.com/a.png?q="onerror="alert(1)' }));
        expect(html).not.toContain('"onerror=');
    });

    it('ignores non-hex colors and falls back', () => {
        const html = renderBrandEmailTemplate(theme({ primaryColor: 'red;}</style><script>', secondaryColor: 'url(x)', accentColor: 'red;}' }));
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('url(x)');
    });

    it('paints the top bar and divider with the accent color, not the primary', () => {
        const html = renderBrandEmailTemplate(theme());
        expect(html).toContain('bgcolor="#778899"');
        expect(html).toContain('border-top:2px solid #778899');
        expect(html).not.toContain('#112233');
    });

    it('renders banner image when set and button radius per style', () => {
        const withBanner = renderBrandEmailTemplate(theme({ bannerUrl: 'https://cdn.example.com/banner.png' }));
        expect(withBanner).toContain('https://cdn.example.com/banner.png');
        expect(renderCtaButton(theme({ buttonStyle: 'square' }), 'Go', 'https://a.example.com')).toContain('border-radius:0');
        expect(renderCtaButton(theme({ buttonStyle: 'pill' }), 'Go', 'https://a.example.com')).toContain('border-radius:999px');
        expect(renderCtaButton(theme(), 'Go', 'javascript:alert(1)')).toBe('');
    });

    it('preview substitutes the Listmonk tokens', () => {
        const html = renderPreviewHtml(theme());
        expect(html).not.toContain('{{');
        expect(html).toContain('Applications are now open');
    });

    it('helpers', () => {
        expect(escapeHtml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
        expect(safeHttpsUrl('https://ok.example.com/x')).toBe('https://ok.example.com/x');
        expect(safeHttpsUrl('not a url')).toBeNull();
        expect(safeHttpsUrl(null)).toBeNull();
        expect(safeHttpsUrl('koreayouthsummit.com')).toBe('https://koreayouthsummit.com/');
        expect(safeHttpsUrl(' youthacademicforum.com ')).toBe('https://youthacademicforum.com/');
        expect(safeHttpsUrl('http://x.example.com')).toBeNull();
        expect(safeHttpsUrl('javascript:alert(1)')).toBeNull();
    });

    it('picks the more readable button text, matching the site', () => {
        // live brand colours: bright ones need dark text, deep ones white
        expect(pickForeground('#0AF5D9')).toBe('#020617');
        expect(pickForeground('#EDA507')).toBe('#020617');
        expect(pickForeground('#FA0000')).toBe('#020617');
        expect(pickForeground('#1C57B3')).toBe('#ffffff');
        expect(pickForeground('#886B02')).toBe('#ffffff');
        expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
        expect(renderCtaButton(theme({ secondaryColor: '#0AF5D9' }), 'Go', 'https://a.example.com')).toContain('color:#020617');
    });

    it('falls back to neutral link colour when the brand colour is unreadable on white', () => {
        const bright = renderBrandEmailTemplate(theme({ secondaryColor: '#0AF5D9' }));
        expect(bright).toContain('.content a{color:#1F2937;}');
        expect(bright).not.toContain('color:#0AF5D9;text-decoration:underline');
        expect(renderBrandEmailTemplate(theme({ secondaryColor: '#1C57B3' }))).toContain('.content a{color:#1C57B3;}');
    });

    it('links a scheme-less website url in the footer', () => {
        expect(renderBrandEmailTemplate(theme({ websiteUrl: 'koreayouthsummit.com' }))).toContain('href="https://koreayouthsummit.com/"');
    });
});
