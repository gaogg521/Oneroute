package controller

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/thanhpk/randstr"
)

// antomPayPath is the Antom Cashier Payment API resource path (used for both
// the request URL and the signature content).
const antomPayPath = "/ams/api/v1/payments/pay"

// antomInquiryPath is the Antom inquiryPayment API resource path, confirmed
// against https://docs.antom.com/ac/ams/paymentri_online (POST /v1/payments/inquiryPayment,
// mounted under the same /ams/api prefix as the pay endpoint).
const antomInquiryPath = "/ams/api/v1/payments/inquiryPayment"

var antomHTTPClient = &http.Client{Timeout: 20 * time.Second}

// AntomPayRequest is the client payload for initiating an Antom (Alipay Global) topup.
type AntomPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
	SuccessURL    string `json:"success_url,omitempty"`
	CancelURL     string `json:"cancel_url,omitempty"`
}

type antomPayResponse struct {
	Result struct {
		ResultStatus  string `json:"resultStatus"`
		ResultCode    string `json:"resultCode"`
		ResultMessage string `json:"resultMessage"`
	} `json:"result"`
	NormalUrl        string `json:"normalUrl"`
	PaymentRequestId string `json:"paymentRequestId"`
}

type antomNotify struct {
	PaymentRequestId string `json:"paymentRequestId"`
	Result           struct {
		ResultStatus string `json:"resultStatus"`
		ResultCode   string `json:"resultCode"`
	} `json:"result"`
}

func getAntomMinTopup() int64 {
	minTopup := setting.AntomMinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		minTopup = minTopup * int(common.QuotaPerUnit)
	}
	return int64(minTopup)
}

// getAntomPayMoney computes the real-currency amount to charge, mirroring
// getStripePayMoney (unit price * group ratio * optional preset discount).
func getAntomPayMoney(amount float64, group string) float64 {
	originalAmount := amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = amount / common.QuotaPerUnit
	}
	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}
	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(originalAmount)]; ok {
		if ds > 0 {
			discount = ds
		}
	}
	return amount * setting.AntomUnitPrice * topupGroupRatio * discount
}

// RequestAntomPay creates a pending topup order and a hosted Antom cashier
// session, returning the redirect URL as `pay_link` (mirrors the Stripe flow).
func RequestAntomPay(c *gin.Context) {
	var req AntomPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.PaymentMethod != model.PaymentMethodAntom {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "不支持的支付渠道"})
		return
	}
	if req.Amount < getAntomMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("充值数量不能小于 %d", getAntomMinTopup()), "data": 10})
		return
	}
	if req.Amount > 10000 {
		c.JSON(http.StatusOK, gin.H{"message": "充值数量不能大于 10000", "data": 10})
		return
	}
	if req.SuccessURL != "" && common.ValidateRedirectURL(req.SuccessURL) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "支付成功重定向URL不在可信任域名列表中", "data": ""})
		return
	}
	if req.CancelURL != "" && common.ValidateRedirectURL(req.CancelURL) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "支付取消重定向URL不在可信任域名列表中", "data": ""})
		return
	}

	id := c.GetInt("id")
	user, err := model.GetUserById(id, false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户失败"})
		return
	}
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}

	chargedMoney := GetChargedAmount(float64(req.Amount), *user)
	payMoney := getAntomPayMoney(float64(req.Amount), group)
	if payMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	reference := fmt.Sprintf("new-api-ref-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(4))
	referenceId := "ref_" + common.Sha1([]byte(reference))

	payLink, err := genAntomLink(referenceId, payMoney, req.SuccessURL)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Antom 创建支付会话失败 user_id=%d trade_no=%s amount=%d error=%q", id, referenceId, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          req.Amount,
		Money:           chargedMoney,
		TradeNo:         referenceId,
		PaymentMethod:   model.PaymentMethodAntom,
		PaymentProvider: model.PaymentProviderAntom,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Antom 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, referenceId, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Antom 充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f", id, referenceId, req.Amount, chargedMoney))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": payLink,
		},
	})
}

