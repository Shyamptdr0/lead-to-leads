import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { phone, apiKey, provider } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    // Clean phone number (remove +, spaces, dashes, etc.)
    const cleanPhone = phone.replace(/\D/g, "");

    // If no provider or apiKey is provided, perform a local validation
    if (!apiKey || !provider || provider === "none") {
      const len = cleanPhone.length;
      // Heuristic length check
      const isValidLength = len >= 10 && len <= 14;
      
      return NextResponse.json({ 
        success: true, 
        exists: isValidLength, 
        message: "Offline format check. Add a Wassenger or 2Chat API key to check live status." 
      });
    }

    if (provider === "wassenger") {
      const res = await fetch(`https://api.wassenger.com/v1/numbers/exists?phone=${cleanPhone}`, {
        method: "GET",
        headers: {
          "Token": apiKey,
          "Accept": "application/json"
        }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Wassenger API responded with status ${res.status}`);
      }

      const data = await res.json();
      return NextResponse.json({ 
        success: true, 
        exists: !!data.exists,
        message: data.exists ? "Registered on WhatsApp" : "Not registered on WhatsApp"
      });
    }

    if (provider === "twochat") {
      const res = await fetch(`https://api.2chat.co/v1/validation/whatsapp/${cleanPhone}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json"
        }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `2Chat API responded with status ${res.status}`);
      }

      const data = await res.json();
      return NextResponse.json({
        success: true,
        exists: !!data.exists || !!data.is_valid || (data.status === "valid"),
        message: (data.exists || data.is_valid || data.status === "valid") ? "Registered on WhatsApp" : "Not registered on WhatsApp"
      });
    }

    return NextResponse.json({ error: "Unsupported API provider" }, { status: 400 });
  } catch (error: any) {
    console.error("WhatsApp Check Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
