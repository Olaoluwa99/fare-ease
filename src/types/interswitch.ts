// --- Interswitch API Types ---

// OAuth
export interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  merchant_code: string;
  requestor_id: string;
  jti: string;
}

// Virtual Account Generation
export interface GenerateVARequest {
  merchantCode: string;
  payableCode: string;
  currencyCode: string;
  amount: string;
  accountName: string;
  transactionReference: string;
}

export interface GenerateVAResponse {
  bankName: string;
  accountNumber: string;
  accountName: string;
  transactionReference: string;
  responseCode: string;
  responseMessage: string;
}

// Name Enquiry
export interface NameEnquiryResponse {
  AccountName: string;
  ResponseCode: string;
  ResponseCodeGrouping: string;
}

// Single Transfer
export interface TransferSender {
  phone: string;
  email: string;
  lastname: string;
  othernames: string;
}

export interface TransferTermination {
  amount: string;
  currencyCode: string;
  paymentMethodCode: string;
  countryCode: string;
  accountType: string;
  entityCode: string;
  accountReceivable: string;
}

export interface TransferInitiation {
  amount: string;
  currencyCode: string;
  paymentMethodCode: string;
  channel: string;
}

export interface TransferBeneficiary {
  lastname: string;
  othernames: string;
}

export interface SingleTransferRequest {
  mac: string;
  termination: TransferTermination;
  sender: TransferSender;
  initiatingEntityCode: string;
  initiation: TransferInitiation;
  beneficiary: TransferBeneficiary;
}

export interface SingleTransferResponse {
  mac: string;
  transactionRef: string;
  responseCode: string;
  responseMessage: string;
}

// Webhook
export interface InterswitchWebhookPayload {
  transactionId: string;
  virtualAccount: string;
  amount: number;
  status: string;
  transactionRef: string;
}
