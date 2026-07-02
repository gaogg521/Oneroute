package setting

// OneOne (Oneverse Northbound API V1, games.oneone.com) direct payment
// gateway settings.
//
// OneOne is integrated via its REST API + HMAC-SHA256 request signing (no
// SDK). All values are admin-configurable and empty by default; the gateway
// stays disabled until MerchantUUID / GameName / Password / Secret /
// PaymentChannel / Country are filled in.
var (
	// OneOneMerchantUUID is the merchant UUID used to log in (POST /api/northbound/login).
	OneOneMerchantUUID = ""
	// OneOneGameName is the game_name assigned to this merchant by Oneverse.
	OneOneGameName = ""
	// OneOnePasswordSecret is the login password used to obtain a Bearer token.
	OneOnePasswordSecret = ""
	// OneOneSecret is the HMAC-SHA256 signing secret used for the X-Signature header.
	OneOneSecret = ""
	// OneOneBaseURL is the Oneverse API base URL.
	OneOneBaseURL = "https://games.oneone.com"
	// OneOnePaymentChannel is the payment_channel value to use when creating orders.
	OneOnePaymentChannel = ""
	// OneOneCountry is the country code (ISO 3166-2) sent when creating orders.
	OneOneCountry = ""
	// OneOneCurrency is the settlement currency sent to Oneverse.
	OneOneCurrency = "USD"
	// OneOneUnitPrice is how much local currency to charge per unit of balance (mirrors AntomUnitPrice).
	OneOneUnitPrice = 1.0
	// OneOneMinTopUp is the smallest amount of balance a user can recharge.
	OneOneMinTopUp = 1
	// OneOneRail optionally tags which underlying payment rail this gateway
	// represents (e.g. "alipay", "wechat"), enabling cross-gateway duplicate
	// pruning in GetTopUpInfo. Empty means "uncategorized" — always shown
	// standalone, never compared against other gateways.
	OneOneRail = ""
)
