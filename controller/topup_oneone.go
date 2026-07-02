package controller

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
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

const (
	oneoneLoginPath        = "/api/northbound/login"
	oneoneOrdersPath       = "/api/northbound/transactions"
	oneoneOrderStatusPaid  = "paid"
	oneoneAccountPlaceholder = "topup"
)

var oneoneHTTPClient = &http.Client{Timeout: 20 * time.Second}

// oneoneTokenMu guards the cached Bearer token. A new login invalidates all
// previous tokens for the account, so we cache and only refresh on 401
// rather than logging in per-request.
var (
	oneoneTokenMu    sync.Mutex
	oneoneCachedToken string
)

type oneoneAPIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type oneoneAPIResponse struct {
	Status  string          `json:"status"`
	Code    int             `json:"code"`
	Error   *oneoneAPIError `json:"error"`
	Data    json.RawMessage `json:"data"`
	Message string          `json:"message"`
}

type oneoneLoginRequest struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

type oneoneLoginData struct {
	Token string `json:"token"`
}

type oneoneAccountInfo struct {
	ServerName string `json:"server_name,omitempty"`
	LoginID    string `json:"login_id,omitempty"`
	Name       string `json:"name"`
}

type oneoneCreateOrderRequest struct {
	MerchantTransactionID string            `json:"merchant_transaction_id"`
	MerchantUUID          string            `json:"merchant_uuid"`
	GameName              string            `json:"game_name"`
	AccountInfo           oneoneAccountInfo `json:"account_info"`
	Country               string            `json:"country"`
	PaymentChannel        string            `json:"payment_channel"`
	AmountCents           int64             `json:"amount_cents"`
	Currency              string            `json:"currency"`
	Title                 string            `json:"title"`
	MerchantReturnURL     string            `json:"merchant_return_url"`
	WebhookURL            string            `json:"webhook_url,omitempty"`
}

type oneoneOrderData struct {
	OrderID               string `json:"order_id"`
	MerchantTransactionID string `json:"merchant_transaction_id"`
	Status                string `json:"status"`
	Paylink               string `json:"paylink"`
	VerifyURL             string `json:"verify_url"`
}

// oneoneDoLogin performs the raw, unsigned login call against Oneverse with
// the given credentials and returns the Bearer token. It does not touch the
// cache — callers decide whether the result should be cached (real payment
// flow) or discarded (connection test).
func oneoneDoLogin(merchantUUID, password string) (string, error) {
	body := oneoneLoginRequest{
		Login:    merchantUUID,
		Password: password,
	}
	bodyBytes, err := common.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("序列化登录请求失败: %w", err)
	}

	endpoint := strings.TrimRight(setting.OneOneBaseURL, "/") + oneoneLoginPath
	httpReq, err := http.NewRequest(http.MethodPost, endpoint, strings.NewReader(string(bodyBytes)))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := oneoneHTTPClient.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("请求 OneOne 登录失败: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取 OneOne 登录响应失败: %w", err)
	}

	var parsed oneoneAPIResponse
	if err := common.Unmarshal(respBytes, &parsed); err != nil {
		return "", fmt.Errorf("解析 OneOne 登录响应失败: %w (body=%s)", err, string(respBytes))
	}
	if parsed.Status != "success" {
		msg := parsed.Message
		if parsed.Error != nil {
			msg = parsed.Error.Message
		}
		return "", fmt.Errorf("%s (code=%d)", msg, parsed.Code)
	}

	var data oneoneLoginData
	if err := common.Unmarshal(parsed.Data, &data); err != nil {
		return "", fmt.Errorf("解析 OneOne 登录数据失败: %w", err)
	}
	if data.Token == "" {
		return "", fmt.Errorf("OneOne 登录未返回 token")
	}

	return data.Token, nil
}

