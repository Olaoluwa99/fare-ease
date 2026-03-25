// Nigerian Bank Codes (CBN codes used by Interswitch)
// Used for Name Enquiry and Funds Transfer APIs

export const BANK_CODES: Record<string, string> = {
  // Fintechs / Mobile Money
  "OPay": "999992",
  "PalmPay": "999991",
  "Moniepoint": "50515",
  "Kuda Bank": "50211",

  // Commercial Banks
  "Access Bank": "044",
  "GTBank": "058",
  "Zenith Bank": "057",
  "First Bank": "011",
  "UBA": "033",
  "Wema Bank": "035",
  "Stanbic IBTC": "221",
  "Fidelity Bank": "070",
  "Union Bank": "032",
  "Sterling Bank": "232",
  "FCMB": "214",
  "Polaris Bank": "076",
  "Ecobank": "050",
  "Keystone Bank": "082",
  "Unity Bank": "215",
  "Heritage Bank": "030",
  "Jaiz Bank": "301",
  "Providus Bank": "101",
  "ALAT (Wema)": "035",
  "VFD Microfinance Bank": "566",
};

// Reverse lookup: code -> bank name
export const BANK_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(BANK_CODES).map(([name, code]) => [code, name])
);

// Get bank code by name (case-insensitive)
export function getBankCode(bankName: string): string | undefined {
  const normalized = bankName.toLowerCase();
  for (const [name, code] of Object.entries(BANK_CODES)) {
    if (name.toLowerCase() === normalized) return code;
  }
  return undefined;
}

// Bank options for frontend dropdown
export const BANK_OPTIONS = Object.entries(BANK_CODES).map(([name, code]) => ({
  label: name,
  value: code,
}));
