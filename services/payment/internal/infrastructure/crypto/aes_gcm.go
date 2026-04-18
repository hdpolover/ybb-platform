// Package crypto provides app-layer symmetric encryption for sensitive values
// (gateway credentials) before they are written to the database.
//
// Format: "enc:v1:" + base64(nonce || ciphertext || gcmTag)
// Values without the "enc:v1:" prefix are returned as-is by Decrypt so that
// the migration tool and live reads can coexist during rollout.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
)

const prefix = "enc:v1:"

// Encrypt returns the ciphertext for s using the base64-encoded 32-byte key.
// Empty input is returned unchanged (WebhookSecret is optional).
func Encrypt(b64Key, s string) (string, error) {
	if s == "" {
		return "", nil
	}
	gcm, err := newGCM(b64Key)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("rand: %w", err)
	}
	ct := gcm.Seal(nonce, nonce, []byte(s), nil)
	return prefix + base64.StdEncoding.EncodeToString(ct), nil
}

// Decrypt reverses Encrypt. Values without the enc:v1: prefix are returned
// as-is (treated as legacy plaintext) — the migration tool relies on this.
func Decrypt(b64Key, s string) (string, error) {
	if s == "" {
		return "", nil
	}
	if !strings.HasPrefix(s, prefix) {
		return s, nil
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(s, prefix))
	if err != nil {
		return "", fmt.Errorf("base64: %w", err)
	}
	gcm, err := newGCM(b64Key)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", errors.New("ciphertext too short")
	}
	nonce, ct := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	pt, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", fmt.Errorf("gcm open: %w", err)
	}
	return string(pt), nil
}

func newGCM(b64Key string) (cipher.AEAD, error) {
	if b64Key == "" {
		return nil, errors.New("PAYMENT_SECRETS_KEY is not set")
	}
	key, err := base64.StdEncoding.DecodeString(b64Key)
	if err != nil {
		return nil, fmt.Errorf("decode key: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("key must be 32 bytes (got %d)", len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}
	return cipher.NewGCM(block)
}