// oneoneLogin authenticates against Oneverse using the saved settings and
// caches the returned Bearer token. Unlike order/list endpoints, login
// itself is not signed.
func oneoneLogin() (string, error) {
	token, err := oneoneDoLogin(setting.OneOneMerchantUUID, setting.OneOnePasswordSecret)
	if err != nil {
		return "", fmt.Errorf("OneOne 登录失败: %w", err)
	}

	oneoneTokenMu.Lock()
	oneoneCachedToken = token
	oneoneTokenMu.Unlock()

	return token, nil
}

func oneoneGetToken() (string, error) {
	oneoneTokenMu.Lock()
	token := oneoneCachedToken
	oneoneTokenMu.Unlock()
	if token != "" {
		return token, nil
	}
	return oneoneLogin()
}

// oneoneSignedRequest performs a signed, authenticated request against the
// Oneverse Northbound API V1, retrying once with a fresh login on 401.
func oneoneSignedRequest(method, path string, bodyObj any) ([]byte, error) {
	fullURL := strings.TrimRight(setting.OneOneBaseURL, "/") + path

	var bodyStr string
	if bodyObj != nil {
		canonical, err := canonicalizeJSON(bodyObj)
		if err != nil {
			return nil, err
		}
		bodyStr = canonical
	}

	doOnce := func(token string) (*http.Response, []byte, error) {
		sig := signOneOne(method, fullURL, bodyStr, setting.OneOneSecret)

		var reqBody io.Reader
		if bodyStr != "" {
			reqBody = strings.NewReader(bodyStr)
		}
		httpReq, err := http.NewRequest(method, fullURL, reqBody)
		if err != nil {
			return nil, nil, err
		}
		if bodyStr != "" {
			httpReq.Header.Set("Content-Type", "application/json")
		}
		httpReq.Header.Set("Authorization", "Bearer "+token)
		httpReq.Header.Set("X-Signature", sig)

		resp, err := oneoneHTTPClient.Do(httpReq)
		if err != nil {
			return nil, nil, fmt.Errorf("请求 OneOne 失败: %w", err)
		}
		defer resp.Body.Close()
		respBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, nil, fmt.Errorf("读取 OneOne 响应失败: %w", err)
		}
		return resp, respBytes, nil
	}

	token, err := oneoneGetToken()
	if err != nil {
		return nil, err
	}

	resp, respBytes, err := doOnce(token)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusUnauthorized {
		// Token may have been invalidated by a subsequent login elsewhere; refresh once.
		token, err = oneoneLogin()
		if err != nil {
			return nil, err
		}
		_, respBytes, err = doOnce(token)
		if err != nil {
			return nil, err
		}
	}

	return respBytes, nil
}

func getOneOneMinTopup() int64 {
	minTopup := setting.OneOneMinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		minTopup = minTopup * int(common.QuotaPerUnit)
	}
	return int64(minTopup)
}

// getOneOnePayMoney computes the real-currency amount to charge, mirroring getAntomPayMoney.
func getOneOnePayMoney(amount float64, group string) float64 {
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
	return amount * setting.OneOneUnitPrice * topupGroupRatio * discount
}

// OneOnePayRequest is the client payload for initiating a OneOne topup.
type OneOnePayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
	SuccessURL    string `json:"success_url,omitempty"`
}

