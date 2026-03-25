import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import { createClient } from '@supabase/supabase-js';

// --- Supabase Admin Client ---
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Interswitch Mock/Logic ---
const INTERSWITCH_BASE_URL = process.env.INTERSWITCH_BASE_URL || "https://sandbox.interswitchng.com";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "FareEase Router" });
  });

  // Interswitch Webhook: Transaction Completed
  app.post("/api/webhooks/interswitch", async (req, res) => {
    const { transactionId, virtualAccount, amount, status } = req.body;
    
    console.log(`[Webhook] Payment received: ${amount} to VA ${virtualAccount}`);

    if (status === "SUCCESS") {
      // 1. Update Waybill Status in Supabase
      const { data, error } = await supabase
        .from('waybills')
        .update({ status: 'SETTLED' })
        .eq('virtual_account_number', virtualAccount)
        .select()
        .single();
      
      if (error) {
        console.error(`[Error] Failed to update waybill for VA ${virtualAccount}:`, error);
      } else {
        console.log(`[Success] Waybill ${data.id} settled.`);
        // 2. Trigger Auto-Split via Interswitch Outward Transfer API
        // 3. Send WhatsApp Notification via WhatsApp Business API
        console.log(`[Logic] Triggering auto-split for ${virtualAccount}`);
      }
    }

    res.status(200).send("OK");
  });

  // Generate Virtual Account (Proxy to Interswitch)
  app.post("/api/waybills/generate-va", async (req, res) => {
    try {
      // In a real app, you'd call Interswitch's VA generation endpoint here
      const mockVA = "99" + Math.floor(10000000 + Math.random() * 90000000);
      res.json({ virtualAccount: mockVA, bankName: "Wema Bank / FareEase" });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate VA" });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`FareEase Backend running on http://localhost:${PORT}`);
  });
}

startServer();
