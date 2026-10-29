// src/modules/brand-email/listmonk.client.spec.ts
import { ConfigService } from '@nestjs/config';
import { ListmonkClient, ListmonkError, ListmonkNotConfiguredError } from './listmonk.client';

const ENV = { LISTMONK_URL: 'https://lists.example.com/', LISTMONK_API_USER: 'api', LISTMONK_API_TOKEN: 'secret-token' };
const makeClient = (env: Record<string, string> = ENV) =>
    new ListmonkClient({ get: (k: string) => env[k] } as unknown as ConfigService);

const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') } as Response);

describe('ListmonkClient', () => {
    const fetchMock = jest.fn();
    beforeEach(() => {
        fetchMock.mockReset();
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    it('reports not configured and refuses requests when env is unset', async () => {
        const client = makeClient({});
        expect(client.isConfigured()).toBe(false);
        await expect(client.upsertCampaignTemplate('brand:x', '<p>')).rejects.toBeInstanceOf(ListmonkNotConfiguredError);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('treats empty-string env (compose defaults) as unset and defaults the from domain', () => {
        const client = makeClient({ LISTMONK_URL: '', LISTMONK_API_USER: '', LISTMONK_API_TOKEN: '' });
        expect(client.isConfigured()).toBe(false);
        expect(client.fromDomain()).toBe('news.youthbreaktheboundaries.com');
    });

    it('creates the template when none matches the name', async () => {
        fetchMock.mockReturnValueOnce(ok({ data: [{ id: 1, name: 'Default template' }] })).mockReturnValueOnce(ok({ data: { id: 7 } }));
        const res = await makeClient().upsertCampaignTemplate('brand:kys', '<html>');
        expect(res).toEqual({ id: 7, created: true });
        const [url, init] = fetchMock.mock.calls[1];
        expect(url).toBe('https://lists.example.com/api/templates');
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body)).toEqual({ name: 'brand:kys', type: 'campaign', subject: '', body: '<html>' });
        expect(init.headers.Authorization).toBe('token api:secret-token');
    });

    it('updates in place when a template with that name exists', async () => {
        fetchMock.mockReturnValueOnce(ok({ data: [{ id: 5, name: 'brand:kys' }] })).mockReturnValueOnce(ok({ data: { id: 5 } }));
        const res = await makeClient().upsertCampaignTemplate('brand:kys', '<html>');
        expect(res).toEqual({ id: 5, created: false });
        expect(fetchMock.mock.calls[1][0]).toBe('https://lists.example.com/api/templates/5');
        expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
    });

    it('finds a list by program tag', async () => {
        fetchMock.mockReturnValueOnce(ok({ data: { results: [{ id: 3, tags: ['ybb-program:p1'] }] } }));
        const res = await makeClient().findOrCreateProgramList('p1', 'Prog');
        expect(res).toEqual({ id: 3, created: false });
        expect(fetchMock.mock.calls[0][0]).toContain('tag=ybb-program%3Ap1');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('creates a private single-optin list with the tag when missing', async () => {
        fetchMock.mockReturnValueOnce(ok({ data: { results: [] } })).mockReturnValueOnce(ok({ data: { id: 9 } }));
        const res = await makeClient().findOrCreateProgramList('p1', 'KYS 2027');
        expect(res).toEqual({ id: 9, created: true });
        expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ name: 'KYS 2027', type: 'private', optin: 'single', tags: ['ybb-program:p1'] });
    });

    it('builds the draft campaign payload with Reply-To header', async () => {
        fetchMock.mockReturnValueOnce(ok({ data: { id: 42 } }));
        const client = makeClient();
        const res = await client.createDraftCampaign({
            name: 'n', subject: 's', fromEmail: '"KYS" <kys@news.example.com>', templateId: 7, listIds: [3], body: '<p>', replyTo: 'r@x.com', tags: ['t'],
        });
        expect(res).toEqual({ id: 42 });
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
            name: 'n', subject: 's', lists: [3], from_email: '"KYS" <kys@news.example.com>', type: 'regular', content_type: 'richtext',
            messenger: 'email', template_id: 7, body: '<p>', tags: ['t'], headers: [{ 'Reply-To': 'r@x.com' }],
        });
        expect(client.editUrl(42)).toBe('https://lists.example.com/admin/campaigns/42');
    });

    it('omits headers when there is no reply-to', async () => {
        fetchMock.mockReturnValueOnce(ok({ data: { id: 1 } }));
        await makeClient().createDraftCampaign({ name: 'n', subject: 's', fromEmail: 'a', templateId: 1, listIds: [1], body: 'b' });
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('headers');
    });

    it('raises a clear error on HTTP failure without leaking the token', async () => {
        fetchMock.mockReturnValueOnce(Promise.resolve({ ok: false, status: 403, text: () => Promise.resolve('forbidden') } as Response));
        const err = await makeClient().upsertCampaignTemplate('b', 'x').catch((e) => e);
        expect(err).toBeInstanceOf(ListmonkError);
        expect(err.status).toBe(403);
        expect(err.message).toContain('403');
        expect(err.message).not.toContain('secret-token');
    });

    it('wraps network errors and timeouts', async () => {
        fetchMock.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'TimeoutError' }));
        await expect(makeClient().upsertCampaignTemplate('b', 'x')).rejects.toThrow(/timed out/);
        fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED secret-token'));
        const err = await makeClient().upsertCampaignTemplate('b', 'x').catch((e) => e);
        expect(err.message).toContain('network error');
        expect(err.message).not.toContain('secret-token');
    });
});
