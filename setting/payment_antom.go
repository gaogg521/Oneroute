package setting

// Antom (Alipay Global / 支付宝海外版) direct payment gateway settings.
//
// Antom is integrated via its REST API + RSA2 request signing (no SDK).
// All values are admin-configurable and empty by default; the gateway stays
// disabled until ClientId / PrivateKey / PublicKey are filled in.
var (
	// AntomClientId identifies the merchant client (e.g. SANDBOX_5X00000000000000).
	AntomClientId = ""
	// AntomPrivateKey is the merchant RSA private key (PKCS#8, base64, no PEM header) used to sign requests.
	AntomPrivateKey = ""
	// AntomPublicKey is the Antom public key (base64, no PEM header) used to verify responses and notifications.
	AntomPublicKey = ""
	// AntomGateway is the Antom API endpoint base URL. Defaults to the Singapore gateway.
	AntomGateway = "https://open-sg-global.alipay.com"
	// AntomPaymentMethodType is the cashier payment method type (e.g. ALIPAY_CN), adjust per your Antom contract.
	AntomPaymentMethodType = "ALIPAY_CN"
	// AntomCurrency is the settlement currency sent to Antom.
	AntomCurrency = "USD"
	// AntomUnitPrice is how much local currency to charge per unit of balance (mirrors StripeUnitPrice).
	AntomUnitPrice = 1.0
	// AntomMinTopUp is the smallest amount of balance a user can recharge.
	AntomMinTopUp = 1
)
