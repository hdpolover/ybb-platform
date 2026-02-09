
const crypto = require('crypto');

module.exports = {
    v4: () => crypto.randomUUID(),
    v1: () => crypto.randomUUID(), // Mock v1 with v4 for now
    validate: (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str),
    parse: () => Buffer.alloc(16),
    stringify: () => crypto.randomUUID(),
};
