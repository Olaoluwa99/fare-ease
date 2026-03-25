import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import type {
  AccessTokenResponse,
  GenerateVARequest,
  GenerateVAResponse,
  NameEnquiryResponse,
  SingleTransferRequest,
  SingleTransferResponse,
  TransferBeneficiary,
} from "../types/interswitch.js";

// --- Interswitch Service ---
// Handles OAuth token management and all Interswitch API calls.

export class InterswitchService {
  private clientId: string;
  private secretKey: string;
  private merchantCode: string;
  private payableCode: string;
  private terminalId: string;
  private baseUrl: string;
  private passportUrl: string;
  private paymentGatewayUrl: string;

  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0; // Unix ms

  private http: AxiosInstance;

  constructor() {
    this.clientId = process.env.INTERSWITCH_CLIENT_ID || "";
    this.secretKey = process.env.INTERSWITCH_SECRET_KEY || "";
    this.merchantCode = process.env.INTERSWITCH_MERCHANT_CODE || "";
    this.payableCode = process.env.INTERSWITCH_PAYABLE_CODE || "";
    this.terminalId = process.env.INTERSWITCH_TERMINAL_ID || "3PBL001";
    this.baseUrl = process.env.INTERSWITCH_BASE_URL || "https://qa.interswitchng.com";
    this.passportUrl = process.env.INTERSWITCH_PASSPORT_URL || `${this.baseUrl}/passport/oauth/token`;
    this.paymentGatewayUrl = process.env.INTERSWITCH_PAYMENT_GATEWAY_URL || "https://payment-service.k8.isw.la";

    if (!this.clientId || !this.secretKey) {
      console.warn("[Interswitch] CLIENT_ID or SECRET_KEY missing. API calls will fail.");
    }

    this.http = axios.create({ timeout: 30000 });
  }

  // ========================================================
  // OAuth 2.0 Token Management
  // ========================================================

  /**
   * Get a valid access token, refreshing if expired.
   * Token is cached for its lifetime (typically 24h).
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    console.log("[Interswitch] Fetching new access token...");

    const credentials = Buffer.from(`${this.clientId}:${this.secretKey}`).toString("base64");

    const response = await this.http.post<AccessTokenResponse>(
      `${this.passportUrl}?grant_type=client_credentials`,
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    this.accessToken = response.data.access_token;
    this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000;

    console.log(`[Interswitch] Token acquired. Expires in ${response.data.expires_in}s`);
    return this.accessToken;
  }

  // ========================================================
  // Virtual Account Generation
  // ========================================================

  /**
   * Generate a dynamic virtual account for a waybill.
   * Customer pays to this account; webhook fires on completion.
   *
   * @param waybillId - Used as transactionReference
   * @param amountNaira - Total amount customer must pay (Naira)
   * @param accountName - Display name for the VA (e.g. "FareEase / Vendor Name")
   */
  async generateVirtualAccount(
    waybillId: string,
    amountNaira: number,
    accountName: string
  ): Promise<GenerateVAResponse> {
    const token = await this.getAccessToken();

    // Amount in kobo (minor units)
    const amountKobo = Math.round(amountNaira * 100).toString();

    const payload: GenerateVARequest = {
      merchantCode: this.merchantCode,
      payableCode: this.payableCode,
      currencyCode: "566", // NGN
      amount: amountKobo,
      accountName: accountName,
      transactionReference: waybillId,
    };

    console.log(`[Interswitch] Generating VA for waybill ${waybillId}, amount ₦${amountNaira}`);

    const response = await this.http.post<GenerateVAResponse>(
      `${this.paymentGatewayUrl}/paymentgateway/api/v1/virtual-accounts`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`[Interswitch] VA generated: ${response.data.accountNumber} (${response.data.bankName})`);
    return response.data;
  }

  // ========================================================
  // Name Enquiry
  // ========================================================

