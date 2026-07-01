package controller

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"fmt"
	"net/url"
)

// Antom (Alipay Global) RSA2 request signing and signature verification.
//
// Protocol (per docs.antom.com "Sign a request and verify the signature"):
//
//	content = "POST <uri>\n<clientId>.<time>.<body>"
//	request signature  = urlEncode(base64(SHA256withRSA(content, merchantPrivateKey)))
//	verify (resp/notify): SHA256withRSA_verify(base64Decode(urlDecode(sig)), content, antomPublicKey)
//
// Keys are base64-encoded DER (no PEM header): private key is PKCS#8,
// public key is PKIX/X.509 SubjectPublicKeyInfo — matching the Antom Dashboard
// key format and the Java SDK's PKCS8EncodedKeySpec / X509EncodedKeySpec usage.

// antomSignContent builds the canonical string that is signed/verified.
func antomSignContent(uri, clientId, timestamp, body string) string {
	return fmt.Sprintf("POST %s\n%s.%s.%s", uri, clientId, timestamp, body)
}

func parseAntomPrivateKey(b64 string) (*rsa.PrivateKey, error) {
	der, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return nil, fmt.Errorf("私钥 base64 解码失败: %w", err)
	}
	key, err := x509.ParsePKCS8PrivateKey(der)
	if err != nil {
		// Fallback for keys exported in PKCS#1 format.
		if pk, err1 := x509.ParsePKCS1PrivateKey(der); err1 == nil {
			return pk, nil
		}
		return nil, fmt.Errorf("私钥解析失败(需 PKCS#8 base64): %w", err)
	}
	rsaKey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("私钥不是 RSA 类型")
	}
	return rsaKey, nil
}

func parseAntomPublicKey(b64 string) (*rsa.PublicKey, error) {
	der, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return nil, fmt.Errorf("公钥 base64 解码失败: %w", err)
	}
	pub, err := x509.ParsePKIXPublicKey(der)
	if err != nil {
		if pk, err1 := x509.ParsePKCS1PublicKey(der); err1 == nil {
			return pk, nil
		}
		return nil, fmt.Errorf("公钥解析失败(需 X.509 base64): %w", err)
	}
	rsaPub, ok := pub.(*rsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("公钥不是 RSA 类型")
	}
	return rsaPub, nil
}

// signAntom signs the request and returns the url-encoded base64 signature
// to place into: Signature: algorithm=RSA256, keyVersion=1, signature=<sig>
func signAntom(uri, clientId, timestamp, privateKeyB64, body string) (string, error) {
	priv, err := parseAntomPrivateKey(privateKeyB64)
	if err != nil {
		return "", err
	}
	content := antomSignContent(uri, clientId, timestamp, body)
	hashed := sha256.Sum256([]byte(content))
	sig, err := rsa.SignPKCS1v15(rand.Reader, priv, crypto.SHA256, hashed[:])
	if err != nil {
		return "", fmt.Errorf("签名失败: %w", err)
	}
	return url.QueryEscape(base64.StdEncoding.EncodeToString(sig)), nil
}

// verifyAntom verifies a response/notification signature. The body MUST be the
// raw bytes as received (do not re-marshal JSON), otherwise verification fails.
func verifyAntom(uri, clientId, timestamp, publicKeyB64, body, targetSignature string) bool {
	if targetSignature == "" {
		return false
	}
	pub, err := parseAntomPublicKey(publicKeyB64)
	if err != nil {
		return false
	}
	decodedSig, err := url.QueryUnescape(targetSignature)
	if err != nil {
		return false
	}
	sigBytes, err := base64.StdEncoding.DecodeString(decodedSig)
	if err != nil {
		return false
	}
	content := antomSignContent(uri, clientId, timestamp, body)
	hashed := sha256.Sum256([]byte(content))
	return rsa.VerifyPKCS1v15(pub, crypto.SHA256, hashed[:], sigBytes) == nil
}
