const KEY = "carmen-checkout-order";

export function rememberCheckoutOrder(orderNumber: string) {
  try {
    window.sessionStorage.setItem(KEY, orderNumber);
  } catch {
    /* private mode */
  }
}

export function peekCheckoutOrder() {
  try {
    return window.sessionStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function forgetCheckoutOrder() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}