  /**
   * Verify a bank account holder's name via Interswitch.
   *
   * @param accountId - 10-digit NUBAN
   * @param bankCode - CBN bank code (e.g. "044" for Access, "999992" for OPay)
   */
  async nameEnquiry(accountId: string, bankCode: string): Promise<NameEnquiryResponse> {
    const token = await this.getAccessToken();

    console.log(`[Interswitch] Name enquiry: account=${accountId}, bank=${bankCode}`);

    const response = await this.http.get<NameEnquiryResponse>(
      `${this.baseUrl}/quicktellerservice/api/v5/Transactions/DoAccountNameInquiry`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          TerminalId: this.terminalId,
          accountid: accountId,
          bankcode: bankCode,
        },
      }
    );

    console.log(`[Interswitch] Name enquiry result: ${response.data.AccountName}`);
    return response.data;
  }

  // ========================================================
  // Single Transfer (Funds Disbursement)
  // ========================================================

  /**
   * Compute SHA-512 MAC required by the Single Transfer API.
   */
  private computeTransferMAC(
    initiatingAmount: string,
    initiatingCurrencyCode: string,
    initiatingPaymentMethodCode: string,
    terminatingAmount: string,
    terminatingCurrencyCode: string,
    terminatingPaymentMethodCode: string,
    terminatingCountryCode: string
  ): string {
    const raw =
      initiatingAmount +
      initiatingCurrencyCode +
      initiatingPaymentMethodCode +
      terminatingAmount +
      terminatingCurrencyCode +
      terminatingPaymentMethodCode +
      terminatingCountryCode;

    return crypto.createHash("sha512").update(raw).digest("base64");
  }

  /**
   * Transfer funds to a bank account via Interswitch Single Transfer.
   *
   * @param amountNaira - Amount in Naira
   * @param recipientAccount - 10-digit NUBAN
   * @param recipientBankCode - CBN bank code
   * @param beneficiaryName - Full name from Name Enquiry (split into last + other)
   * @param transactionId - Unique reference for idempotency
   */
  async transferFunds(
    amountNaira: number,
    recipientAccount: string,
    recipientBankCode: string,
    beneficiaryName: string,
    transactionId: string
  ): Promise<SingleTransferResponse> {
    const token = await this.getAccessToken();

    // Amount in kobo
    const amountKobo = Math.round(amountNaira * 100).toString();

    // Split beneficiary name
    const nameParts = beneficiaryName.trim().split(/\s+/);
    const beneficiary: TransferBeneficiary = {
      lastname: nameParts[nameParts.length - 1] || beneficiaryName,
      othernames: nameParts.slice(0, -1).join(" ") || beneficiaryName,
    };

    // Compute MAC
    const mac = this.computeTransferMAC(
      amountKobo,  // initiatingAmount
      "566",       // initiatingCurrencyCode (NGN)
      "CA",        // initiatingPaymentMethodCode (Cash)
      amountKobo,  // terminatingAmount
      "566",       // terminatingCurrencyCode (NGN)
      "AC",        // terminatingPaymentMethodCode (Account)
      "NG"         // terminatingCountryCode
    );

    const payload: SingleTransferRequest = {
      mac,
      termination: {
        amount: amountKobo,
        currencyCode: "566",
        paymentMethodCode: "AC",
        countryCode: "NG",
        accountType: "10", // Savings
        entityCode: recipientBankCode,
        accountReceivable: recipientAccount,
      },
      sender: {
        phone: "0000000000",
        email: "settlements@fareease.ng",
        lastname: "FareEase",
        othernames: "Settlements",
      },
      initiatingEntityCode: "NGN",
      initiation: {
        amount: amountKobo,
        currencyCode: "566",
        paymentMethodCode: "CA",
        channel: "7",
      },
      beneficiary,
    };

    console.log(`[Interswitch] Transfer ₦${amountNaira} to ${recipientAccount} (bank ${recipientBankCode})`);

    const response = await this.http.post<SingleTransferResponse>(
      `${this.baseUrl}/quicktellerservice/api/v5/transactions/TransferFunds`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          TerminalId: this.terminalId,
        },
      }
    );

    console.log(`[Interswitch] Transfer response: ${response.data.responseCode} - ${response.data.responseMessage}`);
    return response.data;
  }
}

// Singleton instance
export const interswitch = new InterswitchService();
