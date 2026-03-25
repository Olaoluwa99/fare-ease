import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { interswitch } from "./src/services/interswitch.js";

// --- Supabase Admin Client ---
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Helper: Convert naira to kobo ---
function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ========================================================
  // Health Check
  // ========================================================
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "FareEase Router", timestamp: new Date().toISOString() });
  });

  // ========================================================
  // Name Enquiry — Verify Rider Bank Account
  // ========================================================
  app.post("/api/interswitch/name-enquiry", async (req, res) => {
    try {
      const { accountId, bankCode } = req.body;

      if (!accountId || !bankCode) {
        return res.status(400).json({ error: "accountId and bankCode are required" });
      }

      const result = await interswitch.nameEnquiry(accountId, bankCode);

      // Also check rider reputation from our database
      const { data: reputation } = await supabase
        .from("rider_reputation")
        .select("*")
        .eq("rider_account", accountId)
        .single();

      res.json({
        accountName: result.AccountName,
        responseCode: result.ResponseCode,
        status: result.ResponseCodeGrouping,
        // Attach trust score if we have it
        reputation: reputation
          ? {
              successfulDrops: reputation.successful_drops,
              uniqueVendors: reputation.unique_vendors_served,
              trustLevel:
                reputation.successful_drops > 50
                  ? "high"
                  : reputation.successful_drops > 5
                    ? "low"
                    : "none",
            }
          : { successfulDrops: 0, uniqueVendors: 0, trustLevel: "none" },
      });
    } catch (error: any) {
      console.error("[Name Enquiry] Failed:", error.response?.data || error.message);
      res.status(500).json({
        error: "Name enquiry failed",
        detail: error.response?.data?.responseMessage || error.message,
      });
    }
  });

  // ========================================================
  // Generate Virtual Account for Waybill
  // ========================================================
  app.post("/api/waybills/generate-va", async (req, res) => {
    try {
      const { vendorId, itemValue, riderFee, appFee, customerName, riderName, riderAccount, riderBankCode } = req.body;

      if (!vendorId || !itemValue || !riderFee) {
        return res.status(400).json({ error: "vendorId, itemValue, and riderFee are required" });
      }

      const totalAmount = Number(itemValue) + Number(riderFee) + Number(appFee || 100);

      // Get vendor info for account name
      const { data: vendor } = await supabase
        .from("vendors")
        .select("business_name")
        .eq("id", vendorId)
        .single();

      const accountName = `FareEase / ${vendor?.business_name || "Vendor"}`;

      // Create the waybill record first (to get the ID for transaction reference)
      const { data: waybill, error: waybillError } = await supabase
        .from("waybills")
        .insert([
          {
            vendor_id: vendorId,
            customer_name: customerName || "Customer",
            item_value: Number(itemValue),
            rider_fee: Number(riderFee),
            app_fee: Number(appFee || 100),
            rider_name: riderName || "Rider",
            rider_account: riderAccount || "",
            rider_bank_code: riderBankCode || "",
            status: "PENDING",
          },
        ])
        .select()
        .single();

      if (waybillError) throw waybillError;

      // Generate VA via Interswitch
      const vaResult = await interswitch.generateVirtualAccount(
        waybill.id,
        totalAmount,
        accountName
      );

      // Update waybill with VA details
      await supabase
        .from("waybills")
        .update({
          virtual_account_number: vaResult.accountNumber,
          bank_name: vaResult.bankName || "Wema Bank / FareEase",
          interswitch_ref: vaResult.transactionReference,
        })
        .eq("id", waybill.id);

      res.json({
        waybillId: waybill.id,
        virtualAccount: vaResult.accountNumber,
        bankName: vaResult.bankName || "Wema Bank / FareEase",
        totalAmount,
        breakdown: {
          itemValue: Number(itemValue),
          riderFee: Number(riderFee),
          appFee: Number(appFee || 100),
        },
      });
    } catch (error: any) {
      console.error("[Generate VA] Failed:", error.response?.data || error.message);
      res.status(500).json({
        error: "Failed to generate virtual account",
        detail: error.response?.data?.responseMessage || error.message,
      });
    }
  });

  // ========================================================
  // Interswitch Webhook — Payment Received
  // ========================================================
  app.post("/api/webhooks/interswitch", async (req, res) => {
    const { transactionRef, virtualAccount, amount, status } = req.body;

    console.log(`[Webhook] Received: VA=${virtualAccount}, amount=${amount}, status=${status}`);

    // Immediately acknowledge webhook
    res.status(200).send("OK");

    if (status !== "SUCCESS" && status !== "COMPLETED") {
      console.log(`[Webhook] Non-success status (${status}), ignoring.`);
      return;
    }

    try {
      // --- IDEMPOTENCY GUARD ---
      // Only process if waybill is still PENDING (prevents double-processing)
      const { data: waybill, error: fetchError } = await supabase
        .from("waybills")
        .select("*")
        .eq("virtual_account_number", virtualAccount)
        .eq("status", "PENDING")
        .single();

      if (fetchError || !waybill) {
        console.log(`[Webhook] No PENDING waybill found for VA ${virtualAccount}. Already processed or invalid.`);
        return;
      }

      // --- Step 1: Mark as FUNDED ---
      await supabase
        .from("waybills")
        .update({ status: "FUNDED" })
        .eq("id", waybill.id);

      console.log(`[Webhook] Waybill ${waybill.id} marked as FUNDED. Starting auto-split...`);

      // Get vendor details for settlement
      const { data: vendor } = await supabase
        .from("vendors")
        .select("*")
        .eq("id", waybill.vendor_id)
        .single();

      if (!vendor) {
        console.error(`[Webhook] Vendor ${waybill.vendor_id} not found!`);
        return;
      }

      const vendorPayout = waybill.item_value - waybill.app_fee; // Item value minus FareEase fee
      const riderPayout = waybill.rider_fee;

      // --- Step 2: Payout to Vendor ---
      try {
        const vendorTransfer = await interswitch.transferFunds(
          vendorPayout,
          vendor.settlement_account_number,
          vendor.settlement_bank_code,
          vendor.business_name,
          `${waybill.id}-VENDOR`
        );

        // Log vendor transaction
        await supabase.from("transactions").insert([
          {
            waybill_id: waybill.id,
            type: "VENDOR_PAYOUT",
            amount: vendorPayout,
            recipient_account: vendor.settlement_account_number,
            recipient_bank_code: vendor.settlement_bank_code,
            interswitch_ref: vendorTransfer.transactionRef || `${waybill.id}-VENDOR`,
            status: vendorTransfer.responseCode === "90000" ? "SUCCESS" : "FAILED",
          },
        ]);

        console.log(`[Webhook] Vendor payout ₦${vendorPayout} → ${vendor.settlement_account_number}`);
      } catch (vendorErr: any) {
        console.error(`[Webhook] Vendor payout FAILED:`, vendorErr.message);
        await supabase.from("transactions").insert([
          {
            waybill_id: waybill.id,
            type: "VENDOR_PAYOUT",
            amount: vendorPayout,
            recipient_account: vendor.settlement_account_number,
            recipient_bank_code: vendor.settlement_bank_code,
            status: "FAILED",
          },
        ]);
      }

      // --- Step 3: Payout to Rider ---
      try {
        const riderTransfer = await interswitch.transferFunds(
          riderPayout,
          waybill.rider_account,
          waybill.rider_bank_code,
          waybill.rider_name || "Rider",
          `${waybill.id}-RIDER`
        );

        // Log rider transaction
        await supabase.from("transactions").insert([
          {
            waybill_id: waybill.id,
            type: "RIDER_PAYOUT",
            amount: riderPayout,
            recipient_account: waybill.rider_account,
            recipient_bank_code: waybill.rider_bank_code,
            interswitch_ref: riderTransfer.transactionRef || `${waybill.id}-RIDER`,
            status: riderTransfer.responseCode === "90000" ? "SUCCESS" : "FAILED",
          },
        ]);

        console.log(`[Webhook] Rider payout ₦${riderPayout} → ${waybill.rider_account}`);
      } catch (riderErr: any) {
        console.error(`[Webhook] Rider payout FAILED:`, riderErr.message);
        await supabase.from("transactions").insert([
          {
            waybill_id: waybill.id,
            type: "RIDER_PAYOUT",
            amount: riderPayout,
            recipient_account: waybill.rider_account,
            recipient_bank_code: waybill.rider_bank_code,
            status: "FAILED",
          },
        ]);
      }

      // --- Step 4: Log App Fee ---
      await supabase.from("transactions").insert([
        {
          waybill_id: waybill.id,
          type: "APP_FEE",
          amount: waybill.app_fee,
          status: "SUCCESS",
        },
      ]);

      // --- Step 5: Mark waybill as SETTLED ---
      await supabase
        .from("waybills")
        .update({ status: "SETTLED" })
        .eq("id", waybill.id);

      // --- Step 6: Update Rider Reputation ---
      const { data: existingRep } = await supabase
        .from("rider_reputation")
        .select("*")
        .eq("rider_account", waybill.rider_account)
        .single();

      if (existingRep) {
        // Check if this vendor is new for this rider
        const { count: vendorCount } = await supabase
          .from("waybills")
          .select("vendor_id", { count: "exact", head: true })
          .eq("rider_account", waybill.rider_account)
          .eq("status", "SETTLED");

        await supabase
          .from("rider_reputation")
          .update({
            successful_drops: existingRep.successful_drops + 1,
            unique_vendors_served: vendorCount || existingRep.unique_vendors_served,
            last_active: new Date().toISOString(),
          })
          .eq("rider_account", waybill.rider_account);
      } else {
        await supabase.from("rider_reputation").insert([
          {
            rider_account: waybill.rider_account,
            rider_name: waybill.rider_name || "Unknown Rider",
            successful_drops: 1,
            unique_vendors_served: 1,
            last_active: new Date().toISOString(),
          },
        ]);
      }

      console.log(`[Webhook] ✅ Waybill ${waybill.id} fully settled. Vendor ₦${vendorPayout}, Rider ₦${riderPayout}, Fee ₦${waybill.app_fee}`);
    } catch (error: any) {
      console.error("[Webhook] Auto-split failed:", error.message);
    }
  });

  // ========================================================
  // Transaction Status Check
  // ========================================================
  app.get("/api/interswitch/transaction-status/:waybillId", async (req, res) => {
    try {
      const { waybillId } = req.params;

      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("waybill_id", waybillId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      res.json({ waybillId, transactions: transactions || [] });
    } catch (error: any) {
      console.error("[Status] Failed:", error.message);
      res.status(500).json({ error: "Failed to fetch transaction status" });
    }
  });

  // ========================================================
  // Vite Middleware (Dev) or Static Serving (Prod)
  // ========================================================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 FareEase Backend running on http://localhost:${PORT}`);
    console.log(`   Interswitch: ${process.env.INTERSWITCH_BASE_URL || "NOT CONFIGURED"}`);
    console.log(`   Supabase:    ${supabaseUrl ? "Connected" : "NOT CONFIGURED"}\n`);
  });
}

startServer();