// RequestOneOnePay creates a pending topup order and a hosted OneOne
// checkout session, returning the redirect URL as `pay_link`.
func RequestOneOnePay(c *gin.Context) {
	var req OneOnePayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.PaymentMethod != model.PaymentMethodOneOne {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "不支持的支付渠道"})
		return
	}
	if req.Amount < getOneOneMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("充值数量不能小于 %d", getOneOneMinTopup()), "data": 10})
		return
	}
	if req.SuccessURL != "" && common.ValidateRedirectURL(req.SuccessURL) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "支付成功重定向URL不在可信任域名列表中", "data": ""})
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
	payMoney := getOneOnePayMoney(float64(req.Amount), group)
	if payMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	tradeNo := fmt.Sprintf("oneone%d%s", time.Now().UnixMilli(), randstr.String(6))
	returnURL := req.SuccessURL
	if returnURL == "" {
		returnURL = paymentReturnPath("/console/log")
	}
	notifyURL := strings.TrimRight(service.GetCallbackAddress(), "/") + "/api/oneone/notify"

	orderReq := oneoneCreateOrderRequest{
		MerchantTransactionID: tradeNo,
		MerchantUUID:          setting.OneOneMerchantUUID,
		GameName:              setting.OneOneGameName,
		AccountInfo:           oneoneAccountInfo{Name: oneoneAccountPlaceholder},
		Country:               setting.OneOneCountry,
		PaymentChannel:        setting.OneOnePaymentChannel,
		AmountCents:           int64(payMoney * 100),
		Currency:              setting.OneOneCurrency,
		Title:                 fmt.Sprintf("New API balance top-up (%d)", req.Amount),
		MerchantReturnURL:     returnURL,
		WebhookURL:            notifyURL,
	}

	respBytes, err := oneoneSignedRequest(http.MethodPost, oneoneOrdersPath, orderReq)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("OneOne 创建支付会话失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	var parsed oneoneAPIResponse
	if err := common.Unmarshal(respBytes, &parsed); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("OneOne 解析下单响应失败 user_id=%d trade_no=%s error=%q body=%q", id, tradeNo, err.Error(), string(respBytes)))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}
	if parsed.Status != "success" {
		msg := parsed.Message
		if parsed.Error != nil {
			msg = parsed.Error.Message
		}
		logger.LogError(c.Request.Context(), fmt.Sprintf("OneOne 下单未成功 user_id=%d trade_no=%s status=%s code=%d msg=%q", id, tradeNo, parsed.Status, parsed.Code, msg))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}
	var orderData oneoneOrderData
	if err := common.Unmarshal(parsed.Data, &orderData); err != nil || orderData.Paylink == "" {
		logger.LogError(c.Request.Context(), fmt.Sprintf("OneOne 下单响应缺少 paylink user_id=%d trade_no=%s body=%q", id, tradeNo, string(respBytes)))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          req.Amount,
		Money:           chargedMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodOneOne,
		PaymentProvider: model.PaymentProviderOneOne,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("OneOne 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("OneOne 充值订单创建成功 user_id=%d trade_no=%s oneone_order_id=%s amount=%d money=%.2f", id, tradeNo, orderData.OrderID, req.Amount, chargedMoney))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": orderData.Paylink,
		},
	})
}

type oneoneWebhookPayload struct {
	OrderID               string `json:"order_id"`
	MerchantTransactionID string `json:"merchant_transaction_id"`
}