// genAntomLink calls Antom's Cashier Payment API (signed) and returns the
// hosted cashier redirect URL (normalUrl).
func genAntomLink(referenceId string, payMoney float64, successURL string) (string, error) {
	redirectURL := successURL
	if redirectURL == "" {
		redirectURL = paymentReturnPath("/console/log")
	}
	notifyURL := strings.TrimRight(service.GetCallbackAddress(), "/") + "/api/antom/notify"

	// Antom amount value is in the minor unit (e.g. cents for USD/CNY).
	value := fmt.Sprintf("%.0f", payMoney*100)
	amount := map[string]string{
		"currency": setting.AntomCurrency,
		"value":    value,
	}
	reqBody := map[string]any{
		"productCode":      "CASHIER_PAYMENT",
		"paymentRequestId": referenceId,
		"paymentAmount":    amount,
		"paymentMethod": map[string]string{
			"paymentMethodType": setting.AntomPaymentMethodType,
		},
		"order": map[string]any{
			"referenceOrderId": referenceId,
			"orderDescription": "New API balance top-up",
			"orderAmount":      amount,
		},
		"env": map[string]string{
			"terminalType": "WEB",
		},
		"paymentNotifyUrl":   notifyURL,
		"paymentRedirectUrl": redirectURL,
	}

	bodyBytes, err := common.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("序列化请求失败: %w", err)
	}
	body := string(bodyBytes)

	timestamp := strconv.FormatInt(time.Now().UnixMilli(), 10)
	sig, err := signAntom(antomPayPath, setting.AntomClientId, timestamp, setting.AntomPrivateKey, body)
	if err != nil {
		return "", err
	}

	endpoint := strings.TrimRight(setting.AntomGateway, "/") + antomPayPath
	httpReq, err := http.NewRequest(http.MethodPost, endpoint, strings.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Client-Id", setting.AntomClientId)
	httpReq.Header.Set("Request-Time", timestamp)
	httpReq.Header.Set("Signature", fmt.Sprintf("algorithm=RSA256, keyVersion=1, signature=%s", sig))

	resp, err := antomHTTPClient.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("请求 Antom 失败: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取 Antom 响应失败: %w", err)
	}

	var parsed antomPayResponse
	if err := common.Unmarshal(respBytes, &parsed); err != nil {
		return "", fmt.Errorf("解析 Antom 响应失败: %w (body=%s)", err, string(respBytes))
	}
	if parsed.Result.ResultStatus != "S" || parsed.NormalUrl == "" {
		return "", fmt.Errorf("Antom 下单未成功: status=%s code=%s msg=%s", parsed.Result.ResultStatus, parsed.Result.ResultCode, parsed.Result.ResultMessage)
	}
	return parsed.NormalUrl, nil
}

// parseAntomSignatureHeader extracts the signature value from a header like
// "algorithm=RSA256, keyVersion=1, signature=<sig>".
func parseAntomSignatureHeader(header string) string {
	for _, part := range strings.Split(header, ",") {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "signature=") {
			return strings.TrimPrefix(part, "signature=")
		}
	}
	return ""
}

// AntomNotify handles the async payment notification: verify the signature
// against the raw body, then credit the user idempotently.
func AntomNotify(c *gin.Context) {
	ctx := c.Request.Context()
	callerIp := c.ClientIP()

	if !isAntomWebhookEnabled() {
		logger.LogWarn(ctx, fmt.Sprintf("Antom 通知被拒绝 reason=disabled client_ip=%s", callerIp))
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("Antom 通知读取请求体失败 client_ip=%s error=%q", callerIp, err.Error()))
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}
	body := string(payload)

	clientId := c.GetHeader("client-id")
	requestTime := c.GetHeader("request-time")
	signature := parseAntomSignatureHeader(c.GetHeader("signature"))
	uri := c.Request.URL.Path

	if !verifyAntom(uri, clientId, requestTime, setting.AntomPublicKey, body, signature) {
		logger.LogWarn(ctx, fmt.Sprintf("Antom 通知验签失败 client_ip=%s uri=%s client_id=%s", callerIp, uri, clientId))
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	var notify antomNotify
	if err := common.Unmarshal(payload, &notify); err != nil {
		logger.LogError(ctx, fmt.Sprintf("Antom 通知解析失败 client_ip=%s error=%q body=%q", callerIp, err.Error(), body))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	referenceId := notify.PaymentRequestId
	if referenceId == "" {
		logger.LogWarn(ctx, fmt.Sprintf("Antom 通知缺少 paymentRequestId client_ip=%s body=%q", callerIp, body))
		antomNotifyAck(c)
		return
	}

	// Only success notifications credit the account; ack others so Antom stops retrying.
	if notify.Result.ResultStatus != "S" {
		logger.LogInfo(ctx, fmt.Sprintf("Antom 通知非成功状态，忽略入账 trade_no=%s status=%s client_ip=%s", referenceId, notify.Result.ResultStatus, callerIp))
		antomNotifyAck(c)
		return
	}

	LockOrder(referenceId)
	defer UnlockOrder(referenceId)

	if err := model.RechargeAntom(referenceId, callerIp); err != nil {
		logger.LogError(ctx, fmt.Sprintf("Antom 充值处理失败 trade_no=%s client_ip=%s error=%q", referenceId, callerIp, err.Error()))
		// Still ack to avoid infinite retries; the order remains pending for manual review.
		antomNotifyAck(c)
		return
	}

	logger.LogInfo(ctx, fmt.Sprintf("Antom 充值成功 trade_no=%s client_ip=%s", referenceId, callerIp))
	antomNotifyAck(c)
}

// antomNotifyAck responds with the success acknowledgement Antom expects.
func antomNotifyAck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"result": gin.H{
			"resultCode":    "SUCCESS",
			"resultStatus":  "S",
			"resultMessage": "success",
		},
	})
}

