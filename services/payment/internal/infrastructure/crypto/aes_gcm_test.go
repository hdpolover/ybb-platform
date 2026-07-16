package crypto_test

import (
	"encoding/base64"
	"strings"
	"testing"

	"github.com/ybb-platform/payment/internal/infrastructure/crypto"
)

func makeKey(t *testing.T) string {
	t.Helper()
	// 32 bytes of zeros, base64-encoded — valid AES-256 key shape
	return base64.StdEncoding.EncodeToString(make([]byte, 32))
}

func TestEncryptDecryptRoundTrip(t *testing.T) {
	k := makeKey(t)
	plain := "SB-Mid-server-SECRET"

	ct, err := crypto.Encrypt(k, plain)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if ct == plain {
		t.Fatal("ciphertext must not equal plaintext")
	}
	if !strings.HasPrefix(ct, "enc:v1:") {
		t.Fatalf("want enc:v1: prefix, got %q", ct)
	}

	got, err := crypto.Decrypt(k, ct)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if got != plain {
		t.Fatalf("round-trip: got %q, want %q", got, plain)
	}
}

func TestDecryptTamperedFails(t *testing.T) {
	k := makeKey(t)
	ct, _ := crypto.Encrypt(k, "secret")

	// Flip one base64 byte in the payload (after the prefix)
	tampered := ct[:len(ct)-1] + "A"
	if _, err := crypto.Decrypt(k, tampered); err == nil {
		t.Fatal("expected tampered ciphertext to fail")
	}
}

func TestDecryptPlaintextPassthrough(t *testing.T) {
	// Values without the enc:v1: prefix are treated as plaintext (migration escape hatch)
	k := makeKey(t)
	got, err := crypto.Decrypt(k, "SB-Mid-server-LEGACY")
	if err != nil {
		t.Fatalf("decrypt passthrough: %v", err)
	}
	if got != "SB-Mid-server-LEGACY" {
		t.Fatalf("want passthrough, got %q", got)
	}
}

func TestEncryptEmptyIsNoop(t *testing.T) {
	k := makeKey(t)
	got, err := crypto.Encrypt(k, "")
	if err != nil {
		t.Fatalf("encrypt empty: %v", err)
	}
	if got != "" {
		t.Fatalf("empty input should stay empty, got %q", got)
	}
}

func TestInvalidKeyRejected(t *testing.T) {
	if _, err := crypto.Encrypt("not-base64!", "x"); err == nil {
		t.Fatal("expected invalid-key error")
	}
	if _, err := crypto.Encrypt(base64.StdEncoding.EncodeToString([]byte("short")), "x"); err == nil {
		t.Fatal("expected key-length error")
	}
}

func TestDecryptWrongKeyFails(t *testing.T) {
	k1 := base64.StdEncoding.EncodeToString(make([]byte, 32))
	ct, _ := crypto.Encrypt(k1, "secret")

	k2 := base64.StdEncoding.EncodeToString(append(make([]byte, 31), 1))
	if _, err := crypto.Decrypt(k2, ct); err == nil {
		t.Fatal("expected decrypt with wrong key to fail")
	}
}

func TestEncryptNonceIsUnique(t *testing.T) {
	// Encrypting the same plaintext twice must produce different ciphertexts
	// (fresh random nonce per call). Regression guard for "someone hardcoded the nonce".
	k := base64.StdEncoding.EncodeToString(make([]byte, 32))
	a, err := crypto.Encrypt(k, "same-input")
	if err != nil {
		t.Fatalf("encrypt a: %v", err)
	}
	b, err := crypto.Encrypt(k, "same-input")
	if err != nil {
		t.Fatalf("encrypt b: %v", err)
	}
	if a == b {
		t.Fatal("expected distinct ciphertexts for identical plaintext (nonce reuse)")
	}
}

func TestDecryptPrefixedButInvalidFails(t *testing.T) {
	// A value that looks like "enc:v1:<garbage>" must NOT silently pass through.
	// (Passthrough only triggers when the prefix is absent.)
	k := base64.StdEncoding.EncodeToString(make([]byte, 32))
	if _, err := crypto.Decrypt(k, "enc:v1:not-real-base64!!!"); err == nil {
		t.Fatal("expected decrypt of prefixed-but-invalid value to fail")
	}
}