// OneOneNotify handles the webhook "wake-up" ping from Oneverse. The docs do
// not describe any signature/auth on the inbound callback itself, so instead
// of trusting the payload's `status` field, we treat it purely as a signal
// to re-fetch the order from Oneverse ourselves (signed, authenticated) and
// only credit the user if that authoritative status is "paid".
func OneOneNotify(c *gin.Context) {
	ctx := c.Request.Context()
	callerIp := c.ClientIP()

	if !isOneOneWebhookEnabled() {
		logger.LogWarn(ctx, fmt.Sprintf("OneOne 通知被拒绝 reason=disabled client_ip=%s", callerIp))
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("OneOne 通知读取请求体失败 client_ip=%s error=%q", callerIp, err.Error()))
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}

	var notify oneoneWebhookPayload
	if err := common.Unmarshal(payload, &notify); err != nil {
		logger.LogError(ctx, fmt.Sprintf("OneOne 通知解析失败 client_ip=%s error=%q body=%q", callerIp, err.Error(), string(payload)))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if notify.OrderID == "" {
		logger.LogWarn(ctx, fmt.Sprintf("OneOne 通知缺少 order_id client_ip=%s body=%q", callerIp, string(payload)))
		c.JSON(http.StatusOK, gin.H{"success": true})
		return
	}

	// Re-fetch the order from Oneverse ourselves; never trust the webhook body's status directly.
	respBytes, err := oneoneSignedRequest(http.MethodGet, oneoneOrdersPath+"/"+notify.OrderID, nil)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("OneOne 通知回查订单失败 order_id=%s client_ip=%s error=%q", notify.OrderID, callerIp, err.Error()))
		// Ask Oneverse to retry later rather than acking a state we couldn't verify.
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}
	var parsed oneoneAPIResponse
	if err := common.Unmarshal(respBytes, &parsed); err != nil || parsed.Status != "success" {
		logger.LogError(ctx, fmt.Sprintf("OneOne 通知回查订单响应异常 order_id=%s client_ip=%s body=%q", notify.OrderID, callerIp, string(respBytes)))
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}
	var orderData oneoneOrderData
	if err := common.Unmarshal(parsed.Data, &orderData); err != nil {
		logger.LogError(ctx, fmt.Sprintf("OneOne 通知解析回查订单数据失败 order_id=%s client_ip=%s error=%q", notify.OrderID, callerIp, err.Error()))
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}

	if orderData.Status != oneoneOrderStatusPaid {
		logger.LogInfo(ctx, fmt.Sprintf("OneOne 通知回查订单非成功状态，忽略入账 order_id=%s status=%s client_ip=%s", notify.OrderID, orderData.Status, callerIp))
		c.JSON(http.StatusOK, gin.H{"success": true})
		return
	}

	tradeNo := orderData.MerchantTransactionID
	if tradeNo == "" {
		tradeNo = notify.MerchantTransactionID
	}
	if tradeNo == "" {
		logger.LogWarn(ctx, fmt.Sprintf("OneOne 通知回查订单缺少 merchant_transaction_id order_id=%s client_ip=%s", notify.OrderID, callerIp))
		c.JSON(http.StatusOK, gin.H{"success": true})
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	if err := model.RechargeOneOne(tradeNo, callerIp); err != nil {
		logger.LogError(ctx, fmt.Sprintf("OneOne 充值处理失败 trade_no=%s order_id=%s client_ip=%s error=%q", tradeNo, notify.OrderID, callerIp, err.Error()))
		// Still ack to avoid infinite retries; the order remains pending for manual review.
		c.JSON(http.StatusOK, gin.H{"success": true})
		return
	}

	logger.LogInfo(ctx, fmt.Sprintf("OneOne 充值成功 trade_no=%s order_id=%s client_ip=%s", tradeNo, notify.OrderID, callerIp))
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// TestOneOneConnectionRequest lets the admin test unsaved form values
// directly, without first persisting them via /api/option/.
type TestOneOneConnectionRequest struct {
	MerchantUUID string `json:"merchant_uuid"`
	Password     string `json:"password"`
}

// TestOneOneConnection performs a one-off, uncached login call against
// Oneverse so the admin can verify credentials from the settings UI without
// going through a full topup order. Falls back to the currently saved
// setting for either field when left blank (mirrors how the settings form
// already treats blank secret fields as "keep existing value").
func TestOneOneConnection(c *gin.Context) {
	var req TestOneOneConnectionRequest
	_ = c.ShouldBindJSON(&req)

	merchantUUID := strings.TrimSpace(req.MerchantUUID)
	if merchantUUID == "" {
		merchantUUID = setting.OneOneMerchantUUID
	}
	password := req.Password
	if password == "" {
		password = setting.OneOnePasswordSecret
	}

	if merchantUUID == "" || password == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "请先填写 Merchant UUID 和 Login password",
		})
		return
	}

	if _, err := oneoneDoLogin(merchantUUID, password); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "登录成功，凭证有效",
	})
}