// TestAntomConnectionRequest lets the admin test unsaved credentials
// directly, without first persisting them via /api/option/.
type TestAntomConnectionRequest struct {
	ClientId   string `json:"client_id"`
	PrivateKey string `json:"private_key"`
	Gateway    string `json:"gateway"`
}

type antomInquiryResponse struct {
	Result struct {
		ResultStatus  string `json:"resultStatus"`
		ResultCode    string `json:"resultCode"`
		ResultMessage string `json:"resultMessage"`
	} `json:"result"`
}

// TestAntomConnection calls inquiryPayment with a random, guaranteed-nonexistent
// paymentRequestId. Antom validates the signature/keys before ever looking up
// the order, so a well-formed ORDER_NOT_EXIST response proves the credentials
// are valid without creating or touching any real payment; any other result
// code (e.g. KEY_NOT_FOUND, PARAM_ILLEGAL) is surfaced verbatim.
func TestAntomConnection(c *gin.Context) {
	var req TestAntomConnectionRequest
	_ = c.ShouldBindJSON(&req)

	clientId := strings.TrimSpace(req.ClientId)
	if clientId == "" {
		clientId = setting.AntomClientId
	}
	privateKey := strings.TrimSpace(req.PrivateKey)
	if privateKey == "" {
		privateKey = setting.AntomPrivateKey
	}
	gateway := strings.TrimSpace(req.Gateway)
	if gateway == "" {
		gateway = setting.AntomGateway
	}

	if clientId == "" || privateKey == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "请先填写 Client ID 和商户私钥",
		})
		return
	}

	probeId := "probe_" + randstr.String(24)
	bodyBytes, err := common.Marshal(map[string]string{"paymentRequestId": probeId})
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	body := string(bodyBytes)

	timestamp := strconv.FormatInt(time.Now().UnixMilli(), 10)
	sig, err := signAntom(antomInquiryPath, clientId, timestamp, privateKey, body)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	endpoint := strings.TrimRight(gateway, "/") + antomInquiryPath
	httpReq, err := http.NewRequest(http.MethodPost, endpoint, strings.NewReader(body))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Client-Id", clientId)
	httpReq.Header.Set("Request-Time", timestamp)
	httpReq.Header.Set("Signature", fmt.Sprintf("algorithm=RSA256, keyVersion=1, signature=%s", sig))

	resp, err := antomHTTPClient.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "请求 Antom 失败: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "读取 Antom 响应失败: " + err.Error()})
		return
	}

	var parsed antomInquiryResponse
	if err := common.Unmarshal(respBytes, &parsed); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": fmt.Sprintf("解析 Antom 响应失败: %s (body=%s)", err.Error(), string(respBytes)),
		})
		return
	}

	if parsed.Result.ResultCode == "ORDER_NOT_EXIST" {
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "连接成功，凭证有效"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": fmt.Sprintf("%s: %s", parsed.Result.ResultCode, parsed.Result.ResultMessage),
	})
}
