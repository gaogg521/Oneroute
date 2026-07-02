package controller

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/QuantumNous/new-api/common"
)

// OneOne (Oneverse Northbound API V1) HMAC-SHA256 request signing.
//
// Protocol (per https://oneone666.github.io/guide/signing-requests.html):
//
//	data (with body)    = "<METHOD>\n<FULL URL>\n<canonicalized body>"
//	data (without body) = "<METHOD>\n<FULL URL>"
//	signature            = hex(HMAC_SHA256(data, secret))
//
// The body must have its JSON keys sorted alphabetically (at every nesting
// level) and be compact-encoded (no whitespace) before hashing.

// canonicalizeJSON re-encodes v with all object keys sorted alphabetically
// and no extraneous whitespace. Round-tripping through `any` is sufficient:
// encoding/json marshals map[string]any with keys sorted, recursively, and
// without indentation by default.
func canonicalizeJSON(v any) (string, error) {
	raw, err := common.Marshal(v)
	if err != nil {
		return "", fmt.Errorf("序列化请求体失败: %w", err)
	}
	var generic any
	if err := common.Unmarshal(raw, &generic); err != nil {
		return "", fmt.Errorf("解析请求体失败: %w", err)
	}
	out, err := common.Marshal(generic)
	if err != nil {
		return "", fmt.Errorf("规范化请求体失败: %w", err)
	}
	return string(out), nil
}

// signOneOne returns the hex-encoded HMAC-SHA256 signature for the given
// request. body must be "" for requests without a payload (e.g. GET).
func signOneOne(method, fullURL, body, secret string) string {
	data := method + "\n" + fullURL
	if body != "" {
		data += "\n" + body
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(data))
	return hex.EncodeToString(mac.Sum(nil))
}
